import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { privateKeyToAccount } from 'viem/accounts';

import { ActivationEnvelopeRecoveryService } from '../../../../../EmuKey/backend/src/modules/blockchain/application/activation-envelope-recovery.service.js';
import { LicenseQueryService } from '../../../../../EmuKey/backend/src/modules/blockchain/application/license-query.service.js';
import { LicensingService } from '../../../../../EmuKey/backend/src/modules/licensing/licensing.service.js';
import { ChainCommandRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/chain-command.repository.js';
import { ChainEventRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/chain-event.repository.js';
import { LicensingRepository } from '../../../../../EmuKey/backend/src/modules/licensing/infrastructure/licensing.repository.js';
import { LicenseProjectionRepository } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/license-projection.repository.js';
import { RedisActivationEnvelope } from '../../../../../EmuKey/backend/src/modules/blockchain/infrastructure/redis-activation-envelope.js';
import { CommerceService } from '../../../../../EmuKey/backend/src/modules/commerce-payment/application/commerce.service.js';
import { CommerceRepository } from '../../../../../EmuKey/backend/src/modules/commerce-payment/infrastructure/commerce.repository.js';
import { FakePaymentGateway } from '../../../../../EmuKey/backend/src/modules/commerce-payment/infrastructure/fake-payment.gateway.js';
import { seedBaseline } from '../../../../../EmuKey/backend/src/platform/database/seed-baseline.js';

const CHAIN_ID = 11_155_111;
const NETWORK = 'sepolia';
const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000042';
const RECEIPT_BLOCK_HASH = `0x${'ab'.repeat(32)}`;
const DEVICE_JWT_SECRET = new TextEncoder().encode('sepolia-freeze-jwt-secret');
const chainConfig = { chainId: CHAIN_ID, contractAddress: CONTRACT_ADDRESS, network: NETWORK };

const customer = {
  role: 'CUSTOMER' as const,
  sessionVersion: 1,
  sub: '00000000-0000-4000-8000-000000000004',
};
const otherCustomer = {
  ...customer,
  sub: '00000000-0000-4000-8000-000000000099',
};
const provider = {
  role: 'PROVIDER_ADMIN' as const,
  sessionVersion: 1,
  sub: '00000000-0000-4000-8000-000000000002',
};
const planId = '00000000-0000-4000-8000-000000000301';
const webhookSecret = 'sepolia-freeze-payment-secret';

describe('customer durable license and device invariants without a local blockchain', () => {
  let postgres: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let pool: Pool;
  let redis: Redis;
  let envelopes: RedisActivationEnvelope;
  let commerce: CommerceService;
  let commandRepository: ChainCommandRepository;
  let transactionHash: string;
  let eventRepository: ChainEventRepository;
  let queries: LicenseQueryService;
  let issueCommand: string;
  let licenseId: string;

  async function acceptTerms(orderId: string) {
    const terms = await commerce.getServiceTerms(customer, orderId);
    return commerce.acceptServiceTerms(customer, orderId, {
      accepted: true,
      hash: terms.hash,
      version: terms.version,
    });
  }

  async function activationKey(): Promise<`0x${string}`> {
    const envelope = await envelopes.read(issueCommand);
    if (!envelope) throw new Error('ACTIVATION_ENVELOPE_MISSING');
    return envelope.secret;
  }

  async function ingestEvent(commandId: string, eventType: 'LICENSE_ISSUED' | 'ACTIVE_DEVICE_COUNT_SYNCED') {
    const observed = await eventRepository.ingest({
      blockHash: RECEIPT_BLOCK_HASH,
      blockNumber: 40_000_000,
      chainCommandId: commandId,
      chainId: CHAIN_ID,
      confirmationCount: 2,
      contractAddress: CONTRACT_ADDRESS,
      eventType,
      licenseId,
      logIndex: 0,
      network: NETWORK,
      payload: eventType === 'ACTIVE_DEVICE_COUNT_SYNCED'
        ? { activeDeviceCount: 1, deviceStateVersion: 1 }
        : { activationCommitment: (await envelopes.read(issueCommand))!.commitment, keyVersion: 1 },
      providerUserId: provider.sub,
      transactionHash,
    });
    await eventRepository.confirm(observed.id, 2, RECEIPT_BLOCK_HASH);
    return observed.id;
  }

  function licensingService() {
    const projection = new LicenseProjectionRepository(pool);
    return {
      projection,
      service: new LicensingService(
        new LicensingRepository(pool),
        projection,
        envelopes,
        redis,
        DEVICE_JWT_SECRET,
        chainConfig,
        { consumeLicensingActionVerification: async () => undefined } as never,
      ),
    };
  }

  beforeAll(async () => {
    [postgres, redisContainer] = await Promise.all([
      new PostgreSqlContainer('pgvector/pgvector:pg15')
        .withDatabase('emukey_sepolia_freeze_db')
        .withUsername('emukey')
        .withPassword('test-password')
        .start(),
      new RedisContainer('redis:8.2-alpine').start(),
    ]);
    pool = new Pool({ connectionString: postgres.getConnectionUri() });
    const schema = await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8');
    await pool.query(schema);
    await pool.query(
      await readFile(resolve(process.cwd(), 'database/migrations/20261003-device-sync-canonical-projection.sql'), 'utf8'),
    );
    await seedBaseline(pool, 'Sepolia-freeze@123');
    redis = new Redis(redisContainer.getConnectionUrl());
    envelopes = new RedisActivationEnvelope(redis, '11'.repeat(32));
    commandRepository = new ChainCommandRepository(pool);
    eventRepository = new ChainEventRepository(pool);
    queries = new LicenseQueryService(
      new LicenseProjectionRepository(pool),
      envelopes,
      redis,
    );
    commerce = new CommerceService(
      new CommerceRepository(pool),
      new FakePaymentGateway(webhookSecret),
      envelopes,
      new ActivationEnvelopeRecoveryService(commandRepository, envelopes),
      chainConfig,
    );

  }, 120_000);

  beforeEach(async () => {
    const order = await commerce.createOrder(
      customer,
      randomUUID(),
      undefined,
      { planId },
    );
    await acceptTerms(order.id);
    const checkout = await commerce.checkout(customer, order.id);
    const clock = await pool.query<{ occurred_at: Date }>(
      "SELECT statement_timestamp() + interval '1 second' AS occurred_at",
    );
    const payment = await commerce.ingestIpn(
      {
        amountVnd: order.priceVndSnapshot,
        eventId: randomUUID(),
        occurredAt: clock.rows[0]!.occurred_at.toISOString(),
        providerReference: checkout.checkoutReference,
      },
      webhookSecret,
    );
    issueCommand = payment.commandId!;
    licenseId = payment.licenseId!;
    // Persisted repository fixtures only: no RPC, relayer, or blockchain simulator.
    transactionHash = `0x${randomUUID().replaceAll('-', '').repeat(2)}`;
    const relayerAddress = '0x0000000000000000000000000000000000000001';
    const nonce = await commandRepository.reserveNonce(issueCommand, relayerAddress, 0);
    await commandRepository.markPrepared(issueCommand, {
      network: NETWORK, nonce, relayerAddress, rawTransaction: '0x01', transactionHash,
    });
    await commandRepository.markSubmitted(issueCommand);
    await ingestEvent(issueCommand, 'LICENSE_ISSUED');

  }, 120_000);

  afterAll(async () => {
    if (redis) await redis.quit();
    if (pool) await pool.end();
    await Promise.all([postgres?.stop(), redisContainer?.stop()]);
  });

  it('enforces one-time retrieval and customer ownership', async () => {
    const retrieved = await queries.retrieveActivation(customer, licenseId);
    expect(retrieved.activationKey).toMatch(/^0x[0-9a-f]{64}$/);
    await expect(queries.retrieveActivation(customer, licenseId)).rejects.toMatchObject({ status: 404 });
    await expect(queries.find(otherCustomer, licenseId)).rejects.toMatchObject({ status: 404 });
    await expect(queries.list(otherCustomer)).resolves.toEqual([]);
    await expect(queries.find(customer, licenseId)).resolves.toMatchObject({ id: licenseId, status: 'ACTIVE' });
  });

  it('rejects replay and keeps same-device activation idempotent', async () => {
    const { projection, service } = licensingService();
    const key = await activationKey();
    const account = privateKeyToAccount(`0x${'55'.repeat(32)}`);
    const deviceRef = 'sepolia-freeze-device-1';
    const firstChallenge = await service.challenge(null, {
      activationKey: key,
      deviceRef,
      licenseId,
      purpose: 'ACTIVATE_DEVICE',
    });
    const firstProof = await account.signMessage({ message: firstChallenge.challenge });
    await expect(service.activate(null, {
      activationKey: key,
      challenge: firstChallenge.challenge,
      devicePublicKey: account.address,
      deviceRef,
      licenseId,
      proof: firstProof,
    })).resolves.toMatchObject({ licenseId, status: 'ACTIVE' });
    // Replaying the consumed challenge and proof must be rejected.
    await expect(service.activate(null, {
      activationKey: key,
      challenge: firstChallenge.challenge,
      devicePublicKey: account.address,
      deviceRef,
      licenseId,
      proof: firstProof,
    })).rejects.toMatchObject({ status: 401 });
    expect(await projection.listCustomerDevices(customer.sub, licenseId)).toHaveLength(1);


    const repeatedChallenge = await service.challenge(null, {
      activationKey: key, deviceRef, licenseId, purpose: 'ACTIVATE_DEVICE',
    });
    const repeated = await service.activate(null, {
      activationKey: key, deviceRef, licenseId, challenge: repeatedChallenge.challenge,
      devicePublicKey: account.address, proof: await account.signMessage({ message: repeatedChallenge.challenge }),
    });
    expect(repeated).not.toHaveProperty('commandId');
    const device = (await projection.listCustomerDevices(customer.sub, licenseId))[0]!;
    const directRepeat = await new LicensingRepository(pool).createDeviceCommand(
      null, licenseId, device.deviceRef, account.address, randomUUID(), 1, chainConfig,
    );
    expect(directRepeat.commandId).toBeNull();
    expect(await projection.listCustomerDevices(customer.sub, licenseId)).toHaveLength(1);
    expect((await pool.query('SELECT active_device_count, device_state_version FROM licenses WHERE id=$1', [licenseId])).rows[0])
      .toMatchObject({ active_device_count: 1, device_state_version: '1' });
  });

  it('serializes three concurrent activations against quota two', async () => {
    const { projection, service } = licensingService();
    const key = await activationKey();
    const concurrent = await Promise.allSettled(
      ['66', '77', '99'].map(async (byte, index) => {
        const concurrentAccount = privateKeyToAccount(`0x${byte.repeat(32)}`);
        const concurrentRef = `sepolia-freeze-concurrent-${index}`;
        const challenge = await service.challenge(null, {
          activationKey: key,
          deviceRef: concurrentRef,
          licenseId,
          purpose: 'ACTIVATE_DEVICE',
        });
        return service.activate(null, {
          activationKey: key,
          challenge: challenge.challenge,
          devicePublicKey: concurrentAccount.address,
          deviceRef: concurrentRef,
          licenseId,
          proof: await concurrentAccount.signMessage({ message: challenge.challenge }),
        });
      }),
    );
    expect(concurrent.filter(({ status }) => status === 'fulfilled')).toHaveLength(2);
    expect(concurrent.filter(({ status }) => status === 'rejected')).toHaveLength(1);

    const failure = concurrent.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({ status: 409 });
    const devices = await projection.listCustomerDevices(customer.sub, licenseId);
    expect(devices).toHaveLength(2);
    const afterState = await pool.query<{ active_device_count: number; device_state_version: string; latest_requested_device_sync_version: string }>(
      `SELECT active_device_count, device_state_version,
              latest_requested_device_sync_version
       FROM licenses WHERE id=$1`,
      [licenseId],
    );
    expect(afterState.rows[0]).toMatchObject({ active_device_count: 2 });
    expect(BigInt(afterState.rows[0]!.device_state_version)).toBe(2n);
    expect(BigInt(afterState.rows[0]!.latest_requested_device_sync_version)).toBe(BigInt(afterState.rows[0]!.device_state_version));
    const syncCommands = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM chain_commands WHERE license_id=$1 AND command_type='SYNC_DEVICE_COUNT'",
      [licenseId],
    );
    expect(syncCommands.rows[0]!.count).toBe(2);
  });

  it('keeps owner isolation and device activation independent of chain finality', async () => {
    const { projection, service } = licensingService();
    const key = await activationKey();
    const account = privateKeyToAccount(`0x${'88'.repeat(32)}`);
    const deviceRef = 'sepolia-freeze-other-device';
    const challenge = await service.challenge(otherCustomer, {
      activationKey: key,
      deviceRef,
      licenseId,
      purpose: 'ACTIVATE_DEVICE',
    });
    await expect(service.activate(otherCustomer, {
      activationKey: key,
      challenge: challenge.challenge,
      devicePublicKey: account.address,
      deviceRef,
      licenseId,
      proof: await account.signMessage({ message: challenge.challenge }),
    })).resolves.toMatchObject({ licenseId, status: 'ACTIVE' });

    expect((await pool.query('SELECT customer_user_id FROM licenses WHERE id=$1', [licenseId])).rows[0]).toMatchObject({
      customer_user_id: customer.sub,
    });
    await expect(queries.list(otherCustomer)).resolves.toEqual([]);
    await expect(queries.find(otherCustomer, licenseId)).rejects.toMatchObject({ status: 404 });
    await expect(queries.retrieveActivation(otherCustomer, licenseId)).rejects.toMatchObject({ status: 404 });
    await expect(service.rotate(otherCustomer, licenseId, { currentKey: key, actionToken: 'unused' })).rejects.toMatchObject({ status: 404 });
    await expect(service.recoverActivationKey(otherCustomer, licenseId, { currentPassword: 'unused', actionToken: 'unused' })).rejects.toMatchObject({ status: 404 });

    const devices = await projection.listCustomerDevices(customer.sub, licenseId);
    const storedDeviceRef = createHmac('sha256', DEVICE_JWT_SECRET).update(`device-ref:${deviceRef}`).digest('hex');
    const device = devices.find((candidate) => candidate.deviceRef === storedDeviceRef)!;
    expect(device.status).toBe('ACTIVE');
    const revokeChallenge = await service.challenge(customer, {
      deviceId: device.id,
      deviceRef: storedDeviceRef,
      licenseId,
      purpose: 'SELF_REVOKE_DEVICE',
    });
    await service.revokeDevice(customer, licenseId, device.id, {
      activationKey: key,
      actionToken: 'test-action-token',
      challenge: revokeChallenge.challenge,
      proof: await account.signMessage({ message: revokeChallenge.challenge }),
    });
    await expect(projection.listCustomerDevices(customer.sub, licenseId)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ deviceRef: storedDeviceRef, status: 'REVOKED' }),
    ]));
    const rebind = await service.challenge(null, { activationKey: key, deviceRef, licenseId, purpose: 'ACTIVATE_DEVICE' });
    expect(rebind.bindingGeneration).toBe(2);
    await expect(service.activate(null, { activationKey: key, deviceRef, licenseId,
      devicePublicKey: account.address, challenge: rebind.challenge,
      proof: await account.signMessage({ message: rebind.challenge }),
    })).resolves.toMatchObject({ id: device.id, status: 'ACTIVE', bindingGeneration: 2 });
    expect((await pool.query('SELECT active_device_count FROM licenses WHERE id=$1', [licenseId])).rows[0].active_device_count).toBe(1);
    expect((await pool.query("SELECT DISTINCT status FROM chain_commands WHERE license_id=$1 AND command_type='SYNC_DEVICE_COUNT'", [licenseId])).rows)
      .toEqual([{ status: 'PENDING' }]);

  });

  it('repairs persisted canonical projection drift without a chain node', async () => {
    const corruption = await pool.connect();
    try {
      await corruption.query('SET session_replication_role = replica');
      await corruption.query(
        `UPDATE chain_commands SET status='SUBMITTED_UNKNOWN', confirmed_at=NULL,
           confirmation_chain_event_id=NULL WHERE id=$1`,
        [issueCommand],
      );
    } finally {
      await corruption.query('SET session_replication_role = origin');
      corruption.release();
    }
    const repair = await eventRepository.reconcileCanonicalProjections();
    expect(repair).toMatchObject({
      commandRepairs: 1,
      licenseIds: [],
      licenseRepairs: 0,
      remainingMismatches: 0,
    });
    await expect(queries.find(customer, licenseId)).resolves.toMatchObject({ id: licenseId, status: 'ACTIVE' });
  });

  it('invalidates and rebuilds reorged repository projections deterministically', async () => {
    const event = (await pool.query('SELECT id FROM chain_events WHERE chain_command_id=$1', [issueCommand])).rows[0];
    await eventRepository.markReorged(event.id);
    await eventRepository.markReorged(event.id);
    expect((await pool.query('SELECT status, activation_key_trust_status FROM licenses WHERE id=$1', [licenseId])).rows[0])
      .toEqual({ status: 'PENDING_ONCHAIN', activation_key_trust_status: 'UNTRUSTED_REORG' });
    expect((await pool.query('SELECT status FROM chain_commands WHERE id=$1', [issueCommand])).rows[0].status).toBe('SUBMITTED_UNKNOWN');
    expect((await pool.query('SELECT reorg_count FROM chain_events WHERE id=$1', [event.id])).rows[0].reorg_count).toBe(1);
    await ingestEvent(issueCommand, 'LICENSE_ISSUED');
    await expect(queries.find(customer, licenseId)).resolves.toMatchObject({ status: 'ACTIVE' });
    const recovered = (await pool.query('SELECT reorg_count, reorged_at, finality_status FROM chain_events WHERE id=$1', [event.id])).rows[0];
    expect(recovered).toMatchObject({ reorg_count: 1, finality_status: 'CONFIRMED' });
    expect(recovered.reorged_at).toBeInstanceOf(Date);
  });
});
