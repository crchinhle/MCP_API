import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NotificationRepository } from '../../../../../EmuKey/backend/src/modules/operations/infrastructure/notification.repository.js';

const runIntegration = process.env.RUN_PHASE7_INTEGRATION === 'true';

describe.skipIf(!runIntegration)('Phase 7 notification PostgreSQL integration', () => {
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
    redisContainer = await new RedisContainer('redis:7-alpine').start();
  }, 120_000);

  afterAll(async () => { await redisContainer?.stop(); await client?.end(); await container?.stop(); });

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
    await repository.markSent(first!.id, 'CLAIMED_BY:device-worker');
    const second = await repository.claimNext('device-worker-2');
    expect(second?.pushToken).not.toBe(first?.pushToken);
    await repository.registerPushToken(other, second!.pushToken!, 'FCM');
    await repository.markSent(second!.id, 'CLAIMED_BY:device-worker-2');
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
    await repository.markDeliveryFailure(claimed!.id, 'provider unavailable', false, 'CLAIMED_BY:phase7-worker', 1);
    await client.query(`UPDATE notification_deliveries SET next_attempt_at = now() - interval '1 second' WHERE id = $1`, [claimed!.id]);
    const retry = await repository.claimNext('phase7-worker-2', 1);
    expect(retry?.id).toBe(claimed!.id);
    await repository.markDeliveryFailure(claimed!.id, 'permanent provider failure', true, 'CLAIMED_BY:phase7-worker-2');
    expect((await client.query<{ delivery_status: string }>('SELECT delivery_status FROM notification_deliveries WHERE id = $1', [claimed!.id])).rows[0]?.delivery_status).toBe('DEAD_LETTER');
    await redisContainer.executeCliCmd('SET', ['phase7:lease', 'worker-1', 'EX', '1']);
    expect(await redisContainer.executeCliCmd('GET', ['phase7:lease'])).toContain('worker-1');
    await redisContainer.executeCliCmd('DEL', ['phase7:lease']);
    expect((await redisContainer.executeCliCmd('GET', ['phase7:lease'])).trim()).toBe('');
  });
});
