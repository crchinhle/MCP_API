// Runs the real API/frontend against disposable services. No operational .env,
// database reset, paid provider call, blockchain worker or persistent volume.
import { createRequire } from 'node:module';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const workspace = resolve(import.meta.dirname, '../../..');
const backend = join(workspace, 'EmuKey/backend');
const frontend = join(workspace, 'EmuKey/frontend');
const requireBackend = createRequire(join(backend, 'package.json'));
const requireFrontend = createRequire(join(frontend, 'package.json'));
const { PostgreSqlContainer } = requireBackend('@testcontainers/postgresql');
const { RedisContainer } = requireBackend('@testcontainers/redis');
const { Pool } = requireBackend('pg');
const { hash } = requireBackend('argon2');
const evidence = await mkdtemp(join(tmpdir(), 'emukey-support-chat-'));
let postgres, redis, pool, app, vite;
const password = 'Support-fixture-2026!';
try {
  postgres = await new PostgreSqlContainer('pgvector/pgvector:pg15').withDatabase('emukey_support_e2e').start();
  redis = await new RedisContainer('redis:8.2-alpine').start();
  pool = new Pool({ connectionString: postgres.getConnectionUri() });
  await pool.query(await readFile(join(backend, 'database/schema.sql'), 'utf8'));
  const passwordHash = await hash(password);
  for (const [name, role] of [['customer', 'CUSTOMER'], ['staff-a', 'SUPPORT_STAFF'], ['staff-b', 'SUPPORT_STAFF'], ['outsider', 'CUSTOMER'], ['admin', 'SYSTEM_ADMIN']]) {
    await pool.query(`INSERT INTO users(email,password_hash,display_name,role,status,customer_type,email_verified_at)
      VALUES ($1,$2,$3,$4::varchar,'ACTIVE',CASE WHEN $4::varchar='CUSTOMER' THEN 'INDIVIDUAL' END,now())`, [`${name}@support.example.test`, passwordHash, name, role]);
  }
  Object.assign(process.env, {
    NODE_ENV: 'test', DATABASE_URL: postgres.getConnectionUri(), AI_RETRIEVAL_DATABASE_URL: postgres.getConnectionUri(), REDIS_URL: redis.getConnectionUrl(),
    PORT: '3317', CORS_ORIGINS: 'http://127.0.0.1:5317', LOG_LEVEL: 'error', OTEL_ENABLED: 'false',
    AI_ADAPTER: 'fake', EMAIL_ADAPTER: 'fake', PUSH_ADAPTER: 'fake', PAYMENT_ADAPTER: 'fake', PAYMENT_WEBHOOK_SECRET: 'disposable-support-webhook',
    STORAGE_ADAPTER: 'local', ACTIVATION_ENVELOPE_ADAPTER: 'redis', ACTIVATION_ENVELOPE_KEY: '34'.repeat(32),
    JWT_SECRET: 'disposable-support-secret-at-least-32-characters', EVM_ADAPTER: 'viem', EVM_NETWORK: 'sepolia', EVM_CHAIN_ID: '11155111',
    EVM_CONFIRMATIONS: '2', EVM_CONTRACT_ADDRESS: '0x4d30200F3D0791e0aE34Fa6075A4e4b03f4d1cBC', EVM_DEPLOYMENT_BLOCK: '11842365',
    EVM_INDEXER_BATCH_SIZE: '500', EVM_RPC_HTTP_URL: 'http://127.0.0.1:1', EVM_RPC_FALLBACK_HTTP_URL: '', EVM_RELAYER_PRIVATE_KEY: `0x${'11'.repeat(32)}`,
    EVM_NAMESPACE_CONTRACT_ADDRESS: '', EVM_NAMESPACE_DEPLOYMENT_BLOCK: '', WEB_APP_URL: 'http://127.0.0.1:5317',
  });
  const { createApiApplication } = await import(pathToFileURL(join(backend, 'dist/entrypoints/api/create-api-application.js')).href);
  app = await createApiApplication({ logger: false });
  await app.listen(3317, '127.0.0.1');
  const { createServer } = await import(pathToFileURL(requireFrontend.resolve('vite')).href);
  vite = await createServer({ root: frontend, configFile: join(frontend, 'vite.config.ts'), server: { host: '127.0.0.1', port: 5317, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:3317', changeOrigin: true } } } });
  await vite.listen();
  // Fixture metadata contains no credentials/tokens; only disposable test IDs.
  await writeFile(join(evidence, 'environment.json'), JSON.stringify({ database: 'emukey_support_e2e', api: 'http://127.0.0.1:3317', frontend: 'http://127.0.0.1:5317', externalAdapters: 'test-only fake; no Gemini qualification' }, null, 2));
  console.log(`Support evidence: ${evidence}`);
  const specifications = process.argv.slice(2);
  const child = spawn(process.execPath, [requireFrontend.resolve('@playwright/test/cli'), 'test', '--config', join(workspace, 'tooling/emukey/verification/playwright.frontend.config.mjs'), ...(specifications.length ? specifications : ['support-chat.spec.ts']), '--workers=1', '--reporter=list', '--output', join(evidence, 'results')], {
    cwd: frontend, windowsHide: true, stdio: 'inherit', env: { ...process.env, BASE_URL: 'http://127.0.0.1:5317', E2E_EXTERNAL: 'true', EMUKEY_SUPPORT_E2E: '1', SUPPORT_EVIDENCE_DIR: evidence, SUPPORT_FIXTURE_PASSWORD: password },
  });
  process.exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
} finally {
  await vite?.close(); await app?.close(); await pool?.end(); await redis?.stop(); await postgres?.stop();
  console.log(`Retained disposable test evidence: ${evidence}`);
}
