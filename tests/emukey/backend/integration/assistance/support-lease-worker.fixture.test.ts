import { describe, it } from 'vitest';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { NotificationRepository } from '../../../../../EmuKey/backend/src/modules/operations/infrastructure/notification.repository.js';
import { AssistanceSupportRepository } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/assistance-support.repository.js';
import { AssistanceSupportService } from '../../../../../EmuKey/backend/src/modules/assistance-support/assistance-support.service.js';
import { SupportLeaseScheduler } from '../../../../../EmuKey/backend/src/modules/assistance-support/worker/support-lease.scheduler.js';

// Keep the child independent of the parent HTTP/AI/knowledge integration suite.
// Its cold start must exercise worker recovery, not recompile unrelated modules.
describe.runIf(process.env.EMUKEY_SUPPORT_WORKER_FIXTURE === '1')('support worker subprocess fixture', () => {
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
