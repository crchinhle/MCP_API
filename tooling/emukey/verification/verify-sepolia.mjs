import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { Pool } from 'pg';
import { createPublicClient, http } from 'viem';
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';

const product = resolve(import.meta.dirname, '../../../EmuKey/backend');
const reportPath = resolve(import.meta.dirname, '../../../docs/emukey/traceability/sepolia-lifecycle-evidence.json');
const report = { generatedAt: new Date().toISOString(), status: 'RUNNING', chainId: 11155111,
  database: 'disposable PostgreSQL/Redis containers', payment: 'isolated test payment adapter; real commerce application path',
  blockchain: 'real Sepolia RPC only', timeline: {} };
let postgres, redis, pool, app;
let stage = 'configuration';
try {
  const required = ['EVM_RPC_HTTP_URL', 'EVM_RELAYER_PRIVATE_KEY', 'EVM_CONTRACT_ADDRESS', 'EVM_DEPLOYMENT_BLOCK'];
  if (required.some((name) => !process.env[name]?.trim())) throw new Error('SEPOLIA_CONFIGURATION_MISSING');
  const metadata = JSON.parse(await readFile(resolve(product, 'contracts/deployments/sepolia-v3.json'), 'utf8'));
  const address = process.env.EVM_CONTRACT_ADDRESS;
  assert.equal(address.toLowerCase(), metadata.contractAddress.toLowerCase());
  assert.equal(Number(process.env.EVM_DEPLOYMENT_BLOCK), metadata.deploymentBlock);
  assert.equal(process.env.EVM_NETWORK, 'sepolia');
  assert.equal(Number(process.env.EVM_CHAIN_ID), 11155111);
  const account = privateKeyToAccount(process.env.EVM_RELAYER_PRIVATE_KEY);
  for (let addressIndex = 0; addressIndex < 20; addressIndex++) {
    assert.notEqual(account.address, mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex }).address);
  }
  const client = createPublicClient({ cacheTime: 0, transport: http(process.env.EVM_RPC_HTTP_URL, { timeout: 20_000, retryCount: 1 }) });
  assert.equal(await client.getChainId(), 11155111);
  const artifact = JSON.parse(await readFile(resolve(product, 'contracts/artifacts/solidity/LicenseRegistry.sol/LicenseRegistry.json'), 'utf8'));
  assert.equal(await client.getCode({ address }), artifact.deployedBytecode);
  const deploymentReceipt = await client.getTransactionReceipt({ hash: metadata.deploymentTransaction });
  assert.equal(deploymentReceipt.status, 'success');
  assert.equal(Number(deploymentReceipt.blockNumber), metadata.deploymentBlock);
  assert.equal(deploymentReceipt.contractAddress.toLowerCase(), address.toLowerCase());
  const role = await client.readContract({ address, abi: artifact.abi, functionName: 'RELAYER_ROLE' });
  assert.equal(await client.readContract({ address, abi: artifact.abi, functionName: 'hasRole', args: [role, account.address] }), true);
  report.contractAddress = address;
  report.deploymentBlock = metadata.deploymentBlock;
  report.relayerAddress = account.address;

  stage = 'isolated_application';
  postgres = await new PostgreSqlContainer('pgvector/pgvector:pg15').withDatabase('emukey_sepolia_smoke').start();
  redis = await new RedisContainer('redis:8.2-alpine').start();
  pool = new Pool({ connectionString: postgres.getConnectionUri() });
  await pool.query(await readFile(resolve(product, 'database/schema.sql'), 'utf8'));
  const { seedBaseline } = await import('../../../EmuKey/backend/dist/platform/database/seed-baseline.js');
  await seedBaseline(pool, randomBytes(24).toString('hex'));
  Object.assign(process.env, {
    NODE_ENV: 'test', DATABASE_URL: postgres.getConnectionUri(), REDIS_URL: redis.getConnectionUrl(),
    PORT: '3100', CORS_ORIGINS: 'http://localhost:5173', LOG_LEVEL: 'fatal', OTEL_ENABLED: 'false',
    PAYMENT_ADAPTER: 'fake', PAYMENT_WEBHOOK_SECRET: randomBytes(32).toString('hex'), SEPAY_SANDBOX_RECEIPT_TIMING: 'false',
    AI_ADAPTER: 'fake', EMAIL_ADAPTER: 'fake', PUSH_ADAPTER: 'fake', STORAGE_ADAPTER: 'local',
    EVM_ADAPTER: 'viem', EVM_CONFIRMATIONS: '2', EVM_INDEXER_BATCH_SIZE: '500',
    ACTIVATION_ENVELOPE_ADAPTER: 'redis', ACTIVATION_ENVELOPE_KEY: randomBytes(32).toString('hex'), JWT_SECRET: randomBytes(32).toString('hex'),
  });
  const { createApiApplication } = await import('../../../EmuKey/backend/dist/entrypoints/api/create-api-application.js');
  const { CommerceService } = await import('../../../EmuKey/backend/dist/modules/commerce-payment/application/commerce.service.js');
  const { ChainCommandService } = await import('../../../EmuKey/backend/dist/modules/blockchain/application/chain-command.service.js');
  const { CHAIN_RPC_INDEXER } = await import('../../../EmuKey/backend/dist/modules/blockchain/application/rpc-chain-indexer.service.js');
  const { LicenseQueryService } = await import('../../../EmuKey/backend/dist/modules/blockchain/application/license-query.service.js');
  app = await createApiApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1`;
  const post = async (path, body, expected = 201) => {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    // Never include response bodies: activation secrets and JWTs can appear there.
    if (response.status !== expected) throw new Error(`HTTP_${response.status}_${path.replaceAll('/', '_').replaceAll('-', '_').toUpperCase()}`);
    return result;
  };
  const commerce = app.get(CommerceService);
  const commands = app.get(ChainCommandService);
  const indexer = app.get(CHAIN_RPC_INDEXER);
  const queries = app.get(LicenseQueryService);
  const customer = { role: 'CUSTOMER', sessionVersion: 1, sub: '00000000-0000-4000-8000-000000000004' };
  const other = { ...customer, sub: '00000000-0000-4000-8000-000000000099' };
  stage = 'commerce';
  const order = await commerce.createOrder(customer, randomUUID(), undefined, { planId: '00000000-0000-4000-8000-000000000301' });
  const terms = await commerce.getServiceTerms(customer, order.id);
  await commerce.acceptServiceTerms(customer, order.id, { accepted: true, hash: terms.hash, version: terms.version });
  const checkout = await commerce.checkout(customer, order.id);
  const payment = await commerce.ingestIpn({ amountVnd: order.priceVndSnapshot, eventId: randomUUID(),
    occurredAt: new Date().toISOString(), providerReference: checkout.checkoutReference }, process.env.PAYMENT_WEBHOOK_SECRET);
  assert.ok(payment.commandId && payment.licenseId);
  const licenseId = payment.licenseId;
  report.orderId = order.id;
  report.licenseId = licenseId;

  const settle = async (commandId, deviceSync = false) => {
    assert.equal(await commands.processNext('sepolia-smoke-relayer'), commandId);
    const command = (await pool.query('SELECT status, transaction_hash FROM chain_commands WHERE id=$1', [commandId])).rows[0];
    assert.equal(command.status, 'SUBMITTED');
    if (deviceSync) report.timeline.T2_submitted = new Date().toISOString();
    console.log(`Sepolia ${deviceSync ? 'device sync' : 'issue'} submitted: ${command.transaction_hash}`);
    const receipt = await client.waitForTransactionReceipt({ hash: command.transaction_hash, confirmations: 2, timeout: 240_000 });
    assert.equal(receipt.status, 'success');
    if (deviceSync) report.timeline.T3_confirmed = new Date().toISOString();
    await commands.reconcileReceipt('sepolia-smoke-receipt');
    let event;
    for (let attempt = 0; attempt < 90; attempt++) {
      await indexer.poll('sepolia-smoke-indexer');
      event = (await pool.query('SELECT event_type, finality_status, block_number, transaction_hash FROM chain_events WHERE chain_command_id=$1', [commandId])).rows[0];
      if (event?.finality_status === 'CONFIRMED') break;
      await delay(2_000);
    }
    assert.equal(event?.finality_status, 'CONFIRMED');
    assert.equal(event.transaction_hash, receipt.transactionHash);
    if (deviceSync) report.timeline.T4_indexed = new Date().toISOString();
    return { commandId, transactionHash: receipt.transactionHash, receipt: receipt.status, confirmations: 2,
      blockNumber: Number(receipt.blockNumber), event: event.event_type, finality: event.finality_status };
  };

  stage = 'issue_license';
  report.issue = await settle(payment.commandId);
  assert.equal((await queries.find(customer, licenseId)).status, 'ACTIVE');
  report.issue.projection = 'ACTIVE';
  await assert.rejects(queries.find(other, licenseId), { status: 404 });
  await assert.rejects(queries.retrieveActivation(other, licenseId), { status: 404 });
  const { activationKey } = await queries.retrieveActivation(customer, licenseId);
  const device = privateKeyToAccount(generatePrivateKey());
  const deviceRef = `sepolia-smoke-${randomUUID()}`;
  stage = 'public_activation';
  const challenge = await post('/activations/challenge', { activationKey, deviceRef, purpose: 'ACTIVATE_DEVICE' });
  const active = await post('/activations', { activationKey, deviceRef, devicePublicKey: device.address,
    challenge: challenge.challenge, proof: await device.signMessage({ message: challenge.challenge }) });
  assert.equal(active.status, 'ACTIVE');
  assert.equal(active.licenseId, licenseId);
  assert.equal('commandId' in active, false);
  const dbDevice = (await pool.query('SELECT status, activated_at FROM license_devices WHERE id=$1', [active.id])).rows[0];
  assert.equal(dbDevice.status, 'ACTIVE');
  report.timeline.T0_active = dbDevice.activated_at.toISOString();
  const sync = (await pool.query("SELECT id, status, created_at, transaction_hash FROM chain_commands WHERE license_id=$1 AND command_type='SYNC_DEVICE_COUNT'", [licenseId])).rows[0];
  assert.equal(sync.status, 'PENDING');
  assert.equal(sync.transaction_hash, null);
  report.timeline.T1_queued = sync.created_at.toISOString();
  report.activation = { status: 'ACTIVE', publicHttp: true, purchaserLogin: false, deviceId: active.id, chainTransactionAbsentAtActivation: true, ownershipIsolation: true };

  stage = 'entitlement_before_sync';
  const entitlementChallenge = await post('/activations/challenge', { licenseId, deviceId: active.id, deviceRef, purpose: 'ISSUE_ENTITLEMENT' });
  const entitlement = await post('/entitlements/issue', { licenseId, deviceId: active.id, challenge: entitlementChallenge.challenge,
    proof: await device.signMessage({ message: entitlementChallenge.challenge }) });
  const verified = await post('/entitlements/verify', { token: entitlement.token });
  assert.equal(verified.valid, true);
  report.entitlement = { issue: true, verify: true, beforeChainSync: true, purchaserLogin: false };

  stage = 'device_sync';
  report.sync = await settle(sync.id, true);
  const state = await client.readContract({ address, abi: artifact.abi, functionName: 'getLicense', args: [`0x${licenseId.replaceAll('-', '')}`] });
  const aggregate = (await pool.query('SELECT active_device_count, device_state_version, device_sync_status FROM licenses WHERE id=$1', [licenseId])).rows[0];
  assert.equal(state.activeDevices, BigInt(aggregate.active_device_count));
  assert.equal(state.deviceStateVersion, BigInt(aggregate.device_state_version));
  report.sync.aggregate = { activeDeviceCount: aggregate.active_device_count, deviceStateVersion: Number(aggregate.device_state_version), databaseSyncStatus: aggregate.device_sync_status, matchesSepolia: true };
  assert.ok(Date.parse(report.timeline.T0_active) <= Date.parse(report.timeline.T2_submitted));
  report.status = 'REAL_EXTERNAL_VERIFIED';
} catch (error) {
  report.status = 'BLOCKED_EXTERNAL';
  report.stage = stage;
  report.blocker = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'SEPOLIA_VERIFICATION_FAILED';
  process.exitCode = 1;
} finally {
  await app?.close();
  await pool?.end();
  await redis?.stop();
  await postgres?.stop();
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
}
