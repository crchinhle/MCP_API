import { NotificationRepository } from '../../../../../EmuKey/backend/src/modules/operations/infrastructure/notification.repository.js';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AssistanceSupportRepository } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/assistance-support.repository.js';
import { KnowledgeRepository } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/knowledge.repository.js';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { KnowledgeController } from '../../../../../EmuKey/backend/src/modules/assistance-support/knowledge.controller.js';
import { KnowledgeService } from '../../../../../EmuKey/backend/src/modules/assistance-support/knowledge.service.js';
import { AuthGuard } from '../../../../../EmuKey/backend/src/modules/identity-access/security.guards.js';
import { ApiExceptionFilter } from '../../../../../EmuKey/backend/src/platform/http/api-exception.filter.js';
import { CommerceRepository } from '../../../../../EmuKey/backend/src/modules/commerce-payment/infrastructure/commerce.repository.js';
import { AssistanceSupportController } from '../../../../../EmuKey/backend/src/modules/assistance-support/assistance-support.controller.js';
import { AssistanceSupportService } from '../../../../../EmuKey/backend/src/modules/assistance-support/assistance-support.service.js';
import { AiAssistanceService } from '../../../../../EmuKey/backend/src/modules/assistance-support/ai-assistance.service.js';
import { FakeAiGateway } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/fake-ai.gateway.js';
import { IdentityService } from '../../../../../EmuKey/backend/src/modules/identity-access/identity.service.js';
import type { AuthPrincipal } from '../../../../../EmuKey/backend/src/modules/identity-access/identity.types.js';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { SupportLeaseScheduler } from '../../../../../EmuKey/backend/src/modules/assistance-support/worker/support-lease.scheduler.js';

const supportWorkerFixture = process.env.EMUKEY_SUPPORT_WORKER_FIXTURE === '1';

