import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CatalogAiRepository } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/catalog-ai.repository.js';
import type { EmbeddingPort } from '../../../../../EmuKey/backend/src/modules/assistance-support/application/ports/embedding.port.js';
import { extractAiRetrievalUpgrade } from '../../../../../EmuKey/backend/src/entrypoints/database/index-ai-catalog.js';
import { GeminiEmbeddingGateway } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/gemini-embedding.gateway.js';
import { KnowledgeAiRepository } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/knowledge-ai.repository.js';
import { AiRetrievalDatabase } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/ai-retrieval.database.js';
import { ConfigService } from '@nestjs/config';
import { AiAdvisorService } from '../../../../../EmuKey/backend/src/modules/assistance-support/application/ai-advisor.service.js';
import { AiAssistanceService } from '../../../../../EmuKey/backend/src/modules/assistance-support/ai-assistance.service.js';
import { AssistanceSupportService } from '../../../../../EmuKey/backend/src/modules/assistance-support/assistance-support.service.js';
import { AssistanceSupportRepository } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/assistance-support.repository.js';
import { NotificationRepository } from '../../../../../EmuKey/backend/src/modules/operations/infrastructure/notification.repository.js';

// Real PostgreSQL/pgvector + deterministic embedding fixture. This does not evaluate Gemini relevance.
describe('Catalog vector PostgreSQL boundary', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let writer: CatalogAiRepository;
  const provider = randomUUID();
  const school = randomUUID();
  const security = randomUUID();
  const hidden = randomUUID();
  const schoolPlan = randomUUID();
  const securityPlan = randomUUID();
  const draftPlan = randomUUID();
  const hiddenPlan = randomUUID();
  const embedding: EmbeddingPort = {
    model: 'fixture-retrieval-v1', dimensions: 3,
    embed: async ({ text, taskType }) => taskType === 'RETRIEVAL_QUERY' || text.includes('Classroom') ? [1, 0, 0] : [0, 1, 0],
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg15').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    const schema = await readFile(resolve(import.meta.dirname, '../../../../../EmuKey/backend/database/schema.sql'), 'utf8');
    await pool.query(schema);
    // Existing-data upgrade is additive/idempotent; never re-run the initializer here.
    await pool.query(extractAiRetrievalUpgrade(schema));
    await pool.query(`INSERT INTO users (id,email,password_hash,display_name,organization_name,role,status,provider_chain_namespace)
      VALUES ($1,'catalog-provider@example.test','hash','Provider','Public Provider','PROVIDER_ADMIN','ACTIVE','catalog-fixture')`, [provider]);
    for (const [id, code, name, status] of [[school, 'CLASSROOM', 'Classroom', 'PUBLISHED'],
      [security, 'SECURITY', 'Endpoint Security', 'PUBLISHED'], [hidden, 'HIDDEN', 'Hidden product', 'DRAFT']]) {
      await pool.query(`INSERT INTO products (id,provider_user_id,code,name,description,status,published_at)
        VALUES ($1,$2,$3,$4::text,$4::text,$5::text,CASE WHEN $5::text='PUBLISHED' THEN now() ELSE NULL END)`, [id, provider, code, name, status]);
    }
    for (const [id, product, code, price, devices, status] of [
      [schoolPlan, school, 'YEARLY', 900000, 5, 'PUBLISHED'], [securityPlan, security, 'YEARLY', 1500000, 2, 'PUBLISHED'],
      [draftPlan, school, 'DRAFT', 500000, 10, 'DRAFT'], [hiddenPlan, hidden, 'HIDDEN', 100000, 10, 'PUBLISHED'],
    ]) {
      await pool.query(`INSERT INTO plans (id,product_id,code,version,name,duration_months,price_vnd,max_active_devices,
        entitlements,plan_commitment,status,published_at) VALUES ($1,$2,$3::text,1,$3::text,12,$4,$5,'{"sync":true}',decode(repeat('11',32),'hex'),$6::text,
        CASE WHEN $6::text='PUBLISHED' THEN now() ELSE NULL END)`, [id, product, code, price, devices, status]);
    }
    writer = new CatalogAiRepository(pool, embedding);
  });
  afterAll(async () => { await pool?.end(); await container?.stop(); });

  async function readerSearch(input: Parameters<CatalogAiRepository['search']>[0], adapter: EmbeddingPort | null = embedding) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query('SET LOCAL ROLE emukey_ai_reader');
      return await new CatalogAiRepository({ query: client.query.bind(client) }, adapter ?? undefined).search(input);
    } finally { await client.query('ROLLBACK'); client.release(); }
  }

  it('indexes only public plans, ranks with real cosine distance, and skips unchanged content', async () => {
    expect(await writer.reindex()).toMatchObject({ indexed: 2, superseded: 0 });
    expect(await writer.reindex()).toMatchObject({ indexed: 0, superseded: 0 });
    const sources = await readerSearch({ question: 'manage pupils and lessons', maxPriceVnd: 1000000, minDevices: 4, durationMonths: 12 });
    expect(sources).toMatchObject([{ planId: schoolPlan, priceVnd: 900000, retrievalMethod: 'VECTOR' }]);
    expect((await readerSearch({ question: 'school', productIds: [hidden] }))).toEqual([]);
    expect((await readerSearch({ question: 'school', planIds: [draftPlan] }))).toEqual([]);
    expect((await readerSearch({ question: 'school', planIds: [] }))).toEqual([]);
  });

  it('finds a published product family with a generic gói prefix and a bare partial name', async () => {
    await pool.query('UPDATE products SET name=$2 WHERE id=$1', [school, 'Classroom Hub Business']);
    try {
      const sources = await readerSearch({ question: 'Gói Classroom Hub có những gói nào giá ra sao và được nhà cung cấp nào cung cấp' }, null);
      expect(sources).toMatchObject([{ productId: school, productName: 'Classroom Hub Business' }]);
      expect(await readerSearch({ question: 'sản phẩm Classroom Hub' }, null)).toMatchObject([{ productId: school }]);
      expect(await readerSearch({ question: 'Gói NonexistentSuite có những gói nào?' }, null)).toEqual([]);
    } finally { await pool.query('UPDATE products SET name=$2 WHERE id=$1', [school, 'Classroom']); }
  });

  it('never reads stale vectors and immediately excludes newly archived products', async () => {
    await pool.query('UPDATE products SET description=$2 WHERE id=$1', [school, 'Updated public school description']);
    expect(await readerSearch({ question: 'school', productIds: [school] })).toMatchObject([{ retrievalMethod: 'LEXICAL' }]);
    expect(await writer.reindex()).toMatchObject({ indexed: 1 });
    expect(await readerSearch({ question: 'school', productIds: [school] })).toMatchObject([{ retrievalMethod: 'VECTOR' }]);
    await pool.query('UPDATE products SET description=$2 WHERE id=$1', [school, 'Before remote embedding']);
    const racingEmbedding: EmbeddingPort = { ...embedding, embed: async (input) => {
      await pool.query('UPDATE products SET description=$2 WHERE id=$1', [school, 'Changed during remote embedding']);
      return embedding.embed(input);
    } };
    expect(await new CatalogAiRepository(pool, racingEmbedding).reindex()).toMatchObject({ indexed: 0, superseded: 1 });
    expect(await readerSearch({ question: 'school', planIds: [schoolPlan] })).toMatchObject([{ retrievalMethod: 'LEXICAL' }]);
    expect(await writer.reindex()).toMatchObject({ indexed: 1 });
    await pool.query("UPDATE products SET status='ARCHIVED' WHERE id=$1", [school]);
    expect(await readerSearch({ question: 'school', planIds: [schoolPlan] })).toEqual([]);
    await pool.query("UPDATE products SET status='PUBLISHED' WHERE id=$1", [school]);
  });

  it('falls back on model/dimension mismatch and unavailable embeddings', async () => {
    const otherModel = { ...embedding, model: 'fixture-other-model' };
    expect(await readerSearch({ question: 'school', planIds: [schoolPlan] }, otherModel)).toMatchObject([{ retrievalMethod: 'LEXICAL' }]);
    const otherDimensions = { ...embedding, dimensions: 2, embed: async () => [1, 0] };
    expect(await readerSearch({ question: 'school', planIds: [schoolPlan] }, otherDimensions)).toMatchObject([{ retrievalMethod: 'LEXICAL' }]);
    const failing = { ...embedding, embed: async () => { throw new Error('fixture unavailable'); } };
    expect(await readerSearch({ question: 'school', planIds: [schoolPlan] }, failing)).toMatchObject([{ retrievalMethod: 'LEXICAL' }]);
  });

  it('rejects low similarity, unknown named products and literal injection instead of arbitrary nearest plans', async () => {
    const irrelevant = { ...embedding, embed: async () => [0, 0, 1] };
    expect(await readerSearch({ question: 'astronomical spectroscopy', maxPriceVnd: 1000000 }, irrelevant)).toEqual([]);
    expect(await readerSearch({ question: 'NonexistentSuite có những gói nào?' })).toEqual([]);
    expect(await readerSearch({ question: '"Missing\' OR 1=1; DROP TABLE products; --" có những gói nào?' })).toEqual([]);
    expect(await readerSearch({ question: 'Classroom có những gói nào?' }, irrelevant)).toMatchObject([{ planId: schoolPlan, retrievalMethod: 'LEXICAL' }]);
    expect(await readerSearch({ question: 'nó hỗ trợ bao nhiêu thiết bị?', planIds: [schoolPlan] }, irrelevant)).toMatchObject([{ planId: schoolPlan, retrievalMethod: 'LEXICAL' }]);
    expect(await readerSearch({ question: 'Classroom có giá bao nhiêu?' }, irrelevant)).toMatchObject([{ planId: schoolPlan, retrievalMethod: 'LEXICAL' }]);
    expect(await readerSearch({ question: 'NonexistentSuite có giá bao nhiêu?' })).toEqual([]);
    expect((await pool.query('SELECT count(*) FROM products')).rows[0].count).toBe('3');
  });

  it.skipIf(process.env.EMUKEY_TEST_REAL_EMBEDDINGS !== '1')('round-trips real Gemini embeddings through isolated pgvector (opt-in, no remote DB)', async () => {
    await pool.query('UPDATE products SET description=$2 WHERE id=$1', [school, 'A classroom management platform for teachers to organize students, courses, attendance and learning progress.']);
    const gateway = new GeminiEmbeddingGateway({ apiKey: process.env.GEMINI_API_KEY ?? '', dimensions: 768, timeoutMs: 30_000 });
    const realWriter = new CatalogAiRepository(pool, gateway);
    expect(await realWriter.reindex()).toMatchObject({ indexed: 2, dimensions: 768, model: 'gemini-embedding-001' });
    const status = await realWriter.status();
    expect(status).toMatchObject({ publishedPlans: 2, indexedPlans: 2, stalePlans: 0, missingPlans: 0 });
    // Vietnamese paraphrase has no literal product-name match against the English catalog.
    const semanticQuestion = 'Tôi muốn điều phối học viên, theo dõi điểm danh và tiến độ giảng dạy';
    expect(await readerSearch({ question: semanticQuestion }, null)).toEqual([]);
    const semantic = await readerSearch({ question: semanticQuestion }, gateway);
    expect(semantic[0]).toMatchObject({ planId: schoolPlan, retrievalMethod: 'VECTOR' });
    expect(await realWriter.reindex()).toMatchObject({ indexed: 0 });
  });

  it('persists multi-turn customer context, rechecks replay prices and stops inference after handoff', async () => {
    const actor = { sub: randomUUID(), role: 'CUSTOMER' as const, sessionVersion: 1 };
    await pool.query(`INSERT INTO users(id,email,password_hash,display_name,role,status,customer_type,email_verified_at)
      VALUES($1,$2,'hash','Customer','CUSTOMER','ACTIVE','INDIVIDUAL',now())`, [actor.sub, `${actor.sub}@example.test`]);
    const conversations = new AssistanceSupportRepository(pool, new NotificationRepository(pool));
    const gateway = { answerGrounded: vi.fn() };
    const advisor = new AiAdvisorService(gateway, { search: input => readerSearch(input) }, { search: async () => [] });
    const ai = new AiAssistanceService(gateway, {
      appendCustomerMessage: input => conversations.appendCustomerMessage(input),
      appendAiMessage: input => conversations.appendAiMessage(input),
      context: input => conversations.aiContext(input),
      findAnswer: (id, intent) => conversations.findAiAnswer(id, intent),
      searchSources: async () => [],
    }, advisor);
    const service = new AssistanceSupportService(conversations, ai);
    const conversation = await service.createConversation(actor, { contextType: 'GENERAL' });
    const firstId = randomUUID();
    const first = await service.askAi(actor, conversation.id, 'Classroom có những gói nào?', firstId);
    expect(first).toMatchObject({ grounded: true, catalogSources: [{ planId: schoolPlan }] });
    expect(await service.askAi(actor, conversation.id, 'Gói đó có bao nhiêu máy?', randomUUID()))
      .toMatchObject({ grounded: true, catalogSources: [{ planId: schoolPlan, maxActiveDevices: 5 }] });
    const history = await service.listMessages(actor, conversation.id);
    expect(history.map(message => message.senderType)).toEqual(['CUSTOMER', 'AI', 'CUSTOMER', 'AI']);
    expect(await service.askAi(actor, conversation.id, 'Classroom có những gói nào?', firstId)).toEqual(first);
    expect(await service.listMessages(actor, conversation.id)).toHaveLength(4);
    // Published terms are immutable; a catalog price change archives the previous plan version.
    await pool.query("UPDATE plans SET status='ARCHIVED' WHERE id=$1", [schoolPlan]);
    await expect(service.askAi(actor, conversation.id, 'Classroom có những gói nào?', firstId)).rejects.toMatchObject({ status: 409 });
    await expect(service.askAi({ ...actor, sub: randomUUID() }, conversation.id, 'Gói đó?', randomUUID())).rejects.toMatchObject({ status: 404 });
    expect(await service.requestSupport(actor, conversation.id, 'Tôi muốn nhân viên kiểm tra')).toMatchObject({ status: 'WAITING_SUPPORT' });
    expect(await service.requestSupport(actor, conversation.id, 'Tôi muốn nhân viên kiểm tra')).toMatchObject({ status: 'WAITING_SUPPORT' });
    expect((await service.listMessages(actor, conversation.id)).filter(message => message.senderType === 'SYSTEM')).toHaveLength(1);
    await expect(service.askAi(actor, conversation.id, 'Gói đó?', randomUUID())).rejects.toMatchObject({ status: 409 });
    expect(gateway.answerGrounded).not.toHaveBeenCalled();
    await pool.query("UPDATE plans SET status='PUBLISHED' WHERE id=$1", [schoolPlan]);
  });

  it('denies base-table access and writes even without READ ONLY transaction protection', async () => {
    for (const statement of ['SELECT * FROM users', 'SELECT * FROM conversations', 'SELECT * FROM messages',
      'SELECT * FROM provider_integrations', 'SELECT * FROM license_key_materials', 'SELECT * FROM provider_invitations',
      'SELECT * FROM catalog_ai_embeddings', 'DELETE FROM catalog_ai_embeddings', 'UPDATE products SET name=name',
      'INSERT INTO catalog_ai_embeddings DEFAULT VALUES', 'TRUNCATE catalog_ai_embeddings',
      'ALTER TABLE products ADD COLUMN forbidden text', 'CREATE TABLE public.ai_reader_forbidden (id int)']) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE emukey_ai_reader');
        await expect(client.query(statement)).rejects.toMatchObject({ code: '42501' });
      } finally { await client.query('ROLLBACK'); client.release(); }
    }
  });

  it('enforces reader role and read-only mode through the production connection adapter', async () => {
    const reader = new AiRetrievalDatabase(new ConfigService({ DATABASE_URL: container.getConnectionUri() }));
    try {
      const settings = await reader.query("SELECT current_user AS role, current_setting('transaction_read_only') AS readonly");
      expect(settings.rows[0]).toEqual({ role: 'emukey_ai_reader', readonly: 'on' });
      expect((await reader.query('SELECT * FROM ai_public_catalog')).rows).toHaveLength(2);
      await expect(reader.query('SELECT * FROM users')).rejects.toMatchObject({ code: '42501' });
      await expect(reader.query('DELETE FROM products')).rejects.toBeDefined();
      expect((await reader.query('SELECT * FROM ai_public_catalog')).rows).toHaveLength(2);
    } finally { await reader.onApplicationShutdown(); }
  });

  it('exposes only READY/current/published public knowledge without storage/secret fields', async () => {
    const document = randomUUID();
    await pool.query(`INSERT INTO knowledge_documents (id,product_id,plan_id,logical_document_key,version,source_type,title,status,is_current)
      VALUES ($1,$2,$3,'catalog-guide',1,'FAQ','Guide','READY',true)`, [document, school, schoolPlan]);
    await pool.query('INSERT INTO knowledge_chunks(document_id,chunk_index,content) VALUES ($1,0,$2)', [document, 'Public setup guide']);
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query('SET LOCAL ROLE emukey_ai_reader');
      const sources = await client.query('SELECT * FROM ai_public_knowledge');
      expect(sources.rows).toHaveLength(1);
      expect(sources.rows[0]).toMatchObject({ document_id: document, product_id: school, document_version: 1, content: 'Public setup guide' });
      expect(sources.rows[0]).not.toHaveProperty('storage_key');
    } finally { await client.query('ROLLBACK'); client.release(); }
    await pool.query("UPDATE knowledge_documents SET is_current=false WHERE id=$1", [document]);
    expect((await pool.query('SELECT * FROM ai_public_knowledge')).rows).toEqual([]);
  });

  it('enforces KnowledgeAiRepository current/approval/product/plan scopes through the reader role', async () => {
    const archivedPlan = randomUUID();
    await pool.query(`INSERT INTO plans(id,product_id,code,version,name,duration_months,price_vnd,max_active_devices,plan_commitment,status,published_at)
      VALUES ($1,$2,'ARCHIVED',1,'Archived',12,100000,1,decode(repeat('22',32),'hex'),'ARCHIVED',now())`, [archivedPlan, school]);
    const visible: string[] = [];
    for (const [key, product, plan, status, current] of [
      ['global', school, null, 'READY', true], ['scoped', school, schoolPlan, 'READY', true],
      ['draft-plan', school, draftPlan, 'READY', true], ['archived-plan', school, archivedPlan, 'READY', true],
      ['old-version', school, schoolPlan, 'READY', false], ['unapproved', school, schoolPlan, 'PROCESSING', false],
      ['archived-doc', school, schoolPlan, 'ARCHIVED', false], ['hidden-product', hidden, hiddenPlan, 'READY', true],
      ['other-product', security, securityPlan, 'READY', true],
    ] as const) {
      const id = randomUUID();
      await pool.query(`INSERT INTO knowledge_documents(id,product_id,plan_id,logical_document_key,version,source_type,title,status,is_current)
        VALUES ($1,$2,$3,$4,1,'FAQ','Boundary guide',$5,$6)`, [id, product, plan, `boundary-${key}`, status, current]);
      await pool.query('INSERT INTO knowledge_chunks(document_id,chunk_index,content) VALUES ($1,0,$2)', [id, `Boundary setup ${key}`]);
      if (key === 'global' || key === 'scoped') visible.push(id);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query('SET LOCAL ROLE emukey_ai_reader');
      const repository = new KnowledgeAiRepository({ query: client.query.bind(client) });
      const sources = await repository.search({ question: 'Boundary', productIds: [school], planIds: [schoolPlan] });
      expect(sources.map((source) => source.documentId).sort()).toEqual(visible.sort());
      expect(sources.every((source) => source.documentVersion === 1 && source.chunkIndex === 0 && source.productId === school)).toBe(true);
      const otherScope = await repository.search({ question: 'Boundary', productIds: [school], planIds: [securityPlan] });
      expect(otherScope).toHaveLength(1);
      expect(otherScope[0]?.planId).toBeNull();
    } finally { await client.query('ROLLBACK'); client.release(); }
    await pool.query("UPDATE products SET status='ARCHIVED',published_at=now() WHERE id=$1", [hidden]);
    expect((await pool.query('SELECT * FROM ai_public_knowledge WHERE product_id=$1', [hidden])).rows).toEqual([]);
  });
});
