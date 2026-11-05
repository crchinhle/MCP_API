import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, onTestFailed, vi } from 'vitest';
import { NotificationRepository } from '../../../../../EmuKey/backend/src/modules/operations/infrastructure/notification.repository.js';
import { NotificationProcessor, NOTIFICATION_QUEUE } from '../../../../../EmuKey/backend/src/modules/operations/worker/notification.processor.js';
import { NotificationScheduler } from '../../../../../EmuKey/backend/src/modules/operations/worker/notification.scheduler.js';
import { RedisClient } from '../../../../../EmuKey/backend/src/platform/redis/redis-client.js';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { NotificationController } from '../../../../../EmuKey/backend/src/modules/operations/presentation/notification.controller.js';
import { NotificationService } from '../../../../../EmuKey/backend/src/modules/operations/application/notification.service.js';
import { IdentityService } from '../../../../../EmuKey/backend/src/modules/identity-access/identity.service.js';
import { ApiExceptionFilter } from '../../../../../EmuKey/backend/src/platform/http/api-exception.filter.js';

const childFixture = process.env.EMUKEY_NOTIFICATION_WORKER_FIXTURE === '1';

describe.skipIf(childFixture)('Phase 7 notification PostgreSQL integration', () => {
  let client: Pool;
  let repository: NotificationRepository;
  let redisContainer: StartedRedisContainer;
  let container: StartedPostgreSqlContainer;
  const userId = '00000000-0000-4000-8000-000000000004';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg15').withDatabase('emukey_phase7_notifications').withUsername('emukey').withPassword('phase7-password').start();
    client = new Pool({ connectionString: container.getConnectionUri() });
    await client.query(await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8'));
    await client.query(`INSERT INTO users (id,email,password_hash,display_name,role,status,customer_type,email_verified_at) VALUES ($1,'phase7-notify@example.test','hash','Phase 7 Notification','CUSTOMER','ACTIVE','INDIVIDUAL',now())`, [userId]);
    repository = new NotificationRepository(client);
    // Keep the endpoint stable across Docker restarts, as the product's Redis
    // service address is. Docker may reassign a randomly published host port.
    const reservation = createServer();
    await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve));
    const port = (reservation.address() as { port: number }).port;
    await new Promise<void>((resolve) => reservation.close(() => resolve()));
    redisContainer = await new RedisContainer('redis:7-alpine').withExposedPorts({ container: 6379, host: port }).start();
  }, 120_000);

  afterAll(async () => { await redisContainer?.stop(); await client?.end(); await container?.stop(); });

  it('paginates all 45 unread notifications through HTTP without losing PostgreSQL timestamp precision', async () => {
    const owner = '00000000-0000-4000-8000-000000000008';
    await client.query(`INSERT INTO users(id,email,password_hash,display_name,role,status,customer_type,email_verified_at)
      VALUES ($1,'notification-pages@example.test','hash','Pages','CUSTOMER','ACTIVE','INDIVIDUAL',now())`, [owner]);
    for (let index = 0; index < 45; index += 1) await repository.create({ channel: 'IN_APP', userId: owner,
      eventKey: `http-pages:${index}`, title: `Page ${index}`, content: 'Page fixture', data: {}, type: 'SYSTEM' });
    await client.query("UPDATE notifications SET created_at='2026-11-02T00:00:00.123456Z'::timestamptz WHERE user_id=$1", [owner]);
    const module = await Test.createTestingModule({ controllers: [NotificationController], providers: [
      { provide: NotificationService, useValue: new NotificationService(repository) },
      { provide: IdentityService, useValue: { authenticate: async (token: string) => ({ sub: token === 'owner' ? owner : userId, role: 'CUSTOMER', sessionVersion: 1 }) } },
    ] }).compile();
    const app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new ApiExceptionFilter()); await app.init();
    const http = request(app.getHttpServer() as Server);
    try {
      const first = (await http.get('/notifications').auth('owner', { type: 'bearer' }).expect(200)).body;
      expect(first.items).toHaveLength(20); expect(first.unreadCount).toBe(45);
      expect(first.items[0]).toMatchObject({ createdAt: expect.any(String), target: null });
      const second = (await http.get('/notifications').query({ limit: '20', cursor: first.nextCursor }).auth('owner', { type: 'bearer' }).expect(200)).body;
      const third = (await http.get('/notifications').query({ limit: '20', cursor: second.nextCursor }).auth('owner', { type: 'bearer' }).expect(200)).body;
      expect(second.items).toHaveLength(20); expect(third.items).toHaveLength(5); expect(third.nextCursor).toBeNull();
      expect(new Set([...first.items, ...second.items, ...third.items].map((item: { id: string }) => item.id)).size).toBe(45);
      const legacyCursor = JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString('utf8'));
      legacyCursor.createdAt = new Date(legacyCursor.createdAt).toISOString();
      const legacy = Buffer.from(JSON.stringify(legacyCursor)).toString('base64url');
      const legacyPage = (await http.get('/notifications').query({ limit: '20', cursor: legacy }).auth('owner', { type: 'bearer' }).expect(200)).body;
      expect(legacyPage.items.map((item: { id: string }) => item.id)).toEqual(second.items.map((item: { id: string }) => item.id));
      for (const value of ['0', '51', 'abc', '1.5', ['20', '21']]) await http.get('/notifications').query({ limit: value }).auth('owner', { type: 'bearer' }).expect(400);
      await http.get('/notifications').query({ cursor: 'invalid' }).auth('owner', { type: 'bearer' }).expect(400);
      const id = first.items[0].id;
      await http.get(`/notifications/${id}`).auth('other', { type: 'bearer' }).expect(404);
      await http.post(`/notifications/${id}/read`).auth('other', { type: 'bearer' }).send({}).expect(404);
      await http.post(`/notifications/${id}/read`).auth('owner', { type: 'bearer' }).send({}).expect(200);
      await http.post(`/notifications/${id}/read`).auth('owner', { type: 'bearer' }).send({}).expect(200);
      expect((await http.get('/notifications').auth('owner', { type: 'bearer' }).expect(200)).body.unreadCount).toBe(44);
    } finally { await app.close(); }
  });

  it('polls expiry safely on an empty license set and counts unread items across cursor pages', async () => {
    expect(await repository.createExpiryReminders()).toBe(0);
    expect(await repository.createExpiryReminders()).toBe(0);
    for (let index = 0; index < 3; index += 1) await repository.create({ channel: 'IN_APP', content: 'Page', data: {}, eventKey: `pages:${index}`, title: 'Page', type: 'SYSTEM', userId });
    const first = await repository.list(userId, { limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.unreadCount).toBe(3);
    const second = await repository.list(userId, { limit: 1, cursor: first.nextCursor! });
    expect(second.unreadCount).toBe(3);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    await repository.markRead(userId, second.items[0]!.id);
    expect((await repository.list(userId, { limit: 1 })).unreadCount).toBe(2);
  });

  it('rolls back a notification intent with its caller transaction', async () => {
    const transaction=await client.connect();
    try {
      await transaction.query('BEGIN');
      await repository.enqueueInTransaction(transaction,{channel:'IN_APP',type:'SUPPORT_REPLY',title:'Rollback',content:'Rollback',data:{conversationId:'not-sent'},eventKey:'rollback-intent',userId});
      await transaction.query('ROLLBACK');
      expect((await client.query("SELECT id FROM notifications WHERE event_key='rollback-intent'")).rows).toEqual([]);
    }finally{transaction.release();}
  });

  it('sends independently to each device and cancels stale ownership', async () => {
    const other = '00000000-0000-4000-8000-000000000005';
    await client.query(`INSERT INTO users (id,email,password_hash,display_name,role,status,customer_type,email_verified_at)
      VALUES ($1,'other@example.test','hash','Other','CUSTOMER','ACTIVE','INDIVIDUAL',now())`, [other]);
    await repository.registerPushToken(userId, 'device-token-a', 'FCM');
    await repository.registerPushToken(userId, 'device-token-b', 'FCM');
    const input = { channel: 'IN_APP' as const, content: 'Ready', data: {}, eventKey: 'multi-device', title: 'Ready', type: 'LICENSE_CONFIRMED', userId };
    const notice = await repository.create(input);
    await repository.create(input);
    const deliveries = await client.query('SELECT * FROM notification_deliveries WHERE notification_id=$1', [notice.id]);
    expect(deliveries.rows).toHaveLength(2);
    const first = await repository.claimNext('device-worker');
    expect(first?.channel).toBe('PUSH');
    await repository.markSent(first!.id, first!.leaseOwner);
    const second = await repository.claimNext('device-worker-2');
    expect(second?.pushToken).not.toBe(first?.pushToken);
    await repository.registerPushToken(other, second!.pushToken!, 'FCM');
    await repository.markSent(second!.id, second!.leaseOwner);
    expect((await client.query('SELECT delivery_status FROM notification_deliveries WHERE id=$1', [second!.id])).rows[0].delivery_status).toBe('CANCELLED');
    expect((await repository.list(userId, { limit: 50 })).items.filter((item) => item.id === notice.id)).toHaveLength(1);
    await repository.markRead(userId, notice.id);
    expect((await repository.list(userId, { limit: 50 })).items.find((item) => item.id === notice.id)?.isRead).toBe(true);
    expect(await repository.markRead(other, notice.id)).toBeNull();
  });

  it('persists idempotently, leases delivery, retries and dead-letters', async () => {
    const input = { channel: 'EMAIL' as const, content: 'Phase 7', data: { phase: 7 }, eventKey: 'phase7:notification:1', title: 'Phase 7', type: 'PHASE7', userId };
    const first = await repository.create(input);
    const duplicate = await repository.create(input);
    expect(duplicate.id).toBe(first.id);
    const claimed = await repository.claimNext('phase7-worker', 1);
    expect(claimed?.deliveryStatus).toBe('RETRYABLE_FAILED');
    expect(claimed?.attemptCount).toBe(1);
    await repository.markDeliveryFailure(claimed!.id, 'provider unavailable', false, claimed!.leaseOwner, 1);
    await client.query(`UPDATE notification_deliveries SET next_attempt_at = now() - interval '1 second' WHERE id = $1`, [claimed!.id]);
    const retry = await repository.claimNext('phase7-worker-2', 1);
    expect(retry?.id).toBe(claimed!.id);
    await repository.markDeliveryFailure(claimed!.id, 'permanent provider failure', true, retry!.leaseOwner);
    expect((await client.query<{ delivery_status: string }>('SELECT delivery_status FROM notification_deliveries WHERE id = $1', [claimed!.id])).rows[0]?.delivery_status).toBe('DEAD_LETTER');
    await redisContainer.executeCliCmd('SET', ['phase7:lease', 'worker-1', 'EX', '1']);
    expect(await redisContainer.executeCliCmd('GET', ['phase7:lease'])).toContain('worker-1');
    await redisContainer.executeCliCmd('DEL', ['phase7:lease']);
    expect((await redisContainer.executeCliCmd('GET', ['phase7:lease'])).trim()).toBe('');
  });

  it('fences an expired attempt when BullMQ redelivers the same job ID', async () => {
    const notice = await repository.create({ channel: 'EMAIL', content: 'Lease fence', data: {}, eventKey: 'lease-fence', title: 'Lease fence', type: 'TEST', userId });
    const first = await repository.claimNext('same-bullmq-job', 1);
    expect(first?.notificationId).toBe(notice.id);
    const firstOwner = (await client.query('SELECT lease_owner FROM notification_deliveries WHERE id=$1', [first!.id])).rows[0].lease_owner;
    await client.query('SELECT pg_sleep(1.1)');
    const retry = await repository.claimNext('same-bullmq-job', 30);
    expect(retry?.id).toBe(first!.id);
    const retryOwner = (await client.query('SELECT lease_owner FROM notification_deliveries WHERE id=$1', [first!.id])).rows[0].lease_owner;
    expect(retryOwner).not.toBe(firstOwner);
    await repository.markSent(first!.id, firstOwner);
    await repository.markDeliveryFailure(first!.id, 'late response', true, firstOwner);
    await repository.cancelDelivery(first!.id, firstOwner);
    expect((await client.query('SELECT delivery_status,lease_owner FROM notification_deliveries WHERE id=$1', [first!.id])).rows[0])
      .toMatchObject({ delivery_status: 'RETRYABLE_FAILED', lease_owner: retryOwner });
    await repository.markSent(retry!.id, retryOwner);
    expect((await client.query('SELECT delivery_status FROM notification_deliveries WHERE id=$1', [first!.id])).rows[0].delivery_status).toBe('SENT');
  });

  it('recovers the same BullMQ job after a process is killed with a vendor receipt unacknowledged', async () => {
    const input = { channel: 'EMAIL' as const, content: 'Crash fixture', data: {}, eventKey: 'process-crash-recovery', title: 'Crash fixture', type: 'TEST', userId };
    const notice = await repository.create(input);
    const requests: Array<{ eventKey: string; leaseOwner: string }> = [];
    const effects = new Set<string>();
    let acknowledge = false;
    const vendor = createServer((request, response) => {
      void (async () => {
        let body = '';
        for await (const chunk of request) body += chunk.toString();
        const { eventKey } = JSON.parse(body) as { eventKey: string };
        const claim = await client.query('SELECT lease_owner FROM notification_deliveries WHERE notification_id=$1', [notice.id]);
        effects.add(eventKey); // Local idempotent vendor fixture, not real email delivery.
        requests.push({ eventKey, leaseOwner: claim.rows[0].lease_owner });
        if (acknowledge) { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ providerMessageId: 'fixture-receipt' })); }
      })().catch((error: unknown) => { response.statusCode = 500; response.end(String(error)); });
    });
    await new Promise<void>((resolve) => vendor.listen(0, '127.0.0.1', resolve));
    const vendorPort = (vendor.address() as { port: number }).port;
    const redis = new Redis(redisContainer.getConnectionUrl(), { maxRetriesPerRequest: null });
    const prefix = `worker-crash-${notice.id}`;
    const queue = new Queue(NOTIFICATION_QUEUE, { connection: redis, prefix });
    let diagnostics = '';
    const children: Array<{ process: ReturnType<typeof spawn>; exited: Promise<void> }> = [];
    const startWorker = () => {
      const child = spawn(process.execPath, [resolve(process.cwd(), 'node_modules/vitest/vitest.mjs'), 'run', '--config',
        resolve(import.meta.dirname, '../../../../../tooling/emukey/verification/vitest.backend.config.ts'), fileURLToPath(import.meta.url),
        '--pool=threads', '--maxWorkers=1', '--testNamePattern=worker crash child fixture', '--reporter=dot'], {
        cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
          EMUKEY_NOTIFICATION_WORKER_FIXTURE: '1', EMUKEY_NOTIFICATION_FIXTURE_PG: container.getConnectionUri(),
          EMUKEY_NOTIFICATION_FIXTURE_REDIS: redisContainer.getConnectionUrl(), EMUKEY_NOTIFICATION_FIXTURE_PREFIX: prefix,
          EMUKEY_NOTIFICATION_FIXTURE_VENDOR: `http://127.0.0.1:${vendorPort}`, },
      });
      child.stdout?.on('data', (data: Buffer) => { diagnostics = (diagnostics + data.toString()).slice(-1500); });
      child.stderr?.on('data', (data: Buffer) => { diagnostics = (diagnostics + data.toString()).slice(-1500); });
      const exited = new Promise<void>((resolve, reject) => { child.once('error', reject); child.once('close', () => resolve()); });
      const worker = { process: child, exited };
      children.push(worker);
      return worker;
    };
    try {
      await queue.add('poll-postgres', {}, { jobId: 'same-job-after-crash' });
      const first = startWorker();
      await expect.poll(() => requests.length, { timeout: 45_000, message: 'First worker must reach the local vendor' }).toBe(1);
      expect((await client.query('SELECT delivery_status FROM notification_deliveries WHERE notification_id=$1', [notice.id])).rows[0].delivery_status).toBe('RETRYABLE_FAILED');
      first.process.kill('SIGKILL');
      await first.exited;
      acknowledge = true;
      startWorker();
      await expect.poll(async () => (await client.query('SELECT delivery_status FROM notification_deliveries WHERE notification_id=$1', [notice.id])).rows[0].delivery_status,
        { timeout: 45_000, message: 'Replacement worker must finish the stalled job' }).toBe('SENT');
      expect(requests).toHaveLength(2);
      expect(requests[0].eventKey).toBe(requests[1].eventKey);
      expect(requests[0].leaseOwner).not.toBe(requests[1].leaseOwner);
      expect(effects.size).toBe(1);
      expect((await client.query('SELECT attempt_count FROM notification_deliveries WHERE notification_id=$1', [notice.id])).rows[0].attempt_count).toBe(2);
      expect((await repository.create(input)).id).toBe(notice.id);
      await expect.poll(() => queue.getCompletedCount(), { timeout: 5000 }).toBe(1);
    } catch (error) { throw new Error(`${String(error)}\nWorker fixture: ${diagnostics}`, { cause: error }); }
    finally {
      for (const child of children) { child.process.kill('SIGKILL'); await child.exited; }
      await queue.close(); await redis.quit();
      vendor.closeAllConnections();
      await new Promise<void>((resolve) => vendor.close(() => resolve()));
    }
  });

  it('does not call a vendor after the database claim has expired', async () => {
    const notice = await repository.create({ channel: 'EMAIL', content: 'Expired worker', data: {}, eventKey: 'expired-worker', title: 'Expired worker', type: 'TEST', userId });
    const claimNext = repository.claimNext.bind(repository);
    const claim = vi.spyOn(repository, 'claimNext').mockImplementationOnce(async (...args) => {
      const row = await claimNext(...args);
      expect(row?.notificationId).toBe(notice.id);
      await client.query("UPDATE notification_deliveries SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [row!.id]);
      return row;
    });
    const email = { deliver: vi.fn().mockResolvedValue({ providerMessageId: 'should-not-send' }) };
    try {
      await new NotificationProcessor(repository, email, {} as never, new ConfigService(), { set: async () => 'OK' } as never).process({ id: 'expired-job' } as never);
      expect(email.deliver).not.toHaveBeenCalled();
      expect((await client.query('SELECT delivery_status FROM notification_deliveries WHERE notification_id=$1', [notice.id])).rows[0].delivery_status).toBe('CANCELLED');
    } finally { claim.mockRestore(); }
  });

  it('backs off an HTTP timeout and dead-letters the same durable delivery at the configured limit', async () => {
    const notice = await repository.create({ channel: 'EMAIL', content: 'Timeout fixture', data: {}, eventKey: 'http-timeout', title: 'Timeout fixture', type: 'TEST', userId });
    let requests = 0;
    const vendor = createServer((_request, _response) => { requests += 1; });
    await new Promise<void>((resolve) => vendor.listen(0, '127.0.0.1', resolve));
    const port = (vendor.address() as { port: number }).port;
    const email = { deliver: async () => { await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(100) }); return { providerMessageId: 'unreachable' }; } };
    const config = new ConfigService({ NOTIFICATION_LEASE_SECONDS: 30, NOTIFICATION_MAX_ATTEMPTS: 2, NOTIFICATION_RETRY_BASE_SECONDS: 1 });
    const heartbeat = { set: async () => 'OK' };
    try {
      await new NotificationProcessor(repository, email, {} as never, config, heartbeat as never).process({ id: 'timeout-first' } as never);
      const failed = (await client.query('SELECT * FROM notification_deliveries WHERE notification_id=$1', [notice.id])).rows[0];
      expect(failed).toMatchObject({ delivery_status: 'RETRYABLE_FAILED', attempt_count: 1, lease_owner: null });
      expect(failed.next_attempt_at.getTime()).toBeGreaterThan(failed.updated_at.getTime());
      await new NotificationProcessor(repository, email, {} as never, config, heartbeat as never).process({ id: 'too-soon' } as never);
      expect(requests).toBe(1);
      await client.query('SELECT pg_sleep(1.1)');
      await new NotificationProcessor(new NotificationRepository(client), email, {} as never, config, heartbeat as never).process({ id: 'timeout-retry' } as never);
      expect((await client.query('SELECT delivery_status,attempt_count,next_attempt_at FROM notification_deliveries WHERE notification_id=$1', [notice.id])).rows)
        .toEqual([{ delivery_status: 'DEAD_LETTER', attempt_count: 2, next_attempt_at: null }]);
      expect(requests).toBe(2);
    } finally { vendor.closeAllConnections(); await new Promise<void>((resolve) => vendor.close(() => resolve())); }
  });
  it('rebuilds the poller after Redis loses its queue state and restarts without replaying durable outcomes', async () => {
    // Every Redis mutation below targets the disposable container owned by this suite.
    const config = new ConfigService({ REDIS_URL: redisContainer.getConnectionUrl() });
    const heartbeat = new RedisClient(config);
    heartbeat.on('error', () => undefined);
    const connection = new Redis(redisContainer.getConnectionUrl(), { maxRetriesPerRequest: null });
    connection.on('error', () => undefined);
    const queue = new Queue(NOTIFICATION_QUEUE, { connection, prefix: 'redis-restore-drill' });
    queue.on('error', () => undefined);
    const email = { deliver: vi.fn().mockResolvedValue({ providerMessageId: 'local-receipt' }) };
    const processor = new NotificationProcessor(repository, email, {} as never, config, heartbeat);
    const worker = new Worker(NOTIFICATION_QUEUE, (job) => processor.process(job), { connection, prefix: 'redis-restore-drill' });
    worker.on('error', () => undefined);
    const scheduler = new NotificationScheduler(queue, repository, heartbeat);
    const create = (suffix: string) => repository.create({ channel: 'EMAIL', content: 'Recovery drill', data: {},
      eventKey: `redis-restore:${suffix}`, title: 'Recovery drill', type: 'TEST', userId });
    const status = async (id: string) => (await client.query('SELECT delivery_status FROM notification_deliveries WHERE notification_id=$1', [id])).rows[0].delivery_status;
    let stage = 'connect';
    onTestFailed(() => console.error('Redis recovery drill failed', { stage, heartbeat: heartbeat.status, queueConnection: connection.status, redisPort: redisContainer.getPort() }));
    try {
      await heartbeat.ping();
      await worker.waitUntilReady();
      const sent = await create('sent');
      stage = 'register poller';
      await scheduler.onModuleInit();
      await expect.poll(() => status(sent.id), { timeout: 10_000 }).toBe('SENT');
      stage = 'pause worker';
      await worker.pause();
      stage = 'prepare durable outcomes';
      const dead = await create('dead-letter');
      const claim = await repository.claimNext('restore-dead-letter');
      expect(claim?.notificationId).toBe(dead.id);
      await repository.markDeliveryFailure(claim!.id, 'TEST_PERMANENT_FAILURE', true, claim!.leaseOwner);
      const retry = await create('retry');
      const retryClaim = await repository.claimNext('restore-retry');
      expect(retryClaim?.notificationId).toBe(retry.id);
      await repository.markDeliveryFailure(retryClaim!.id, 'TEST_TRANSIENT_FAILURE', false, retryClaim!.leaseOwner, 300);
      const retryBefore = (await client.query('SELECT attempt_count,next_attempt_at FROM notification_deliveries WHERE id=$1', [retryClaim!.id])).rows[0];
      const pending = await create('pending');
      expect(await queue.getJobSchedulersCount()).toBe(1);
      stage = 'persist empty Redis';
      await heartbeat.flushdb();
      await heartbeat.save();
      stage = 'restart disposable Redis';
      await redisContainer.restart();
      stage = 'wait for reconnect';
      await expect.poll(() => heartbeat.status, { timeout: 6_000 }).toBe('ready');
      stage = 'wait for restored poller';
      await expect.poll(() => queue.getJobSchedulersCount(), { timeout: 6_000 }).toBe(1);
      await expect.poll(() => heartbeat.exists('emukey:worker:expiry'), { timeout: 6_000 }).toBe(1);
      stage = 'resume worker';
      await worker.resume();
      stage = 'deliver pending intent';
      await expect.poll(() => status(pending.id), { timeout: 10_000 }).toBe('SENT');
      expect(await status(sent.id)).toBe('SENT');
      expect(await status(dead.id)).toBe('DEAD_LETTER');
      expect(await status(retry.id)).toBe('RETRYABLE_FAILED');
      expect((await client.query('SELECT attempt_count,next_attempt_at FROM notification_deliveries WHERE id=$1', [retryClaim!.id])).rows[0]).toEqual(retryBefore);
      expect(email.deliver.mock.calls.map(([request]) => request.eventKey)).toEqual(['redis-restore:sent', 'redis-restore:pending']);
      await client.query("UPDATE notification_deliveries SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE id=$1", [retryClaim!.id]);
      stage = 'deliver due retry';
      await expect.poll(() => status(retry.id), { timeout: 10_000 }).toBe('SENT');
      expect(email.deliver.mock.calls.map(([request]) => request.eventKey)).toEqual(['redis-restore:sent', 'redis-restore:pending', 'redis-restore:retry']);
      expect((await client.query('SELECT attempt_count FROM notification_deliveries WHERE id=$1', [retryClaim!.id])).rows[0].attempt_count).toBe(2);
      expect((await client.query('SELECT event_key FROM notifications WHERE event_key LIKE $1', ['redis-restore:%'])).rows).toHaveLength(4);
    } finally {
      stage = `cleanup after ${stage}`;
      scheduler.onModuleDestroy();
      await worker.close(true);
      await queue.close();
      connection.disconnect();
      heartbeat.onApplicationShutdown();
    }
  });
});

