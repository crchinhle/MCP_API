import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { ConflictException } from '@nestjs/common';
import { Pool } from 'pg';
import { createPublicClient, defineChain, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { ActivationEnvelopeRecoveryService } from '../../../src/modules/blockchain/application/activation-envelope-recovery.service.js';
import { ChainCommandService } from '../../../src/modules/blockchain/application/chain-command.service.js';
import { ChainIndexerService } from '../../../src/modules/blockchain/application/chain-indexer.service.js';
import { LicenseQueryService } from '../../../src/modules/blockchain/application/license-query.service.js';
import { LicensingService } from '../../../src/modules/licensing/licensing.service.js';
import { RpcChainIndexerService } from '../../../src/modules/blockchain/application/rpc-chain-indexer.service.js';
import { ChainCommandRepository } from '../../../src/modules/blockchain/infrastructure/chain-command.repository.js';
import { ChainEventRepository } from '../../../src/modules/blockchain/infrastructure/chain-event.repository.js';
import { LicensingRepository } from '../../../src/modules/licensing/infrastructure/licensing.repository.js';
import { ChainIndexerCheckpointRepository } from '../../../src/modules/blockchain/infrastructure/chain-indexer-checkpoint.repository.js';
import { LicenseProjectionRepository } from '../../../src/modules/blockchain/infrastructure/license-projection.repository.js';
import { LocalPrivateKeyChainSigner } from '../../../src/modules/blockchain/infrastructure/local-private-key-chain-signer.js';
import { RedisActivationEnvelope } from '../../../src/modules/blockchain/infrastructure/redis-activation-envelope.js';
import { ViemChainEventSource } from '../../../src/modules/blockchain/infrastructure/viem-chain-event-source.js';
import { ViemChainRelayer } from '../../../src/modules/blockchain/infrastructure/viem-chain-relayer.js';
import { CommerceService } from '../../../src/modules/commerce-payment/application/commerce.service.js';
import { CommerceRepository } from '../../../src/modules/commerce-payment/infrastructure/commerce.repository.js';
import { FakePaymentGateway } from '../../../src/modules/commerce-payment/infrastructure/fake-payment.gateway.js';
import { seedBaseline } from '../../../src/platform/database/seed-baseline.js';

const rpcUrl = process.env.LOCAL_EVM_RPC_URL;
const contractAddress = process.env.LOCAL_EVM_CONTRACT_ADDRESS as
  Address | undefined;
const relayerPrivateKey = process.env.LOCAL_EVM_RELAYER_PRIVATE_KEY;
const describeRealRpc =
  rpcUrl && contractAddress && relayerPrivateKey ? describe : describe.skip;

describeRealRpc('customer durable chain golden flow over real JSON-RPC', () => {
  let postgres: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let pool: Pool;
  let redis: Redis;
  let commerce: CommerceService;
  let envelopes: RedisActivationEnvelope;
  let publicClient: ReturnType<typeof createPublicClient>;
  const customer = {
    role: 'CUSTOMER' as const,
    sessionVersion: 1,
    sub: '00000000-0000-4000-8000-000000000004',
  };
  const otherCustomer = {
    ...customer,
    sub: '00000000-0000-4000-8000-000000000099',
  };
  const planId = '00000000-0000-4000-8000-000000000301';
  const webhookSecret = 'phase5-payment-secret';

  async function acceptTerms(orderId: string) {
    const terms = await commerce.getServiceTerms(customer, orderId);
    return commerce.acceptServiceTerms(customer, orderId, {
      accepted: true, hash: terms.hash, version: terms.version,
    });
  }

  beforeAll(async () => {
    const chain = defineChain({
      id: 31_337,
      name: 'hardhat',
      nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
      rpcUrls: { default: { http: [rpcUrl!] } },
      testnet: true,
    });
    publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
    [postgres, redisContainer] = await Promise.all([
      new PostgreSqlContainer('pgvector/pgvector:pg15')
        .withDatabase('emukey_phase5_test')
        .withUsername('emukey')
        .withPassword('test-password')
        .start(),
      new RedisContainer('redis:8.2-alpine').start(),
    ]);
    pool = new Pool({ connectionString: postgres.getConnectionUri() });
    await pool.query(
      await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8'),
    );
    await seedBaseline(pool, 'Phase-five-test@123');
    redis = new Redis(redisContainer.getConnectionUrl());
    envelopes = new RedisActivationEnvelope(redis, '11'.repeat(32));
    await expect(
      publicClient.getCode({ address: contractAddress! }),
    ).resolves.toMatch(/^0x[0-9a-f]+$/);
    commerce = new CommerceService(
      new CommerceRepository(pool),
      new FakePaymentGateway(webhookSecret),
      envelopes,
      new ActivationEnvelopeRecoveryService(
        new ChainCommandRepository(pool),
        envelopes,
      ),
      {
        chainId: 31_337,
        contractAddress: contractAddress!,
        network: 'hardhat',
      },
    );
  }, 120_000);

  afterAll(async () => {
    if (redis) await redis.quit();
    if (pool) await pool.end();
    await Promise.all([postgres?.stop(), redisContainer?.stop()]);
  });

  it('gates the one-time activation secret by customer ownership and chain finality', async () => {
    const deploymentBlock = Number(await publicClient.getBlockNumber()) + 1;
    const order = await commerce.createOrder(
      customer,
      '00000000-0000-4000-8000-000000000703',
      undefined,
      { planId },
    );
    await acceptTerms(order.id);
    const checkout = await commerce.checkout(customer, order.id);
    const purchaseProviderClock = await pool.query<{ occurred_at: Date }>(
      "SELECT statement_timestamp() + interval '1 second' AS occurred_at",
    );
    const payment = await commerce.ingestIpn(
      {
        amountVnd: order.priceVndSnapshot,
        eventId: 'phase5-customer-event-1',
        occurredAt: purchaseProviderClock.rows[0]!.occurred_at.toISOString(),
        providerReference: checkout.checkoutReference,
      },
      webhookSecret,
    );
    const commandId = payment.commandId!;
    const licenseId = payment.licenseId!;

    const commandRepository = new ChainCommandRepository(pool);
    const relayer = new ViemChainRelayer({
      chainId: 31_337,
      network: 'hardhat',
      rpcUrl: rpcUrl!,
      signer: new LocalPrivateKeyChainSigner(relayerPrivateKey!),
    });
    const commands = new ChainCommandService(
      commandRepository,
      relayer,
      envelopes,
      new ActivationEnvelopeRecoveryService(commandRepository, envelopes),
    );
    expect(await commands.processNext('anonymous-worker')).toBe(commandId);
    const submittedIssue = await pool.query<{ last_error: string | null; status: string }>(
      'SELECT status, last_error FROM chain_commands WHERE id=$1',
      [commandId],
    );
    expect(submittedIssue.rows[0]).toEqual({ last_error: null, status: 'SUBMITTED' });

    const queries = new LicenseQueryService(
      new LicenseProjectionRepository(pool),
      envelopes,
      redis,
    );
    await expect(
      queries.retrieveActivation(customer, licenseId),
    ).rejects.toMatchObject({ status: 404 });

    await commands.reconcileReceipt('receipt-worker');
    await expect(
      commandRepository.claimSubmitted('receipt-worker-repeat'),
    ).resolves.toBeNull();
    await fetch(rpcUrl!, {
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'evm_mine',
        params: [],
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    const eventRepository = new ChainEventRepository(pool);
    const indexer = new ChainIndexerService(eventRepository, 2);
    const rpcIndexer = new RpcChainIndexerService(
      new ChainIndexerCheckpointRepository(pool),
      indexer,
      new ViemChainEventSource({
        chainId: 31_337,
        contractAddress: contractAddress!,
        network: 'hardhat',
        rpcUrl: rpcUrl!,
      }),
      {
        batchSize: 100,
        chainId: 31_337,
        contractAddress: contractAddress!,
        deploymentBlock,
        network: 'hardhat',
        requiredConfirmations: 2,
      },
    );
    await expect(rpcIndexer.poll('rpc-indexer')).resolves.toBe(1);
    const event = await pool.query<{
      chain_command_id: string;
      finality_status: string;
    }>(
      `SELECT chain_command_id, finality_status FROM chain_events
        WHERE chain_command_id=$1`,
      [commandId],
    );
    expect(event.rows[0]).toEqual({
      chain_command_id: commandId,
      finality_status: 'CONFIRMED',
    });
    const retrieved = await queries.retrieveActivation(customer, licenseId);
    expect(retrieved.activationKey).toMatch(/^0x[0-9a-f]{64}$/);
    await expect(
      queries.retrieveActivation(customer, licenseId),
    ).rejects.toMatchObject({ status: 404 });
    await expect(queries.find(otherCustomer, licenseId)).rejects.toMatchObject({
      status: 404,
    });
    const projection = await queries.find(customer, licenseId);
    expect(projection).toMatchObject({ id: licenseId, status: 'ACTIVE' });

    const licensingRepository = new LicensingRepository(pool);
    const licensingProjection = new LicenseProjectionRepository(pool);
    const identity = {
      consumeLicensingActionVerification: vi.fn().mockResolvedValue(undefined),
    };
    const licensing = new LicensingService(
      licensingRepository,
      licensingProjection,
      envelopes,
      redis,
      new TextEncoder().encode('phase5-test-jwt-secret'),
      { chainId: 31_337, contractAddress: contractAddress!, network: 'hardhat' },
      identity as never,
    );
    const deviceAccount = privateKeyToAccount(`0x${'55'.repeat(32)}`);
    const deviceRef = 'phase6-device-1';
    const storedDeviceRef = createHmac(
      'sha256',
      new TextEncoder().encode('phase5-test-jwt-secret'),
    ).update(`device-ref:${deviceRef}`).digest('hex');
    const challenge = await licensing.challenge(customer, { deviceRef, licenseId, purpose: 'ACTIVATE_DEVICE' });
    const proof = await deviceAccount.signMessage({ message: challenge.challenge });
     await licensing.activate(customer, {
      activationKey: retrieved.activationKey,
      challenge: challenge.challenge,
      devicePublicKey: deviceAccount.address,
      deviceRef,
      licenseId,
      proof,
    });
     expect(await commands.processNext('phase6-activation-worker')).toMatch(/[0-9a-f-]{36}/);
    await commands.reconcileReceipt('phase6-activation-receipt');
    await fetch(rpcUrl!, {
      body: JSON.stringify({ id: 2, jsonrpc: '2.0', method: 'evm_mine', params: [] }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    await fetch(rpcUrl!, {
      body: JSON.stringify({ id: 3, jsonrpc: '2.0', method: 'evm_mine', params: [] }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    await expect(rpcIndexer.poll('phase6-rpc-indexer')).resolves.toBeGreaterThanOrEqual(1);
    const devices = await licensingProjection.listCustomerDevices(customer.sub, licenseId);
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ deviceRef: storedDeviceRef, status: 'ACTIVE', finality: 'CONFIRMED' });
    const activationLoadStarted = performance.now();
    const activationChallenges = await Promise.all(
      Array.from({ length: 20 }, async () => {
        const requestStarted = performance.now();
        const challenge = await licensing.challenge(customer, {
          deviceId: devices[0]!.id,
          deviceRef,
          licenseId,
          purpose: 'ISSUE_ENTITLEMENT',
        });
        return { challenge, elapsedMs: performance.now() - requestStarted };
      }),
    );
    const activationLoadElapsed = performance.now() - activationLoadStarted;
    const activationLoadSamples = activationChallenges.map(({ elapsedMs }) => elapsedMs).sort((a, b) => a - b);
    const percentile = (ratio: number) => activationLoadSamples[Math.min(activationLoadSamples.length - 1, Math.floor(activationLoadSamples.length * ratio))] ?? 0;
    console.log(JSON.stringify({ phase8: 'LOAD_ACTIVATION', requests: activationChallenges.length, concurrency: activationChallenges.length, totalElapsedMs: Number(activationLoadElapsed.toFixed(2)), p50Ms: Number(percentile(0.5).toFixed(2)), p95Ms: Number(percentile(0.95).toFixed(2)), p99Ms: Number(percentile(0.99).toFixed(2)), errorRate: 0 }));
    const entitlementChallenge = await licensing.challenge(customer, { deviceId: devices[0]!.id, deviceRef, licenseId, purpose: 'ISSUE_ENTITLEMENT' });
    const entitlementProof = await deviceAccount.signMessage({ message: entitlementChallenge.challenge });
    const entitlement = await licensing.issueEntitlement(customer, { licenseId, deviceId: devices[0]!.id, challenge: entitlementChallenge.challenge, proof: entitlementProof });
    expect(entitlement).toMatchObject({ licenseId, deviceId: devices[0]!.id });

    const rotation = await licensing.rotate(customer, licenseId, {
      actionToken: 'rotation-action-token-with-at-least-32-characters',
      currentKey: retrieved.activationKey,
    });
    expect(await commands.processNext('phase6-rotation-worker')).toBe(rotation.commandId);
    await commands.reconcileReceipt('phase6-rotation-receipt');
    for (let index = 0; index < 2; index += 1) {
      await fetch(rpcUrl!, {
        body: JSON.stringify({ id: 30 + index, jsonrpc: '2.0', method: 'evm_mine', params: [] }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
    }
    await expect(rpcIndexer.poll('phase6-rpc-indexer-rotation')).resolves.toBeGreaterThanOrEqual(1);
    const rotated = await queries.retrieveActivation(customer, licenseId);
    expect(rotated.keyVersion).toBe(2);
    expect(rotated.activationKey).not.toBe(retrieved.activationKey);
    await expect(
      licensing.verifyEntitlement(customer, { token: entitlement.token }),
    ).rejects.toBeInstanceOf(ConflictException);

    const revokeChallenge = await licensing.challenge(customer, { deviceId: devices[0]!.id, deviceRef, licenseId, purpose: 'SELF_REVOKE_DEVICE' });
    const revokeProof = await deviceAccount.signMessage({ message: revokeChallenge.challenge });
     await licensing.revokeDevice(customer, licenseId, devices[0]!.id, {
      activationKey: rotated.activationKey,
      actionToken: 'test-action-token',
      challenge: revokeChallenge.challenge,
      proof: revokeProof,
    });
     expect(await commands.processNext('phase6-revoke-worker')).toMatch(/[0-9a-f-]{36}/);
    await commands.reconcileReceipt('phase6-revoke-receipt');
    await fetch(rpcUrl!, {
      body: JSON.stringify({ id: 4, jsonrpc: '2.0', method: 'evm_mine', params: [] }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    await fetch(rpcUrl!, {
      body: JSON.stringify({ id: 5, jsonrpc: '2.0', method: 'evm_mine', params: [] }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    await expect(rpcIndexer.poll('phase6-rpc-indexer-revoke')).resolves.toBeGreaterThanOrEqual(1);
    await expect(licensingProjection.listCustomerDevices(customer.sub, licenseId)).resolves.toMatchObject([
      { deviceRef: storedDeviceRef, status: 'REVOKED', finality: 'CONFIRMED' },
    ]);
    await expect(
      licensing.verifyEntitlement(customer, { token: entitlement.token }),
    ).rejects.toBeInstanceOf(ConflictException);

    const corruptionClient = await pool.connect();
    try {
      await corruptionClient.query('SET session_replication_role = replica');
      await corruptionClient.query(
        `UPDATE chain_commands SET status='SUBMITTED_UNKNOWN', confirmed_at=NULL,
           confirmation_chain_event_id=NULL WHERE id=$1`,
        [commandId],
      );
    } finally {
      await corruptionClient.query('SET session_replication_role = origin');
      corruptionClient.release();
    }
    const repair = await eventRepository.reconcileCanonicalProjections();
    expect(repair).toMatchObject({
      commandRepairs: 1,
      licenseIds: [],
      licenseRepairs: 0,
      remainingMismatches: 0,
    });
    await expect(queries.find(customer, licenseId)).resolves.toMatchObject({
      id: licenseId,
      status: 'ACTIVE',
    });

    const beforeRenewal = await queries.find(customer, licenseId);
    await expect(commerce.renewalPreview(otherCustomer, licenseId)).rejects.toMatchObject({ status: 404 });
    await expect(commerce.renewalPreview({ ...customer, role: 'PROVIDER_ADMIN' }, licenseId)).rejects.toMatchObject({ status: 403 });
    const preview = await commerce.renewalPreview(customer, licenseId);
    expect(preview).toMatchObject({ planId, canRenew: true, priceVnd: 120000, durationMonths: 1, pendingOrder: null });
    expect(preview.estimatedExpiresAt.getTime()).toBeGreaterThan(new Date(String(beforeRenewal.expiresAt)).getTime());
    await expect(commerce.createOrder(otherCustomer, '00000000-0000-4000-8000-000000000705', undefined,
      { planId, targetLicenseId: licenseId })).rejects.toMatchObject({ status: 404 });
    await expect(commerce.createOrder(customer, '00000000-0000-4000-8000-000000000706', undefined,
      { planId: '00000000-0000-4000-8000-000000000302', targetLicenseId: licenseId })).rejects.toMatchObject({ status: 404 });
    const repeats = await Promise.all(['704', '707', '708'].map((suffix) => commerce.createOrder(customer,
      `00000000-0000-4000-8000-000000000${suffix}`, undefined, { planId, targetLicenseId: licenseId })));
    const renewalOrder = repeats[0]!;
    expect(new Set(repeats.map((item) => item.id)).size).toBe(1);
    expect((await commerce.renewalPreview(customer, licenseId)).pendingOrder?.id).toBe(renewalOrder.id);
    await acceptTerms(renewalOrder.id);
    const renewalCheckout = await commerce.checkout(customer, renewalOrder.id);
    const renewalProviderClock = await pool.query<{ occurred_at: Date }>(
      "SELECT statement_timestamp() + interval '1 second' AS occurred_at",
    );
    const renewalPayment = await commerce.ingestIpn(
      {
        amountVnd: renewalOrder.priceVndSnapshot,
        eventId: 'phase6-renewal-event-1',
        occurredAt: renewalProviderClock.rows[0]!.occurred_at.toISOString(),
        providerReference: renewalCheckout.checkoutReference,
      },
      webhookSecret,
    );
    await expect(commerce.findOrder(customer, renewalOrder.id)).resolves.toMatchObject({
      licenseId, targetLicenseId: licenseId, renewalStatus: 'PENDING',
    });
    expect((await commerce.listOrders(customer)).find((item) => item.id === renewalOrder.id)?.licenseId).toBe(licenseId);
    expect((await commerce.createOrder(customer, '00000000-0000-4000-8000-000000000709', undefined,
      { planId, targetLicenseId: licenseId })).id).toBe(renewalOrder.id);
    expect(await commands.processNext('phase6-renewal-worker')).toBe(renewalPayment.commandId);
    await commands.reconcileReceipt('phase6-renewal-receipt');
    for (let index = 0; index < 2; index += 1) {
      await fetch(rpcUrl!, {
        body: JSON.stringify({ id: 40 + index, jsonrpc: '2.0', method: 'evm_mine', params: [] }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
    }
    await expect(rpcIndexer.poll('phase6-rpc-indexer-renewal')).resolves.toBeGreaterThanOrEqual(1);
    const afterRenewal = await queries.find(customer, licenseId);
    const completedRenewal = await commerce.findOrder(customer, renewalOrder.id);
    expect(completedRenewal.renewalStatus).toBe('CONFIRMED');
    expect(Math.floor(completedRenewal.renewalExpiresAt!.getTime() / 1000)).toBe(Math.floor(new Date(String(afterRenewal.expiresAt)).getTime() / 1000));
    expect(new Date(String(afterRenewal.expiresAt)).getTime()).toBeGreaterThan(
      new Date(String(beforeRenewal.expiresAt)).getTime(),
    );

    const provider = {
      role: 'PROVIDER_ADMIN' as const,
      sessionVersion: 1,
      sub: '00000000-0000-4000-8000-000000000002',
    };
    const suspend = await licensing.lifecycle(provider, licenseId, {
      command: 'SUSPEND_LICENSE',
      reason: 'phase6 production-like test',
    });
    expect(await commands.processNext('phase6-suspend-worker')).toBe(suspend.commandId);
    await commands.reconcileReceipt('phase6-suspend-receipt');
    for (let index = 0; index < 2; index += 1) {
      await fetch(rpcUrl!, {
        body: JSON.stringify({ id: 50 + index, jsonrpc: '2.0', method: 'evm_mine', params: [] }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
    }
    await expect(rpcIndexer.poll('phase6-rpc-indexer-suspend')).resolves.toBeGreaterThanOrEqual(1);
    await expect(queries.find(customer, licenseId)).resolves.toMatchObject({ status: 'SUSPENDED' });

    const resume = await licensing.lifecycle(provider, licenseId, {
      command: 'RESUME_LICENSE',
    });
    expect(await commands.processNext('phase6-resume-worker')).toBe(resume.commandId);
    await commands.reconcileReceipt('phase6-resume-receipt');
    for (let index = 0; index < 2; index += 1) {
      await fetch(rpcUrl!, {
        body: JSON.stringify({ id: 60 + index, jsonrpc: '2.0', method: 'evm_mine', params: [] }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
    }
    await expect(rpcIndexer.poll('phase6-rpc-indexer-resume')).resolves.toBeGreaterThanOrEqual(1);
    await expect(queries.find(customer, licenseId)).resolves.toMatchObject({ status: 'ACTIVE' });

    const concurrentDevices = await Promise.all(
      ['66', '77'].map(async (byte, index) => {
        const account = privateKeyToAccount(`0x${byte.repeat(32)}`);
        const ref = `phase6-concurrent-device-${index}`;
        const nonce = await licensing.challenge(customer, { deviceRef: ref, licenseId, purpose: 'ACTIVATE_DEVICE' });
        const signature = await account.signMessage({ message: nonce.challenge });
        return { account, nonce, ref, signature };
      }),
    );
    const concurrentResults = await Promise.allSettled(
      concurrentDevices.map(({ account, nonce, ref, signature }) =>
        licensing.activate(customer, {
          activationKey: rotated.activationKey,
          challenge: nonce.challenge,
          devicePublicKey: account.address,
          deviceRef: ref,
          licenseId,
          proof: signature,
        }),
      ),
    );
    expect(concurrentResults.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(concurrentResults.filter(({ status }) => status === 'rejected')).toHaveLength(1);

    const replayDevice = privateKeyToAccount(`0x${'88'.repeat(32)}`);
    const replayRef = 'phase6-replay-device';
    const replayChallenge = await licensing.challenge(customer, { deviceRef: replayRef, licenseId, purpose: 'ACTIVATE_DEVICE' });
    const replayProof = await replayDevice.signMessage({ message: replayChallenge.challenge });
    await expect(licensing.activate(customer, {
      activationKey: rotated.activationKey,
      challenge: replayChallenge.challenge,
      devicePublicKey: replayDevice.address,
      deviceRef: replayRef,
      licenseId,
      proof: replayProof,
    })).rejects.toBeInstanceOf(ConflictException);
    await expect(licensing.activate(customer, {
      activationKey: rotated.activationKey,
      challenge: replayChallenge.challenge,
      devicePublicKey: replayDevice.address,
      deviceRef: replayRef,
      licenseId,
      proof: replayProof,
    })).rejects.toMatchObject({ status: 401 });

    await expect(
      eventRepository.deriveExpiredFromCanonicalChain(
        new Date(new Date(String(afterRenewal.expiresAt)).getTime() + 1_000),
      ),
    ).resolves.toContain(licenseId);
    await expect(queries.find(customer, licenseId)).resolves.toMatchObject({ status: 'EXPIRED' });
    const expiredRenewal = await commerce.createOrder(customer, '00000000-0000-4000-8000-000000000710', undefined, { planId, targetLicenseId: licenseId });
    expect(expiredRenewal.id).not.toBe(renewalOrder.id);
    await commerce.cancelOrder(customer, expiredRenewal.id);
    const replacement = await commerce.createOrder(customer, '00000000-0000-4000-8000-000000000711', undefined, { planId, targetLicenseId: licenseId });
    expect(replacement.id).not.toBe(expiredRenewal.id);

    const resumeEvent = await pool.query<{ id: string }>(
      `SELECT id FROM chain_events WHERE chain_command_id=$1 AND finality_status='CONFIRMED'`,
      [resume.commandId],
    );
    await eventRepository.markReorged(resumeEvent.rows[0]!.id);
    await expect(licensingRepository.commandStatus(provider.sub, resume.commandId)).resolves.toMatchObject({
      status: 'SUBMITTED_UNKNOWN',
    });
    await expect(pool.query(
      'SELECT finality_status FROM chain_events WHERE id=$1',
      [resumeEvent.rows[0]!.id],
    )).resolves.toMatchObject({ rows: [{ finality_status: 'REORGED' }] });
  });
});
