import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from 'pg';

const exec = promisify(execFile);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('BLOCKED_EXTERNAL: DATABASE_URL is not configured');
  process.exitCode = 2;
} else {
  const queryCounts = async () => {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      const result = await client.query(
        `SELECT
          (SELECT count(*)::text FROM users) users,
          (SELECT count(*)::text FROM orders) orders,
          (SELECT count(*)::text FROM licenses) licenses,
          (SELECT count(*)::text FROM chain_commands) commands,
          (SELECT count(*)::text FROM chain_events) events`,
      );
      return result.rows[0];
    } finally {
      await client.end();
    }
  };
  const before = await queryCounts();
  const redisContainer = process.env.REDIS_CONTAINER_NAME ?? 'emukey-redis-1';
  await exec('docker', ['stop', redisContainer]);
  await exec('docker', ['start', redisContainer]);
  const after = await queryCounts();
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  console.log(JSON.stringify({ status: unchanged ? 'REDIS_LOSS_VERIFIED' : 'FAIL', durableBefore: before, durableAfter: after }, null, 2));
  if (!unchanged) process.exitCode = 1;
}