describe.runIf(childFixture)('notification subprocess fixture', () => {
  it('worker crash child fixture', async () => {
    const database = new URL(process.env.EMUKEY_NOTIFICATION_FIXTURE_PG!);
    const vendor = new URL(process.env.EMUKEY_NOTIFICATION_FIXTURE_VENDOR!);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) || database.pathname !== '/emukey_phase7_notifications' || vendor.hostname !== '127.0.0.1') {
      throw new Error('Disposable local fixture required');
    }
    const pool = new Pool({ connectionString: database.href });
    const redis = new Redis(process.env.EMUKEY_NOTIFICATION_FIXTURE_REDIS!, { maxRetriesPerRequest: null });
    const email = { deliver: async ({ eventKey }: { eventKey: string }) => {
      const response = await fetch(vendor, { method: 'POST', body: JSON.stringify({ eventKey }), signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error('LOCAL_VENDOR_ERROR');
      return response.json() as Promise<{ providerMessageId: string }>;
    } };
    const config = new ConfigService({ NOTIFICATION_LEASE_SECONDS: 1 });
    const processor = new NotificationProcessor(new NotificationRepository(pool), email, { deliver: async () => { throw new Error('No push in this fixture'); } }, config, redis);
    const worker = new Worker(NOTIFICATION_QUEUE, (job) => processor.process(job), {
      connection: redis, prefix: process.env.EMUKEY_NOTIFICATION_FIXTURE_PREFIX!, lockDuration: 1000, stalledInterval: 500,
    });
    try {
      await worker.waitUntilReady();
      await new Promise<void>((resolve, reject) => {
        worker.once('completed', () => resolve()); worker.once('failed', (_job, error) => reject(error)); worker.once('error', reject);
      });
    } finally { await worker.close(true); await redis.quit(); await pool.end(); }
  }, 90_000);
});