describe.skipIf(supportWorkerFixture)('Phase 7 assistance PostgreSQL integration', () => {
  let client: Pool;
  let container: StartedPostgreSqlContainer;
  let repository: AssistanceSupportRepository;
  const customerId = '00000000-0000-4000-8000-000000000004';
  const supportId = '00000000-0000-4000-8000-000000000003';
  const otherSupportId = '00000000-0000-4000-8000-000000000005';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg15').withDatabase('emukey_phase7').withUsername('emukey').withPassword('phase7-password').start();
    client = new Pool({ connectionString: container.getConnectionUri() });
    await client.query(await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8'));
    await client.query(`INSERT INTO users (id,email,password_hash,display_name,role,status,customer_type,email_verified_at) VALUES
      ($1,'phase7-customer@example.test','hash','Phase 7 Customer','CUSTOMER','ACTIVE','INDIVIDUAL',now()),
      ($2,'phase7-support@example.test','hash','Phase 7 Support','SUPPORT_STAFF','ACTIVE',NULL,NULL),
      ($3,'phase7-support-b@example.test','hash','Phase 7 Support B','SUPPORT_STAFF','ACTIVE',NULL,NULL)`, [customerId, supportId, otherSupportId]);
    repository = new AssistanceSupportRepository(client, new NotificationRepository(client));
  }, 120_000);

  afterAll(async () => { await client?.end(); await container?.stop(); });

  it('requeues an abandoned conversation after SIGKILL and restart of the support lease worker', async () => {
    const conversation = await repository.createConversation(customerId, { title: 'Support worker crash' });
    await repository.requestSupport(customerId, conversation.id, 'Human help');
    const claim = await repository.claimConversation(supportId, conversation.id);
    const cache = await new RedisContainer('redis:8.2-alpine').start();
    const redis = new Redis(cache.getConnectionUrl());
    const children: Array<{ process: ReturnType<typeof spawn>; exited: Promise<void> }> = [];
    let diagnostics = '';
    const start = () => {
      const child = spawn(process.execPath, [resolve(process.cwd(), 'node_modules/vitest/vitest.mjs'), 'run', '--config',
        resolve(import.meta.dirname, '../../../../../tooling/emukey/verification/vitest.backend.config.ts'), fileURLToPath(import.meta.url),
        '--pool=threads', '--maxWorkers=1', '--testNamePattern=support lease child fixture', '--reporter=dot'], {
        cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
          EMUKEY_SUPPORT_WORKER_FIXTURE: '1', EMUKEY_SUPPORT_FIXTURE_PG: container.getConnectionUri(), EMUKEY_SUPPORT_FIXTURE_REDIS: cache.getConnectionUrl() },
      });
      child.stdout?.on('data', (data: Buffer) => { diagnostics = (diagnostics + data.toString()).slice(-1500); });
      child.stderr?.on('data', (data: Buffer) => { diagnostics = (diagnostics + data.toString()).slice(-1500); });
      const exited = new Promise<void>((resolve, reject) => { child.once('error', reject); child.once('close', () => resolve()); });
      const result = { process: child, exited }; children.push(result); return result;
    };
    try {
      const first = start();
      await expect.poll(() => redis.exists('emukey:worker:support-leases'), { timeout: 30_000 }).toBe(1);
      first.process.kill('SIGKILL'); await first.exited;
      // Advance only this test's lease while the scheduler process is dead.
      await client.query("UPDATE conversations SET claim_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [conversation.id]);
      await repository.appendMessage({ actorUserId: customerId, senderType: 'CUSTOMER', conversationId: conversation.id, clientMessageId: randomUUID(), content: 'Customer continues while worker is stopped' });
      expect((await repository.findConversationForActor({ sub: customerId, role: 'CUSTOMER' }, conversation.id))?.status).toBe('SUPPORT_ACTIVE');
      await redis.del('emukey:worker:support-leases');
      start();
      await expect.poll(() => redis.exists('emukey:worker:support-leases'), { timeout: 30_000 }).toBe(1);
      const queued = await repository.findConversationForActor({ sub: customerId, role: 'CUSTOMER' }, conversation.id);
      expect(queued).toMatchObject({ status: 'WAITING_SUPPORT', assignedSupportUserId: null, claimExpiresAt: null });
      const replacement = await repository.claimConversation(otherSupportId, conversation.id);
      expect(replacement.claimVersion).toBe(claim.claimVersion + 1);
      await expect(repository.heartbeat(supportId, conversation.id, claim.claimVersion)).rejects.toThrow('CONVERSATION_CLAIM_EXPIRED');
      expect((await repository.listMessages({ sub: customerId, role: 'CUSTOMER' }, conversation.id))?.filter((message) => message.content.includes('Support session expired'))).toHaveLength(1);
      await repository.closeConversation({ sub: otherSupportId, role: 'SUPPORT_STAFF' }, conversation.id, replacement.claimVersion);
    } catch (error) { throw new Error(`${String(error)}\nSupport worker fixture: ${diagnostics}`, { cause: error }); }
    finally {
      for (const child of children) { child.process.kill('SIGKILL'); await child.exited; }
      await redis.quit(); await cache.stop();
    }
  });

  it('enforces the support HTTP state, ownership, version and documented status matrix', async () => {
    // Credential lookup is a fixture; AuthGuard/RolesGuard, DTO validation,
    // application services and all conversation transactions remain real.
    const actors: Record<string, AuthPrincipal> = {
      customer: { sub: customerId, role: 'CUSTOMER', sessionVersion: 1 },
      outsider: { sub: '00000000-0000-4000-8000-000000000099', role: 'CUSTOMER', sessionVersion: 1 },
      staff: { sub: supportId, role: 'SUPPORT_STAFF', sessionVersion: 1 },
      otherStaff: { sub: otherSupportId, role: 'SUPPORT_STAFF', sessionVersion: 1 },
      provider: { sub: customerId, role: 'PROVIDER_ADMIN', sessionVersion: 1 },
    };
    const knowledge = new KnowledgeRepository(client);
    const ai = new AiAssistanceService(new FakeAiGateway(), {
      appendCustomerMessage: (input) => repository.appendCustomerMessage(input),
      appendAiMessage: (input) => repository.appendAiMessage(input),
      searchSources: (input) => knowledge.searchForConversation(input),
    });
    const module = await Test.createTestingModule({ controllers: [AssistanceSupportController], providers: [
      { provide: AssistanceSupportService, useValue: new AssistanceSupportService(repository, ai) },
      { provide: IdentityService, useValue: { authenticate: async (token: string) => { if (!actors[token]) throw new Error('Fixture bearer rejected'); return actors[token]; } } },
    ] }).compile();
    const app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = request(app.getHttpServer() as Server);
    try {
      await http.get('/conversations/queue').expect(401);
      await http.get('/conversations/queue').auth('invalid', { type: 'bearer' }).expect(401);
      await http.get('/conversations/queue').auth('customer', { type: 'bearer' }).expect(403);
      await http.post('/conversations').auth('provider', { type: 'bearer' }).send({}).expect(403);
      const created = await http.post('/conversations').auth('customer', { type: 'bearer' }).send({ title: 'HTTP support matrix' }).expect(201);
      const path = `/conversations/${created.body.id}`;
      await http.get(path).auth('outsider', { type: 'bearer' }).expect(404);
      await http.post(`${path}/ai-ask`).auth('customer', { type: 'bearer' }).send({ question: 'Help', clientMessageId: randomUUID() }).expect(200);
      await http.post(`${path}/request-support`).auth('customer', { type: 'bearer' }).send({ reason: 'Human help' }).expect(200);
      await http.post(`${path}/ai-ask`).auth('customer', { type: 'bearer' }).send({ question: 'Must stop AI', clientMessageId: randomUUID() }).expect(409);
      await http.get(`${path}/messages/queue-preview`).auth('staff', { type: 'bearer' }).expect(200);
      await http.post(`${path}/claim`).auth('customer', { type: 'bearer' }).send({}).expect(403);
      const claimed = await http.post(`${path}/claim`).auth('staff', { type: 'bearer' }).send({}).expect(200);
      const version = claimed.body.claimVersion as number;
      await http.post(`${path}/claim`).auth('otherStaff', { type: 'bearer' }).send({}).expect(409);
      for (const payload of [{}, { claimVersion: '1' }, { claimVersion: 0 }, { claimVersion: version, extra: true }]) {
        await http.post(`${path}/heartbeat`).auth('staff', { type: 'bearer' }).send(payload).expect(400);
      }
      await http.post(`${path}/heartbeat`).auth('otherStaff', { type: 'bearer' }).send({ claimVersion: version }).expect(409);
      await http.post(`${path}/heartbeat`).auth('staff', { type: 'bearer' }).send({ claimVersion: version }).expect(200);
      const body = { content: 'Reply', clientMessageId: randomUUID(), claimVersion: version };
      await http.post(`${path}/messages`).auth('staff', { type: 'bearer' }).send({ ...body, claimVersion: version + 1 }).expect(409);
      const sent = await http.post(`${path}/messages`).auth('staff', { type: 'bearer' }).send(body).expect(201);
      const retry = await http.post(`${path}/messages`).auth('staff', { type: 'bearer' }).send(body).expect(201);
      expect(retry.body.id).toBe(sent.body.id);
      await http.post(`${path}/messages`).auth('staff', { type: 'bearer' }).send({ ...body, content: 'Changed intent' }).expect(409);
      await http.post(`${path}/release`).auth('staff', { type: 'bearer' }).send({ claimVersion: version }).expect(200);
      await http.post(`${path}/release`).auth('staff', { type: 'bearer' }).send({ claimVersion: version }).expect(200);
      const replacement = await http.post(`${path}/claim`).auth('otherStaff', { type: 'bearer' }).send({}).expect(200);
      await http.post(`${path}/close`).auth('staff', { type: 'bearer' }).send({ claimVersion: version }).expect(409);
      await http.post(`${path}/messages`).auth('outsider', { type: 'bearer' }).send({ content: 'Intrusion', clientMessageId: randomUUID() }).expect(404);
      await http.post(`${path}/close`).auth('otherStaff', { type: 'bearer' }).send({ claimVersion: replacement.body.claimVersion }).expect(200);
      await http.post(`${path}/close`).auth('otherStaff', { type: 'bearer' }).send({ claimVersion: replacement.body.claimVersion }).expect(200);
      await http.post(`${path}/heartbeat`).auth('otherStaff', { type: 'bearer' }).send({ claimVersion: replacement.body.claimVersion }).expect(409);
      await http.post(`${path}/messages`).auth('customer', { type: 'bearer' }).send({ content: 'After close', clientMessageId: randomUUID() }).expect(409);
    } finally { await app.close(); }
  });

  it('enforces advertised file limits at the real multipart HTTP boundary', async () => {
    const providerId = '00000000-0000-4000-8000-000000000091';
    await client.query("INSERT INTO users(id,email,password_hash,display_name,role,status,organization_name,provider_chain_namespace) VALUES ($1,'upload@example.test','hash','Uploader','PROVIDER_ADMIN','ACTIVE','Uploader','upload')", [providerId]);
    const product = await client.query<{ id: string }>("INSERT INTO products(provider_user_id,code,name) VALUES ($1,'upload','Upload') RETURNING id", [providerId]);
    const storage = { get: async () => null, put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) };
    const knowledge = new KnowledgeRepository(client, storage);
    const module = await Test.createTestingModule({ controllers: [KnowledgeController], providers: [{ provide: KnowledgeService, useValue: new KnowledgeService(knowledge) }] })
      .overrideGuard(AuthGuard).useValue({ canActivate(context: ExecutionContext) {
        context.switchToHttp().getRequest().user = { sub: providerId, role: 'PROVIDER_ADMIN', sessionVersion: 1 }; return true;
      } }).compile();
    const app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    try {
      expect((await request(app.getHttpServer() as Server).get('/knowledge/capabilities').expect(200)).body).toMatchObject({ maxFileBytes: 10_485_760, allowedMimeTypes: ['application/pdf', 'text/plain'] });
      const upload = (bytes: number, logicalDocumentKey: string) => request(app.getHttpServer() as Server).post('/knowledge/documents')
        .field('productId', product.rows[0]!.id).field('logicalDocumentKey', logicalDocumentKey).field('title', 'Upload guide').field('sourceType', 'TXT')
        .attach('file', Buffer.alloc(bytes, 'a'), { filename: 'guide.txt', contentType: 'text/plain' });
      expect((await upload(1_500_000, 'within-limit').expect(201)).body.status).toBe('READY');
      await upload(10_485_761, 'over-limit').expect(413);
      await request(app.getHttpServer() as Server).post('/knowledge/documents')
        .field('productId', product.rows[0]!.id).field('logicalDocumentKey', 'invalid-type').field('title', 'Invalid file').field('sourceType', 'TXT')
        .attach('file', Buffer.alloc(100, 'a'), { filename: 'guide.exe', contentType: 'application/octet-stream' }).expect(400);
      expect(storage.put).toHaveBeenCalledTimes(1);
      expect((await client.query('SELECT id FROM knowledge_documents WHERE product_id=$1', [product.rows[0]!.id])).rows).toHaveLength(1);
    } finally { await app.close(); }
  });

  it('requeues abandoned claims and rejects stale staff heartbeats and replies', async () => {
    const conversation = await repository.createConversation(customerId, { title: 'Lease regression' });
    await repository.requestSupport(customerId, conversation.id, 'Need human help');
    const claimed = await repository.claimConversation(supportId, conversation.id);
    expect(claimed.claimVersion).toBeGreaterThan(0);
    await client.query("UPDATE conversations SET claim_expires_at=statement_timestamp()-interval '1 second' WHERE id=$1", [conversation.id]);
    await expect(repository.heartbeat(supportId, conversation.id, claimed.claimVersion!)).rejects.toThrow('CONVERSATION_CLAIM_EXPIRED');
    await repository.requeueExpiredClaims();
    expect((await repository.findConversationForActor({ role: 'CUSTOMER', sub: customerId }, conversation.id))?.status).toBe('WAITING_SUPPORT');
    const replacement = await repository.claimConversation(otherSupportId, conversation.id);
    expect(replacement.claimVersion).toBe(claimed.claimVersion + 1);
    await expect(repository.appendMessage({ actorUserId: supportId, conversationId: conversation.id, clientMessageId: '00000000-0000-4000-8000-000000000077', content: 'Late', senderType: 'SUPPORT', claimVersion: claimed.claimVersion! })).rejects.toThrow();
    await expect(repository.heartbeat(supportId, conversation.id, claimed.claimVersion)).rejects.toThrow('CONVERSATION_CLAIM_EXPIRED');
    await expect(repository.releaseConversation(supportId, conversation.id, claimed.claimVersion)).rejects.toThrow();
    await expect(repository.closeConversation({ role: 'SUPPORT_STAFF', sub: supportId }, conversation.id, claimed.claimVersion)).rejects.toThrow('CONVERSATION_CLOSE_NOT_ALLOWED');
    await repository.closeConversation({ role: 'SUPPORT_STAFF', sub: otherSupportId }, conversation.id, replacement.claimVersion);
  });

  it('retries a committed close without changing its version or admitting a stale staff claim', async () => {
    const conversation = await repository.createConversation(customerId, { title: 'Close response lost' });
    await repository.requestSupport(customerId, conversation.id, 'Human help');
    const claimed = await repository.claimConversation(supportId, conversation.id);
    const actor = { role: 'SUPPORT_STAFF' as const, sub: supportId };
    const closed = await Promise.all([
      repository.closeConversation(actor, conversation.id, claimed.claimVersion),
      repository.closeConversation(actor, conversation.id, claimed.claimVersion),
    ]);
    expect(closed[0]).toEqual(closed[1]);
    const before = (await client.query('SELECT version,closed_at FROM conversations WHERE id=$1', [conversation.id])).rows[0];
    await expect(repository.closeConversation(actor, conversation.id, claimed.claimVersion)).resolves.toMatchObject({ status: 'CLOSED' });
    expect((await client.query('SELECT version,closed_at FROM conversations WHERE id=$1', [conversation.id])).rows[0]).toEqual(before);
    await expect(repository.closeConversation(actor, conversation.id, claimed.claimVersion + 1)).rejects.toThrow('CONVERSATION_CLOSE_NOT_ALLOWED');
    await expect(repository.closeConversation({ role: 'CUSTOMER', sub: supportId }, conversation.id)).rejects.toThrow('CONVERSATION_CLOSE_NOT_ALLOWED');
    await expect(repository.heartbeat(supportId, conversation.id, claimed.claimVersion)).rejects.toThrow('CONVERSATION_CLAIM_EXPIRED');
  });

  it('retries release once and fences the old tab when the same agent claims again', async () => {
    const conversation = await repository.createConversation(customerId, { title: 'Release response lost' });
    await repository.requestSupport(customerId, conversation.id, 'Human help');
    const first = await repository.claimConversation(supportId, conversation.id);
    const released = await repository.releaseConversation(supportId, conversation.id, first.claimVersion);
    const before = (await client.query('SELECT version FROM conversations WHERE id=$1', [conversation.id])).rows[0];
    await expect(repository.releaseConversation(supportId, conversation.id, first.claimVersion)).resolves.toEqual(released);
    expect((await client.query('SELECT version FROM conversations WHERE id=$1', [conversation.id])).rows[0]).toEqual(before);
    const second = await repository.claimConversation(supportId, conversation.id);
    expect(second.claimVersion).toBe(first.claimVersion + 1);
    await expect(repository.releaseConversation(supportId, conversation.id, first.claimVersion)).rejects.toThrow('CONVERSATION_CLAIM_EXPIRED');
    await expect(repository.appendMessage({ actorUserId: supportId, senderType: 'SUPPORT', conversationId: conversation.id, clientMessageId: randomUUID(), content: 'Stale tab', claimVersion: first.claimVersion })).rejects.toThrow('CONVERSATION_CLAIM_EXPIRED');
    await repository.releaseConversation(supportId, conversation.id, second.claimVersion);
    const messages = await repository.listMessages({ role: 'CUSTOMER', sub: customerId }, conversation.id);
    expect(messages!.filter((message) => message.content.includes('released this conversation'))).toHaveLength(2);
    expect(messages!.filter((message) => message.content.includes('claimed this conversation'))).toHaveLength(2);
  });

  it('recovers successive abandoned claims once per generation with two sweepers', async () => {
    const conversation = await repository.createConversation(customerId, { title: 'Worker restart' });
    await repository.requestSupport(customerId, conversation.id, 'Human help');
    for (let generation = 0; generation < 2; generation += 1) {
      const claimed = await repository.claimConversation(supportId, conversation.id);
      await client.query("UPDATE conversations SET claim_expires_at=statement_timestamp()-interval '1 second' WHERE id=$1", [conversation.id]);
      await repository.appendMessage({ actorUserId: customerId, senderType: 'CUSTOMER', conversationId: conversation.id, clientMessageId: randomUUID(), content: 'Customer stays connected' });
      expect((await Promise.all([repository.requeueExpiredClaims(), new AssistanceSupportRepository(client, new NotificationRepository(client)).requeueExpiredClaims()])).sort()).toEqual([0, 1]);
      await expect(repository.heartbeat(supportId, conversation.id, claimed.claimVersion)).rejects.toThrow('CONVERSATION_CLAIM_EXPIRED');
    }
    const messages = await repository.listMessages({ role: 'CUSTOMER', sub: customerId }, conversation.id);
    expect(messages!.filter((message) => message.content.includes('Support session expired'))).toHaveLength(2);
  });

  it.each(['heartbeat', 'release', 'reply'] as const)('rejects %s when its row-lock wait crosses the lease expiry', async (action) => {
    const conversation = await repository.createConversation(customerId, { title: `Blocked ${action}` });
    await repository.requestSupport(customerId, conversation.id, 'Human help');
    const claimed = await repository.claimConversation(supportId, conversation.id);
    await client.query("UPDATE conversations SET claim_expires_at=clock_timestamp()+interval '2 seconds' WHERE id=$1", [conversation.id]);
    const blocker = await client.connect();
    let pending: Promise<{ accepted?: true; error?: string }> | undefined;
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM conversations WHERE id=$1 FOR UPDATE', [conversation.id]);
      const operation = action === 'heartbeat' ? repository.heartbeat(supportId, conversation.id, claimed.claimVersion)
        : action === 'release' ? repository.releaseConversation(supportId, conversation.id, claimed.claimVersion)
          : repository.appendMessage({ actorUserId: supportId, senderType: 'SUPPORT', conversationId: conversation.id, claimVersion: claimed.claimVersion, clientMessageId: randomUUID(), content: 'Delayed behind a row lock' });
      pending = operation.then(() => ({ accepted: true as const }), (error: Error) => ({ error: error.message }));
      await expect.poll(async () => Number((await client.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%conversations%'")).rows[0].count)).toBeGreaterThan(0);
      await client.query('SELECT pg_sleep(2.1)');
      await blocker.query('COMMIT');
      expect(await pending).toEqual({ error: 'CONVERSATION_CLAIM_EXPIRED' });
    } finally { await blocker.query('ROLLBACK'); blocker.release(); if (pending) await pending; }
  });

  it('rejects stale and simultaneous first publishes without replacing the winner', async () => {
    const providerId = '00000000-0000-4000-8000-000000000081';
    await client.query("INSERT INTO users (id,email,password_hash,display_name,role,status,organization_name,provider_chain_address,provider_chain_namespace) VALUES ($1,'knowledge@example.test','hash','Provider','PROVIDER_ADMIN','ACTIVE','Provider','0x1111111111111111111111111111111111111111','knowledge')", [providerId]);
    const product = await client.query<{ id: string }>("INSERT INTO products (provider_user_id,code,name) VALUES ($1,'guide','Guide') RETURNING id", [providerId]);
    const knowledge = new KnowledgeRepository(client);
    const actor = { sub: providerId, role: 'PROVIDER_ADMIN' as const, sessionVersion: 1 };
    const input = { productId: product.rows[0]!.id, logicalDocumentKey: 'guide', title: 'Guide', sourceType: 'FAQ', chunks: ['Help'] };
    const first = await knowledge.create(actor, input);
    const second = await knowledge.create(actor, input);
    const admin = { sub: supportId, role: 'SYSTEM_ADMIN' as const, sessionVersion: 1 };
    expect((await knowledge.list(admin)).map((document) => document.id)).toEqual(expect.arrayContaining([first.id, second.id]));
    await expect(knowledge.detail(admin, first.id)).resolves.toMatchObject({ providerUserId: providerId, chunks: ['Help'] });
    expect(await knowledge.list({ ...actor, sub: customerId })).toEqual([]);
    await expect(new KnowledgeService(knowledge).publish(actor, first.id, 0)).rejects.toMatchObject({ status: 403 });
    await expect(knowledge.publish(admin, first.id, 9)).rejects.toThrow('KNOWLEDGE_VERSION_CONFLICT');
    const results = await Promise.allSettled([knowledge.publish(admin, first.id, 0), knowledge.publish(admin, second.id, 0)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: new Error('KNOWLEDGE_VERSION_CONFLICT') });
    const current = (await knowledge.list(actor)).find((document) => document.isCurrent);
    const loser = current?.id === first.id ? second : first;
    await expect(knowledge.publish(admin, loser.id, 0)).rejects.toThrow('KNOWLEDGE_VERSION_CONFLICT');
    await expect(knowledge.detail({ ...actor, sub: customerId }, first.id)).rejects.toThrow('KNOWLEDGE_DOCUMENT_NOT_FOUND');
    expect((await knowledge.list(actor)).filter((document) => document.isCurrent)).toHaveLength(1);
    const module = await Test.createTestingModule({ controllers: [KnowledgeController], providers: [{ provide: KnowledgeService, useValue: new KnowledgeService(knowledge) }] })
      .overrideGuard(AuthGuard).useValue({ canActivate(context: ExecutionContext) { context.switchToHttp().getRequest<{ user: { sub: string; role: string; sessionVersion: number } }>().user = { ...actor, role: actor.role === 'PROVIDER_ADMIN' ? 'SYSTEM_ADMIN' : actor.role }; return true; } }).compile();
    const app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    try {
      const missing = await request(app.getHttpServer() as Server).get('/knowledge/documents/00000000-0000-4000-8000-000000000099').expect(404);
      expect(missing.body).toMatchObject({ error: { code: 'KNOWLEDGE_DOCUMENT_NOT_FOUND' } });
      const response = await request(app.getHttpServer() as Server).post(`/knowledge/documents/${loser.id}/publish`).send({ expectedCurrentVersion: 0 }).expect(409);
      expect(response.body).toMatchObject({ error: { code: 'KNOWLEDGE_VERSION_CONFLICT' } });
      await request(app.getHttpServer() as Server).post(`/knowledge/documents/${loser.id}/publish`).send({ expectedCurrentVersion: -1 }).expect(400);
      actor.role = 'CUSTOMER' as typeof actor.role;
      await request(app.getHttpServer() as Server).post(`/knowledge/documents/${loser.id}/publish`).send({ expectedCurrentVersion: 0 }).expect(403);
    } finally { await app.close(); }
  });

  it('retrieves ORDER and PLAN knowledge only within the customer entitlement and context', async () => {
    const providerId = '00000000-0000-4000-8000-000000000083';
    const otherCustomerId = '00000000-0000-4000-8000-000000000084';
    await client.query("INSERT INTO users (id,email,password_hash,display_name,role,status,organization_name,provider_chain_address,provider_chain_namespace) VALUES ($1,'retrieval@example.test','hash','Provider','PROVIDER_ADMIN','ACTIVE','Provider','0x3333333333333333333333333333333333333333','retrieval')", [providerId]);
    await client.query("INSERT INTO users (id,email,password_hash,display_name,role,status,customer_type,email_verified_at) VALUES ($1,'other-retrieval@example.test','hash','Other','CUSTOMER','ACTIVE','INDIVIDUAL',now())", [otherCustomerId]);
    const product = await client.query<{ id: string }>("INSERT INTO products (provider_user_id,code,name,status,published_at) VALUES ($1,'retrieval','Retrieval','PUBLISHED',now()) RETURNING id", [providerId]);
    const productId = product.rows[0]!.id;
    const plan = await client.query<{ id: string }>("INSERT INTO plans (product_id,code,version,name,duration_months,price_vnd,max_active_devices,plan_commitment,status,published_at) VALUES ($1,'retrieval',1,'Plan',1,100000,1,decode(repeat('cd',32),'hex'),'PUBLISHED',now()) RETURNING id", [productId]);
    const planId = plan.rows[0]!.id;
    const order = await client.query<{ id: string }>(`INSERT INTO orders (order_number,idempotency_key,customer_user_id,provider_user_id,product_id,plan_id,order_type,provider_name_snapshot,product_name_snapshot,plan_name_snapshot,plan_version_snapshot,price_vnd_snapshot,duration_months_snapshot,max_active_devices_snapshot,plan_commitment_snapshot,payment_due_at,ipn_accept_until,service_terms_version_snapshot,service_terms_hash_snapshot,service_terms_content_snapshot)
      VALUES ('RETRIEVAL',gen_random_uuid(),$1,$2,$3,$4,'NEW_PURCHASE','Provider','Retrieval','Plan',1,100000,1,1,decode(repeat('cd',32),'hex'),now()+interval '30 minutes',now()+interval '1 hour','v1',repeat('a',64),'Test terms') RETURNING id`, [customerId, providerId, productId, planId]);
    const orderId = order.rows[0]!.id;
    const knowledge = new KnowledgeRepository(client);
    const actor = { sub: providerId, role: 'PROVIDER_ADMIN' as const, sessionVersion: 1 };
    const document = await knowledge.create(actor, { productId, logicalDocumentKey: 'retrieval', title: 'Private guide', sourceType: 'FAQ', chunks: ['Activation instructions'] });
    await knowledge.publish(actor, document.id, 0);
    const reader = { sub: customerId, role: 'CUSTOMER' as const, sessionVersion: 1 };
    expect(await knowledge.list(reader)).toEqual([]);
    await expect(knowledge.detail(reader, document.id)).rejects.toThrow('KNOWLEDGE_DOCUMENT_NOT_FOUND');
    const orderConversation = await repository.createConversation(customerId, { contextType: 'ORDER', contextId: orderId });
    const planConversation = await repository.createConversation(customerId, { contextType: 'PLAN', contextId: planId });
    const search = (conversationId: string, userId = customerId) => knowledge.searchForConversation({ conversationId, customerUserId: userId, question: 'Activation' });
    // Merely creating an order or selecting a public plan must not disclose private documents.
    expect(await search(orderConversation.id)).toEqual([]);
    expect(await search(planConversation.id)).toEqual([]);
    const commerce = new CommerceRepository(client, 86_400, new NotificationRepository(client));
    await commerce.acceptServiceTerms(customerId, orderId, { version: 'v1', hash: 'a'.repeat(64) });
    const checkout = await commerce.prepareCheckout(customerId, orderId);
    const occurredAt = (await client.query<{ at: Date }>('SELECT statement_timestamp() AS at')).rows[0]!.at;
    await commerce.ingestPayment({ amountVnd: 100000, protocolVersion: 1, eventId: 'retrieval-payment', occurredAt, providerReference: checkout.checkoutReference }, {}, {
      activationCommitment: `0x${'77'.repeat(32)}`, commandId: '00000000-0000-4000-8000-000000000085', licenseId: '00000000-0000-4000-8000-000000000086', payload: {}, payloadHash: `0x${'88'.repeat(32)}`,
    }, { chainId: 11155111, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'sepolia' });
    expect(await search(orderConversation.id)).toMatchObject([{ content: 'Activation instructions' }]);
    const source = (await search(orderConversation.id))[0]!;
    expect(source).toMatchObject({ documentId: document.id, documentTitle: 'Private guide', documentVersion: 1, chunkIndex: 0 });
    await expect(knowledge.chunk(reader, document.id, source.id)).resolves.toMatchObject({ content: 'Activation instructions', documentVersion: 1 });
    await expect(knowledge.chunk({ ...reader, sub: otherCustomerId }, document.id, source.id)).rejects.toThrow('KNOWLEDGE_DOCUMENT_NOT_FOUND');
    const citation = { documentId: document.id, documentTitle: 'Private guide', documentVersion: 1, chunkId: source.id, chunkIndex: 0, excerpt: 'Activation instructions' };
    const aiInput = { conversationId: orderConversation.id, clientMessageId: '00000000-0000-4000-8000-000000000092', content: 'Grounded answer', citedSourceIds: [source.id], grounded: true, citationDetails: [citation] };
    const answer = await repository.appendAiMessage(aiInput);
    expect(answer.citationDetails).toEqual([citation]);
    expect((await repository.appendAiMessage({ ...aiInput, citationDetails: [] })).citationDetails).toEqual([citation]);
    expect((await knowledge.list(reader)).map((guide) => guide.id)).toContain(document.id);
    await expect(knowledge.detail(reader, document.id)).resolves.toMatchObject({ chunks: ['Activation instructions'] });
    const draft = await knowledge.create(actor, { productId, logicalDocumentKey: 'retrieval', title: 'New private guide', sourceType: 'FAQ', chunks: ['Unapproved instructions'] });
    expect((await knowledge.list(reader)).map((guide) => guide.id)).not.toContain(draft.id);
    await expect(knowledge.detail(reader, draft.id)).rejects.toThrow('KNOWLEDGE_DOCUMENT_NOT_FOUND');
    await expect(knowledge.detail({ ...reader, sub: otherCustomerId }, document.id)).rejects.toThrow('KNOWLEDGE_DOCUMENT_NOT_FOUND');
    expect(await search(planConversation.id)).toMatchObject([{ content: 'Activation instructions' }]);
    expect(await search(orderConversation.id, otherCustomerId)).toEqual([]);
    await expect(repository.createConversation(otherCustomerId, { contextType: 'ORDER', contextId: orderId })).rejects.toThrow('CONVERSATION_CONTEXT_NOT_FOUND');
    const otherPlanConversation = await repository.createConversation(otherCustomerId, { contextType: 'PLAN', contextId: planId });
    expect(await search(otherPlanConversation.id, otherCustomerId)).toEqual([]);
  });

  it('creates, appends idempotently, claims concurrently, and closes a conversation', async () => {
    const conversation = await repository.createConversation(customerId, { title: 'Phase 7 real flow' });
    const first = await repository.appendMessage({ actorUserId: customerId, clientMessageId: '00000000-0000-4000-8000-000000000701', content: 'Xin hỗ trợ', conversationId: conversation.id, senderType: 'CUSTOMER' });
    const duplicate = await repository.appendMessage({ actorUserId: customerId, clientMessageId: first.clientMessageId, content: 'Xin hỗ trợ', conversationId: conversation.id, senderType: 'CUSTOMER' });
    expect(duplicate.id).toBe(first.id);
    await expect(repository.appendMessage({ actorUserId: customerId, clientMessageId: first.clientMessageId, content: 'Changed retry', conversationId: conversation.id, senderType: 'CUSTOMER' })).rejects.toThrow('CONVERSATION_MESSAGE_CONFLICT');
    const claims = await Promise.allSettled([repository.claimConversation(supportId, conversation.id), repository.claimConversation(otherSupportId, conversation.id)]);
    expect(claims.filter((claim) => claim.status === 'fulfilled')).toHaveLength(1);
    const winner = claims.find((claim) => claim.status === 'fulfilled')!;
    if (winner.status !== 'fulfilled') throw new Error('Missing claim winner');
    expect((await repository.closeConversation({ role: 'SUPPORT_STAFF', sub: winner.value.assignedSupportUserId! }, conversation.id, winner.value.claimVersion)).status).toBe('CLOSED');
  });

  it('rejects new AI messages after a conversation closes or enters the support queue', async () => {
    const closed = await repository.createConversation(customerId, {});
    const question = { conversationId: closed.id, customerUserId: customerId, clientMessageId: '00000000-0000-4000-8000-000000000091', content: 'Original question' };
    const first = await repository.appendCustomerMessage(question);
    expect((await repository.appendCustomerMessage(question)).id).toBe(first.id);
    await expect(repository.appendCustomerMessage({ ...question, content: 'Different question' })).rejects.toThrow('CONVERSATION_MESSAGE_CONFLICT');
    await repository.closeConversation({ role: 'CUSTOMER', sub: customerId }, closed.id);
    await expect(repository.appendCustomerMessage({ conversationId: closed.id, customerUserId: customerId, clientMessageId: '00000000-0000-4000-8000-000000000087', content: 'Should not send' })).rejects.toThrow('CONVERSATION_CLOSED');
    const waiting = await repository.createConversation(customerId, {});
    await repository.appendMessage({ conversationId: waiting.id, actorUserId: customerId, senderType: 'CUSTOMER', clientMessageId: '00000000-0000-4000-8000-000000000088', content: 'Human help' });
    await expect(repository.appendCustomerMessage({ conversationId: waiting.id, customerUserId: customerId, clientMessageId: '00000000-0000-4000-8000-000000000089', content: 'AI question' })).rejects.toThrow('CONVERSATION_STATE_INVALID');
    await expect(repository.appendAiMessage({ conversationId: waiting.id, clientMessageId: '00000000-0000-4000-8000-000000000090', content: 'Delayed AI answer', grounded: false, citedSourceIds: [] })).rejects.toThrow('CONVERSATION_STATE_INVALID');
  });

  it('rejects PLAN context when its product is not public', async () => {
    const providerId = '00000000-0000-4000-8000-000000000082';
    await client.query("INSERT INTO users (id,email,password_hash,display_name,role,status,organization_name,provider_chain_address,provider_chain_namespace) VALUES ($1,'context@example.test','hash','Provider','PROVIDER_ADMIN','ACTIVE','Provider','0x2222222222222222222222222222222222222222','context')", [providerId]);
    const product = await client.query<{ id: string }>("INSERT INTO products (provider_user_id,code,name) VALUES ($1,'context','Context') RETURNING id", [providerId]);
    const plan = await client.query<{ id: string }>("INSERT INTO plans (product_id,code,version,name,duration_months,price_vnd,max_active_devices,plan_commitment,status,published_at) VALUES ($1,'plan',1,'Plan',1,100000,1,decode(repeat('ab',32),'hex'),'PUBLISHED',now()) RETURNING id", [product.rows[0]!.id]);
    const input = { contextType: 'PLAN' as const, contextId: plan.rows[0]!.id };
    await expect(repository.createConversation(customerId, input)).rejects.toThrow('CONVERSATION_CONTEXT_NOT_FOUND');
    await client.query("UPDATE products SET status='PUBLISHED',published_at=now() WHERE id=$1", [product.rows[0]!.id]);
    await expect(repository.createConversation(customerId, input)).resolves.toMatchObject(input);
    await client.query("UPDATE products SET status='ARCHIVED' WHERE id=$1", [product.rows[0]!.id]);
    await expect(repository.createConversation(customerId, input)).rejects.toThrow('CONVERSATION_CONTEXT_NOT_FOUND');
  });
});

describe.runIf(supportWorkerFixture)('support worker subprocess fixture', () => {
  it('support lease child fixture', async () => {
    const database = new URL(process.env.EMUKEY_SUPPORT_FIXTURE_PG!);
    const cache = new URL(process.env.EMUKEY_SUPPORT_FIXTURE_REDIS!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) || database.pathname !== '/emukey_phase7' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(cache.hostname)) throw new Error('Disposable local support fixture required');
    const pool = new Pool({ connectionString: database.href });
    const redis = new Redis(cache.href);
    await pool.query('SELECT 1');
    await redis.ping();
    process.stdout.write('Support worker fixture connected to disposable PostgreSQL/Redis\n');
    const service = new AssistanceSupportService(new AssistanceSupportRepository(pool, new NotificationRepository(pool)));
    const scheduler = new SupportLeaseScheduler(service, redis);
    scheduler.onModuleInit();
    try { await new Promise<void>((resolve) => setTimeout(resolve, 45_000)); }
    finally { scheduler.onModuleDestroy(); await redis.quit(); await pool.end(); }
  }, 60_000);
});
