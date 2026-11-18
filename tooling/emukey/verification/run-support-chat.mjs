// Runs the real API/frontend against disposable services. No operational .env,
// database reset, paid provider call, blockchain worker or persistent volume.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { access, readFile, mkdtemp, writeFile, symlink } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
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
const nativeDemo = process.argv.includes('--native-demo');
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
  if (nativeDemo) {
    const previousDirectory = process.cwd();
    try {
      process.chdir(backend);
      const { readDatabaseSql } = await import(pathToFileURL(join(backend, 'dist/platform/database/database-cli.js')).href);
      const seed = await readDatabaseSql({ demo: true, seedOnly: true });
      await pool.query(seed.replace('BEGIN;', "BEGIN;\nSET LOCAL emukey.seed_environment='development';"));
    } finally { process.chdir(previousDirectory); }
  }
  const paginationId = randomUUID();
  const owner = (await pool.query('SELECT id FROM users WHERE email=$1', [nativeDemo ? 'customer01@demo.emukey.local' : 'customer@support.example.test'])).rows[0].id;
  await pool.query("INSERT INTO conversations(id,customer_user_id,title,status) VALUES ($1,$2,$3,'AI_ACTIVE')", [paginationId, owner, nativeDemo ? 'Android history 1000' : 'Long history fixture']);
  await pool.query(`INSERT INTO messages(conversation_id,sender_user_id,sender_type,client_message_id,server_sequence,content)
    SELECT $1,$2,'CUSTOMER',gen_random_uuid(),n,'History fixture '||n FROM generate_series(1,1000) n`, [paginationId, owner]);
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
  // Resolve canonical Terms from an isolated working directory. Nest's default
  // dotenv lookup must not read the operational backend .env for this fixture.
  await symlink(join(backend, 'config'), join(evidence, 'config'), process.platform === 'win32' ? 'junction' : 'dir');
  process.chdir(evidence);
  const { createApiApplication } = await import(pathToFileURL(join(backend, 'dist/entrypoints/api/create-api-application.js')).href);
  app = await createApiApplication({ logger: false });
  await app.listen(3317, '127.0.0.1');
  let activeLicense;
  if (nativeDemo) {
    const load = (path) => import(pathToFileURL(join(backend, 'dist', path)).href);
    const { CommerceService } = await load('modules/commerce-payment/application/commerce.service.js');
    const { CommerceRepository } = await load('modules/commerce-payment/infrastructure/commerce.repository.js');
    const { PAYMENT_GATEWAY } = await load('modules/commerce-payment/application/ports/payment-gateway.port.js');
    const { ACTIVATION_ENVELOPE } = await load('modules/blockchain/application/ports/activation-envelope.port.js');
    const { ActivationEnvelopeRecoveryService } = await load('modules/blockchain/application/activation-envelope-recovery.service.js');
    const { ChainCommandRepository } = await load('modules/blockchain/infrastructure/chain-command.repository.js');
    const { ChainEventRepository } = await load('modules/blockchain/infrastructure/chain-event.repository.js');
    const { NotificationRepository } = await load('modules/operations/infrastructure/notification.repository.js');
    const notifications = new NotificationRepository(pool);
    const chain = { network: 'sepolia', chainId: 11155111, contractAddress: process.env.EVM_CONTRACT_ADDRESS.toLowerCase() };
    // Controlled local payment/events qualify the native API boundary only.
    // No relayer, RPC call, SePay payment or third-party handoff is executed.
    const commerce = new CommerceService(new CommerceRepository(pool, 86400, notifications), app.get(PAYMENT_GATEWAY),
      app.get(ACTIVATION_ENVELOPE), app.get(ActivationEnvelopeRecoveryService), chain);
    const actor = { role: 'CUSTOMER', sessionVersion: 1, sub: owner };
    const planId = (await pool.query("SELECT p.id FROM plans p JOIN products pr ON pr.id=p.product_id WHERE p.status='PUBLISHED' AND pr.status='PUBLISHED' ORDER BY p.price_vnd,p.id LIMIT 1")).rows[0].id;
    const order = await commerce.createOrder(actor, randomUUID(), undefined, { planId });
    const terms = await commerce.getServiceTerms(actor, order.id);
    await commerce.acceptServiceTerms(actor, order.id, { accepted: true, version: terms.version, hash: terms.hash });
    const checkout = await commerce.checkout(actor, order.id);
    const occurredAt = (await pool.query("SELECT date_trunc('milliseconds',greatest(pa.created_at,o.service_terms_accepted_at))+interval '1 millisecond' AS at FROM payment_attempts pa JOIN orders o ON o.id=pa.order_id WHERE pa.id=$1", [checkout.attemptId])).rows[0].at;
    const paid = await commerce.ingestIpn({ amountVnd: order.priceVndSnapshot, eventId: randomUUID(), occurredAt: occurredAt.toISOString(), providerReference: checkout.checkoutReference }, process.env.PAYMENT_WEBHOOK_SECRET);
    if (paid.classification !== 'MATCHED' || !paid.commandId) throw new Error('NATIVE_FIXTURE_PAYMENT_NOT_MATCHED');
    const command = (await pool.query('SELECT * FROM chain_commands WHERE id=$1', [paid.commandId])).rows[0];
    const commands = new ChainCommandRepository(pool);
    const relayerAddress = `0x${'33'.repeat(20)}`, transactionHash = `0x${'31'.repeat(32)}`, blockHash = `0x${'32'.repeat(32)}`;
    const nonce = await commands.reserveNonce(command.id, relayerAddress, 0);
    await commands.markPrepared(command.id, { network: chain.network, nonce, relayerAddress, rawTransaction: '0x01', transactionHash });
    await commands.markSubmitted(command.id);
    await commands.markReceipt(command.id, { blockHash, blockNumber: 100, status: 'SUCCESS', transactionHash });
    const events = new ChainEventRepository(pool, notifications);
    const event = await events.ingest({ ...chain, blockHash, blockNumber: 100, chainCommandId: command.id, confirmationCount: 2,
      eventType: 'LICENSE_ISSUED', licenseId: paid.licenseId, logIndex: 0, payload: command.payload, providerUserId: command.provider_user_id, transactionHash });
    await events.confirm(event.id, 2, blockHash);
    activeLicense = (await pool.query('SELECT id,public_license_id,status FROM licenses WHERE id=$1', [paid.licenseId])).rows[0];
    if (activeLicense?.status !== 'ACTIVE') throw new Error('NATIVE_FIXTURE_LICENSE_NOT_ACTIVE');
  }
  const { createServer } = await import(pathToFileURL(requireFrontend.resolve('vite')).href);
  vite = await createServer({ root: frontend, configFile: join(frontend, 'vite.config.ts'), server: { host: '127.0.0.1', port: 5317, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:3317', changeOrigin: true } } } });
  await vite.listen();
  // Fixture metadata contains no credentials/tokens; only disposable test IDs.
  await writeFile(join(evidence, 'environment.json'), JSON.stringify({ database: 'emukey_support_e2e', api: 'http://127.0.0.1:3317', frontend: 'http://127.0.0.1:5317', externalAdapters: 'test-only fake; no Gemini qualification',
    ...(nativeDemo ? { nativeDemo: true, customerEmail: 'customer01@demo.emukey.local', fixtureLifetimeMinutes: 240, activeLicense, chainEvidence: 'CONTROLLED_FIXTURE; no external broadcast' } : {}) }, null, 2));
  console.log(`Support evidence: ${evidence}`);
  const specifications = process.argv.slice(2);
  // Native acceptance uses the same disposable fixture and real API. Creating
  // the printed stop file ends the session and releases every owned service.
  if (specifications.includes('--hold') || nativeDemo) {
    const stopFile = join(evidence, 'stop');
    const lifetimeMinutes = nativeDemo ? 240 : 60;
    console.log(`Native fixture ready; create ${stopFile} to stop (maximum ${lifetimeMinutes} minutes).`);
    const deadline = Date.now() + lifetimeMinutes * 60 * 1000;
    while (Date.now() < deadline) {
      if (await access(stopFile).then(() => true, () => false)) break;
      await setTimeout(1000);
    }
  } else {
  const child = spawn(process.execPath, [requireFrontend.resolve('@playwright/test/cli'), 'test', '--config', join(workspace, 'tooling/emukey/verification/playwright.frontend.config.mjs'), ...(specifications.length ? specifications : ['support-chat.spec.ts']), '--workers=1', '--reporter=list', '--output', join(evidence, 'results')], {
    cwd: frontend, windowsHide: true, stdio: 'inherit', env: { ...process.env, BASE_URL: 'http://127.0.0.1:5317', E2E_EXTERNAL: 'true', EMUKEY_SUPPORT_E2E: '1', SUPPORT_EVIDENCE_DIR: evidence, SUPPORT_FIXTURE_PASSWORD: password, SUPPORT_PAGINATION_ID: paginationId },
  });
  process.exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code ?? 1)); });
  }
} finally {
  await vite?.close(); await app?.close(); await pool?.end(); await redis?.stop(); await postgres?.stop();
  console.log(`Retained disposable test evidence: ${evidence}`);
}
