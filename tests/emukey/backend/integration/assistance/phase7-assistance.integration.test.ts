import { readFile } from 'node:fs/promises';
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

const runIntegration = process.env.RUN_PHASE7_INTEGRATION === 'true';

describe.skipIf(!runIntegration)('Phase 7 assistance PostgreSQL integration', () => {
  let client: Pool;
  let container: StartedPostgreSqlContainer;
  let repository: AssistanceSupportRepository;
  const customerId = '00000000-0000-4000-8000-000000000004';
  const supportId = '00000000-0000-4000-8000-000000000003';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg15').withDatabase('emukey_phase7').withUsername('emukey').withPassword('phase7-password').start();
    client = new Pool({ connectionString: container.getConnectionUri() });
    await client.query(await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8'));
    await client.query(`INSERT INTO users (id,email,password_hash,display_name,role,status,customer_type,email_verified_at) VALUES
      ($1,'phase7-customer@example.test','hash','Phase 7 Customer','CUSTOMER','ACTIVE','INDIVIDUAL',now()),
      ($2,'phase7-support@example.test','hash','Phase 7 Support','SUPPORT_STAFF','ACTIVE',NULL,NULL)`, [customerId, supportId]);
    repository = new AssistanceSupportRepository(client);
  }, 120_000);

  afterAll(async () => { await client?.end(); await container?.stop(); });

  it('rejects stale and simultaneous first publishes without replacing the winner', async () => {
    const providerId = '00000000-0000-4000-8000-000000000081';
    await client.query("INSERT INTO users (id,email,password_hash,display_name,role,status,organization_name,provider_chain_address,provider_chain_namespace) VALUES ($1,'knowledge@example.test','hash','Provider','PROVIDER_ADMIN','ACTIVE','Provider','0x1111111111111111111111111111111111111111','knowledge')", [providerId]);
    const product = await client.query<{ id: string }>("INSERT INTO products (provider_user_id,code,name) VALUES ($1,'guide','Guide') RETURNING id", [providerId]);
    const knowledge = new KnowledgeRepository(client);
    const actor = { sub: providerId, role: 'PROVIDER_ADMIN' as const, sessionVersion: 1 };
    const input = { productId: product.rows[0]!.id, logicalDocumentKey: 'guide', title: 'Guide', sourceType: 'FAQ', chunks: ['Help'] };
    const first = await knowledge.create(actor, input);
    const second = await knowledge.create(actor, input);
    await expect(knowledge.publish(actor, first.id, 9)).rejects.toThrow('KNOWLEDGE_VERSION_CONFLICT');
    const results = await Promise.allSettled([knowledge.publish(actor, first.id, 0), knowledge.publish(actor, second.id, 0)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: new Error('KNOWLEDGE_VERSION_CONFLICT') });
    const current = (await knowledge.list(actor)).find((document) => document.isCurrent);
    const loser = current?.id === first.id ? second : first;
    await expect(knowledge.publish(actor, loser.id, 0)).rejects.toThrow('KNOWLEDGE_VERSION_CONFLICT');
    await expect(knowledge.detail({ ...actor, sub: customerId }, first.id)).rejects.toThrow('KNOWLEDGE_DOCUMENT_NOT_FOUND');
    expect((await knowledge.list(actor)).filter((document) => document.isCurrent)).toHaveLength(1);
    const module = await Test.createTestingModule({ controllers: [KnowledgeController], providers: [{ provide: KnowledgeService, useValue: new KnowledgeService(knowledge) }] })
      .overrideGuard(AuthGuard).useValue({ canActivate(context: ExecutionContext) { context.switchToHttp().getRequest<{ user: typeof actor }>().user = actor; return true; } }).compile();
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
    const plan = await client.query<{ id: string }>("INSERT INTO plans (product_id,provider_user_id,code,version,name,billing_cycle,duration_months,price_vnd,max_active_devices,plan_commitment,status,published_at) VALUES ($1,$2,'retrieval',1,'Plan','MONTHLY',1,100000,1,decode(repeat('cd',32),'hex'),'PUBLISHED',now()) RETURNING id", [productId, providerId]);
    const planId = plan.rows[0]!.id;
    const order = await client.query<{ id: string }>(`INSERT INTO orders (order_number,idempotency_key,customer_user_id,provider_user_id,product_id,plan_id,order_type,provider_name_snapshot,product_name_snapshot,plan_name_snapshot,plan_version_snapshot,price_vnd_snapshot,billing_cycle_snapshot,duration_months_snapshot,max_active_devices_snapshot,plan_commitment_snapshot,payment_due_at,ipn_accept_until,service_terms_version_snapshot,service_terms_hash_snapshot,service_terms_content_snapshot)
      VALUES ('RETRIEVAL',gen_random_uuid(),$1,$2,$3,$4,'NEW_PURCHASE','Provider','Retrieval','Plan',1,100000,'MONTHLY',1,1,decode(repeat('cd',32),'hex'),now()+interval '30 minutes',now()+interval '1 hour','v1',repeat('a',64),'Test terms') RETURNING id`, [customerId, providerId, productId, planId]);
    const orderId = order.rows[0]!.id;
    const knowledge = new KnowledgeRepository(client);
    const actor = { sub: providerId, role: 'PROVIDER_ADMIN' as const, sessionVersion: 1 };
    const document = await knowledge.create(actor, { productId, logicalDocumentKey: 'retrieval', title: 'Private guide', sourceType: 'FAQ', chunks: ['Activation instructions'] });
    await knowledge.publish(actor, document.id, 0);
    const orderConversation = await repository.createConversation(customerId, { contextType: 'ORDER', contextId: orderId });
    const planConversation = await repository.createConversation(customerId, { contextType: 'PLAN', contextId: planId });
    const search = (conversationId: string, userId = customerId) => knowledge.searchForConversation({ conversationId, customerUserId: userId, question: 'Activation' });
    // Merely creating an order or selecting a public plan must not disclose private documents.
    expect(await search(orderConversation.id)).toEqual([]);
    expect(await search(planConversation.id)).toEqual([]);
    const commerce = new CommerceRepository(client);
    await commerce.acceptServiceTerms(customerId, orderId, { version: 'v1', hash: 'a'.repeat(64) });
    const checkout = await commerce.prepareCheckout(customerId, orderId);
    const occurredAt = (await client.query<{ at: Date }>('SELECT statement_timestamp() AS at')).rows[0]!.at;
    await commerce.ingestPayment({ amountVnd: 100000, protocolVersion: 1, eventId: 'retrieval-payment', occurredAt, providerReference: checkout.checkoutReference }, {}, {
      activationCommitment: `0x${'77'.repeat(32)}`, commandId: '00000000-0000-4000-8000-000000000085', licenseId: '00000000-0000-4000-8000-000000000086', payload: {}, payloadHash: `0x${'88'.repeat(32)}`,
    }, { chainId: 31337, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'hardhat' });
    expect(await search(orderConversation.id)).toMatchObject([{ content: 'Activation instructions' }]);
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
    const claims = await Promise.allSettled([repository.claimConversation(supportId, conversation.id), repository.claimConversation('00000000-0000-4000-8000-000000000002', conversation.id)]);
    expect(claims.filter((claim) => claim.status === 'fulfilled')).toHaveLength(1);
    expect((await repository.closeConversation({ role: 'SUPPORT_STAFF', sub: supportId }, conversation.id)).status).toBe('CLOSED');
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
    const plan = await client.query<{ id: string }>("INSERT INTO plans (product_id,provider_user_id,code,version,name,billing_cycle,duration_months,price_vnd,max_active_devices,plan_commitment,status,published_at) VALUES ($1,$2,'plan',1,'Plan','MONTHLY',1,100000,1,decode(repeat('ab',32),'hex'),'PUBLISHED',now()) RETURNING id", [product.rows[0]!.id, providerId]);
    const input = { contextType: 'PLAN' as const, contextId: plan.rows[0]!.id };
    await expect(repository.createConversation(customerId, input)).rejects.toThrow('CONVERSATION_CONTEXT_NOT_FOUND');
    await client.query("UPDATE products SET status='PUBLISHED',published_at=now() WHERE id=$1", [product.rows[0]!.id]);
    await expect(repository.createConversation(customerId, input)).resolves.toMatchObject(input);
    await client.query("UPDATE products SET status='ARCHIVED' WHERE id=$1", [product.rows[0]!.id]);
    await expect(repository.createConversation(customerId, input)).rejects.toThrow('CONVERSATION_CONTEXT_NOT_FOUND');
  });
});
