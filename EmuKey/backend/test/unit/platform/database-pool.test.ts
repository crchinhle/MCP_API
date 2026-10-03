import type { ConfigService } from '@nestjs/config';

import { DatabasePool } from '../../../src/platform/database/database-pool.js';
import { RedisClient } from '../../../src/platform/redis/redis-client.js';

describe('DatabasePool', () => {
  it('uses the validated DATABASE_URL and closes exactly once on shutdown', async () => {
    const getOrThrow = vi
      .fn()
      .mockReturnValue(
        'postgresql://emukey:password@127.0.0.1:5432/emukey',
      );
    const config = { getOrThrow } as unknown as ConfigService;
    const pool = new DatabasePool(config);
    const end = vi.spyOn(pool, 'end').mockResolvedValue(undefined);

    await pool.onApplicationShutdown();

    expect(getOrThrow).toHaveBeenCalledWith('DATABASE_URL');
    expect(end.mock.calls).toHaveLength(1);
  });

  it('handles idle PostgreSQL connection errors instead of crashing the worker', () => {
    const config = {
      getOrThrow: vi
        .fn()
        .mockReturnValue('postgresql://emukey:password@127.0.0.1:5432/emukey'),
    } as unknown as ConfigService;
    const pool = new DatabasePool(config);

    expect(pool.listenerCount('error')).toBeGreaterThan(0);
    expect(() => pool.emit('error', Object.assign(new Error('connection lost'), { code: 'ECONNRESET' }))).not.toThrow();
    void pool.end();
  });
});

describe('RedisClient', () => {
  it('uses the validated REDIS_URL and disconnects exactly once on shutdown', () => {
    const getOrThrow = vi.fn().mockReturnValue('redis://127.0.0.1:6379');
    const config = { getOrThrow } as unknown as ConfigService;
    const redis = new RedisClient(config);
    const disconnect = vi.spyOn(redis, 'disconnect');

    redis.onApplicationShutdown();

    expect(getOrThrow).toHaveBeenCalledWith('REDIS_URL');
    expect(disconnect.mock.calls).toHaveLength(1);
  });
});
