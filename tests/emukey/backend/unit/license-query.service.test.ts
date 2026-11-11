import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import type { Mocked } from 'vitest';

import { LicenseQueryService } from '../../../../EmuKey/backend/src/modules/blockchain/application/license-query.service.js';
import type { ActivationEnvelopePort } from '../../../../EmuKey/backend/src/modules/blockchain/application/ports/activation-envelope.port.js';
import { LicenseProjectionRepository } from '../../../../EmuKey/backend/src/modules/blockchain/infrastructure/license-projection.repository.js';
import type { AuthPrincipal } from '../../../../EmuKey/backend/src/modules/identity-access/identity.types.js';
import { activationCommitment } from '../../../../EmuKey/backend/src/platform/crypto/license-crypto.js';

const provider: AuthPrincipal = {
  role: 'PROVIDER_ADMIN',
  sessionVersion: 1,
  sub: '00000000-0000-4000-8000-000000000004',
};
const customer: AuthPrincipal = {
  role: 'CUSTOMER',
  sessionVersion: 1,
  sub: '00000000-0000-4000-8000-000000000004',
};

describe('LicenseQueryService boundaries', () => {
  it('rejects device listing for an owned provider-managed license before reading device records', async () => {
    const repository = { listCustomerDevices: vi.fn().mockResolvedValue([]) };
    const handoff = {
      customerInfo: vi.fn().mockResolvedValue({ fulfillmentMode: 'PROVIDER_HANDOFF' }),
      rejectProductUse: vi.fn().mockRejectedValue(Object.assign(new Error('Provider managed'), { status: 410 })),
    };
    const service = new LicenseQueryService(repository as never, {} as never, {} as Redis, 30, undefined, handoff as never);
    await expect(service.listDevices(customer, 'license')).rejects.toMatchObject({ status: 410 });
    expect(handoff.customerInfo).toHaveBeenCalledWith(customer.sub, 'license');
    expect(repository.listCustomerDevices).not.toHaveBeenCalled();
  });
  it('replays the same logical key delivery without consuming its encrypted envelope', async () => {
    const command = { command_id: 'command', license_id: 'license', key_version: 1, commitment: 'commitment' };
    const envelope = { commandId: 'command', licenseId: 'license', keyVersion: 1, commitment: 'commitment', secret: 'secret' };
    const repository = { activationCommand: vi.fn().mockResolvedValue(command) };
    const envelopes = { read: vi.fn().mockResolvedValue(envelope), remainingTtl: vi.fn().mockResolvedValue(300), consume: vi.fn() };
    const deliveries = { claim: vi.fn().mockResolvedValue({ retryUntil: new Date('2026-11-01T00:05:00Z') }) };
    const service = new LicenseQueryService(repository as never, envelopes as never, {} as Redis, 30, deliveries as never);
    const first = await service.retrieveActivation(customer, 'license', 'delivery');
    expect(await service.retrieveActivation(customer, 'license', 'delivery')).toEqual(first);
    expect(first).toMatchObject({ activationKey: 'secret', deliveryId: 'delivery' });
    expect(envelopes.consume).not.toHaveBeenCalled();
  });
  it('rejects application callers outside the Customer and Provider roles', async () => {
    const repository = {
      listProvider: vi.fn(),
    } as unknown as Mocked<LicenseProjectionRepository>;
    const service = new LicenseQueryService(
      repository,
      {} as Mocked<ActivationEnvelopePort>,
      {} as Redis,
    );

    await expect(
      service.list({ ...provider, role: 'SYSTEM_ADMIN' }),
    ).rejects.toThrowError(expect.objectContaining({ status: 403 }));
    expect(repository.listProvider.mock.calls).toHaveLength(0);
  });

  it('does not return an envelope whose commitment differs from durable license state', async () => {
    const commandId = '00000000-0000-4000-8000-000000000901';
    const licenseId = '00000000-0000-4000-8000-000000000401';
    const repository = {
      activationCommand: vi.fn().mockResolvedValue({
        command_id: commandId,
        commitment: `0x${'11'.repeat(32)}`,
        key_version: 1,
        license_id: licenseId,
      }),
    } as unknown as Mocked<LicenseProjectionRepository>;
    const envelopes = {
      read: vi.fn().mockResolvedValue({
        commandId,
        commitment: `0x${'22'.repeat(32)}`,
        keyVersion: 1,
        licenseId,
        secret: `0x${'33'.repeat(32)}`,
      }),
    } as unknown as Mocked<ActivationEnvelopePort>;
    const service = new LicenseQueryService(repository, envelopes, {} as Redis);

    await expect(
      service.retrieveActivation(customer, licenseId, 'delivery'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('lists devices only for the authenticated customer license owner', async () => {
    const repository = {
      listCustomerDevices: vi.fn().mockResolvedValue([
        {
          activatedAt: null,
          bindingGeneration: 1,
          deviceRef: 'device-1',
          finality: 'CONFIRMED',
          id: '00000000-0000-4000-8000-000000000902',
          revokedAt: null,
          status: 'ACTIVE',
        },
      ]),
    } as unknown as Mocked<LicenseProjectionRepository>;
    const service = new LicenseQueryService(
      repository,
      {} as Mocked<ActivationEnvelopePort>,
      {} as Redis,
    );

    await expect(service.listDevices(customer, '00000000-0000-4000-8000-000000000401'))
      .resolves.toHaveLength(1);
    expect(repository.listCustomerDevices.mock.calls[0]).toEqual([
      customer.sub,
      '00000000-0000-4000-8000-000000000401',
    ]);
  });

  it('exposes only safe activation-key availability metadata for a trusted customer license', async () => {
    const license = {
      id: '00000000-0000-4000-8000-000000000401',
      status: 'ACTIVE',
    };
    const repository = {
      listCustomer: vi.fn().mockResolvedValue([license]),
      activationCommand: vi.fn().mockResolvedValue({ command_id: 'command-1' }),
    } as unknown as Mocked<LicenseProjectionRepository>;
    const envelopes = {
      exists: vi.fn().mockResolvedValue(true),
    } as unknown as Mocked<ActivationEnvelopePort>;
    const service = new LicenseQueryService(repository, envelopes, {} as Redis);

    await expect(service.list(customer)).resolves.toEqual([
      { ...license, activationKeyAvailable: true },
    ]);
    const existsCalls = (envelopes.exists as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(existsCalls).toEqual([['command-1']]);
  });

  it('allows public verification by either publicLicenseId or 32-byte hex activation key and enriches live on-chain verification', async () => {
    const rawKeyA = `0x${'a1'.repeat(32)}` as const;
    const txHash1 = `0x${'11'.repeat(32)}`;
    const blockHash1 = `0x${'b1'.repeat(32)}`;
    const repository = {
      findPublic: vi.fn().mockResolvedValue({
        state: 'CHAIN_CONFIRMED',
        licenseId: 'EMU-5375ECB21E024624A827',
        status: 'ACTIVE',
        productName: 'Classroom Hub',
        plan: { name: 'Business', version: 1, commitment: `0x${'ab'.repeat(32)}` },
        provider: { displayName: 'Provider 01', organizationName: 'Classroom Hub Corp' },
        periodStart: '2026-11-10T02:30:00.000Z',
        expiresAt: '2027-11-10T02:30:00.000Z',
        maxActiveDevices: 5,
        activeDeviceCount: 2,
        keyVersion: 2,
        matchedBy: 'HISTORICAL_ROTATED_KEY',
        matchedKeyVersion: 1,
        finality: 'CONFIRMED',
        confirmationCount: 12,
        blockNumber: 11842400,
        transactionHash: txHash1,
        network: 'sepolia',
        chainId: 11155111,
        contractAddress: '0x4d30200f3d0791e0ae34fa6075a4e4b03f4d1cbc',
        historyComplete: true,
        historySource: 'INDEXED_ONCHAIN_LOGS',
        history: [
          {
            id: 'evt-1',
            eventType: 'LICENSE_ISSUED',
            title: 'Kích hoạt bản quyền',
            description: 'License được phát hành và kích hoạt lần đầu trên Blockchain.',
            status: 'CONFIRMED',
            occurredAt: '2026-11-10T02:30:00.000Z',
            blockTimestamp: null,
            observedAt: '2026-11-10T02:30:05.000Z',
            finalizedAt: '2026-11-10T02:30:30.000Z',
            transactionHash: txHash1,
            blockNumber: 11842400,
            blockHash: blockHash1,
            logIndex: 0,
            transactionIndex: 3,
            confirmationCount: 12,
            commandId: '00000000-0000-4000-8000-000000000901',
            commandSequence: 1,
            network: 'sepolia',
            chainId: 11155111,
            contractAddress: '0x4d30200f3d0791e0ae34fa6075a4e4b03f4d1cbc',
            changes: [],
          },
        ],
      }),
    } as unknown as Mocked<LicenseProjectionRepository>;

    const redis = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    } as unknown as Redis;

    const chainRpc = {
      blockHash: vi.fn().mockResolvedValue(blockHash1),
      blockTimestamp: vi.fn().mockResolvedValue(new Date('2026-11-10T02:30:12.000Z')),
      contractEvents: vi.fn(),
      latestBlock: vi.fn().mockResolvedValue(11842420),
    };

    const service = new LicenseQueryService(
      repository,
      {} as Mocked<ActivationEnvelopePort>,
      redis,
      30,
      undefined,
      undefined,
      20,
      chainRpc,
    );

    const verified = await service.verify(rawKeyA, '127.0.0.1');
    expect(repository.findPublic).toHaveBeenCalledWith(rawKeyA);
    expect(verified.state).toBe('CHAIN_CONFIRMED');
    expect(verified.matchedBy).toBe('HISTORICAL_ROTATED_KEY');
    expect(verified.rpcStatus).toBe('VERIFIED');
    expect(verified.historySource).toBe('ONCHAIN_VERIFIED');
    expect(verified.history?.[0]?.blockTimestamp).toBe('2026-11-10T02:30:12.000Z');
  });

  it('builds chronological blockchain lifecycle history and resolves rotated keys in LicenseProjectionRepository.findPublic', async () => {
    const keyV1 = `0x${'11'.repeat(32)}` as const;
    const keyV2 = `0x${'22'.repeat(32)}` as const;
    const keyV3 = `0x${'33'.repeat(32)}` as const;
    const commitV1Hex = activationCommitment(keyV1).slice(2);
    const commitV2Hex = activationCommitment(keyV2).slice(2);
    const commitV3Hex = activationCommitment(keyV3).slice(2);

    const licenseRow = {
      id: '00000000-0000-4000-8000-000000000401',
      public_license_id: 'EMU-5375ECB21E024624A827',
      origin_order_id: '00000000-0000-4000-8000-000000000501',
      status: 'ACTIVE',
      period_start: new Date('2026-11-10T02:30:00.000Z'),
      expires_at: new Date('2028-11-10T02:30:00.000Z'),
      max_active_devices: 5,
      active_device_count: 2,
      device_state_version: '2',
      activation_key_version: 3,
      activation_key_last4: keyV3.slice(-4),
      activation_key_trust_status: 'TRUSTED',
      entitlement_version: 2,
      created_at: new Date('2026-11-10T02:30:00.000Z'),
      updated_at: new Date('2026-11-16T07:10:00.000Z'),
      product_name: 'Classroom Hub Business',
      plan_name: 'Enterprise 5 Devices',
      plan_version: 1,
      plan_commitment_hex: 'ab'.repeat(32),
      provider_display_name: 'Classroom Hub Provider',
      provider_org: 'Classroom Hub Education',
      finality_status: 'CONFIRMED',
      confirmation_count: 18,
      block_number: '11842900',
      transaction_hash: `0x${'e6'.repeat(32)}`,
      event_count: '6',
      reorg_events: '0',
      unknown_commands: '0',
      matched_by: 'HISTORICAL_ROTATED_KEY',
      matched_key_version: 1,
    };

    const historyRows = [
      {
        event_id: '00000000-0000-4000-8000-00000000e001',
        command_id: '00000000-0000-4000-8000-00000000c001',
        command_sequence: '1',
        command_type: 'ISSUE_LICENSE',
        command_status: 'CONFIRMED',
        event_type: 'LICENSE_ISSUED',
        finality_status: 'CONFIRMED',
        transaction_hash: `0x${'e1'.repeat(32)}`,
        block_number: '11842400',
        block_hash: `0x${'b1'.repeat(32)}`,
        log_index: 0,
        confirmation_count: 50,
        network: 'sepolia',
        chain_id: '11155111',
        contract_address: '0x4d30200f3d0791e0ae34fa6075a4e4b03f4d1cbc',
        activation_commitment_hex: commitV1Hex,
        activation_key_version: 1,
        previous_activation_commitment_hex: null,
        previous_activation_key_version: null,
        event_payload: {
          activationCommitment: `0x${commitV1Hex}`,
          expiresAt: '2027-11-10T02:30:00.000Z',
          keyVersion: 1,
          planCommitment: `0x${'ab'.repeat(32)}`,
          transactionIndex: 1,
        },
        command_payload: {
          expiresAt: '2027-11-10T02:30:00.000Z',
          maxActiveDevices: 5,
          planVersion: 1,
        },
        observed_at: new Date('2026-11-10T02:30:00.000Z'),
        finalized_at: new Date('2026-11-10T02:30:24.000Z'),
        submitted_at: new Date('2026-11-10T02:29:50.000Z'),
        confirmed_at: new Date('2026-11-10T02:30:24.000Z'),
        created_at: new Date('2026-11-10T02:29:45.000Z'),
      },
      {
        event_id: '00000000-0000-4000-8000-00000000e002',
        command_id: '00000000-0000-4000-8000-00000000c002',
        command_sequence: '2',
        command_type: 'SYNC_DEVICE_COUNT',
        command_status: 'CONFIRMED',
        event_type: 'ACTIVE_DEVICE_COUNT_SYNCED',
        finality_status: 'CONFIRMED',
        transaction_hash: `0x${'e2'.repeat(32)}`,
        block_number: '11842500',
        block_hash: `0x${'b2'.repeat(32)}`,
        log_index: 2,
        confirmation_count: 40,
        network: 'sepolia',
        chain_id: '11155111',
        contract_address: '0x4d30200f3d0791e0ae34fa6075a4e4b03f4d1cbc',
        activation_commitment_hex: null,
        activation_key_version: null,
        previous_activation_commitment_hex: null,
        previous_activation_key_version: null,
        event_payload: {
          activeDeviceCount: 2,
          deviceStateVersion: 1,
          transactionIndex: 4,
        },
        command_payload: {
          activeDeviceCount: 2,
          deviceStateVersion: 1,
        },
        observed_at: new Date('2026-11-12T07:15:00.000Z'),
        finalized_at: new Date('2026-11-12T07:15:24.000Z'),
        submitted_at: new Date('2026-11-12T07:14:50.000Z'),
        confirmed_at: new Date('2026-11-12T07:15:24.000Z'),
        created_at: new Date('2026-11-12T07:14:45.000Z'),
      },
      {
        event_id: '00000000-0000-4000-8000-00000000e003',
        command_id: '00000000-0000-4000-8000-00000000c003',
        command_sequence: '3',
        command_type: 'ROTATE_KEY',
        command_status: 'CONFIRMED',
        event_type: 'KEY_ROTATED',
        finality_status: 'CONFIRMED',
        transaction_hash: `0x${'e3'.repeat(32)}`,
        block_number: '11842600',
        block_hash: `0x${'b3'.repeat(32)}`,
        log_index: 1,
        confirmation_count: 35,
        network: 'sepolia',
        chain_id: '11155111',
        contract_address: '0x4d30200f3d0791e0ae34fa6075a4e4b03f4d1cbc',
        activation_commitment_hex: commitV2Hex,
        activation_key_version: 2,
        previous_activation_commitment_hex: commitV1Hex,
        previous_activation_key_version: 1,
        event_payload: {
          activationCommitment: `0x${commitV2Hex}`,
          keyVersion: 2,
        },
        command_payload: {
          activationCommitment: `0x${commitV2Hex}`,
          keyVersion: 2,
          previousActivationCommitment: `0x${commitV1Hex}`,
          previousKeyVersion: 1,
        },
        observed_at: new Date('2026-11-15T03:20:00.000Z'),
        finalized_at: new Date('2026-11-15T03:20:24.000Z'),
        submitted_at: new Date('2026-11-15T03:19:50.000Z'),
        confirmed_at: new Date('2026-11-15T03:20:24.000Z'),
        created_at: new Date('2026-11-15T03:19:45.000Z'),
      },
      {
        event_id: '00000000-0000-4000-8000-00000000e004',
        command_id: '00000000-0000-4000-8000-00000000c004',
        command_sequence: '4',
        command_type: 'ROTATE_KEY',
        command_status: 'CONFIRMED',
        event_type: 'KEY_ROTATED',
        finality_status: 'CONFIRMED',
        transaction_hash: `0x${'e4'.repeat(32)}`,
        block_number: '11842600',
        block_hash: `0x${'b3'.repeat(32)}`,
        log_index: 5,
        confirmation_count: 35,
        network: 'sepolia',
        chain_id: '11155111',
        contract_address: '0x4d30200f3d0791e0ae34fa6075a4e4b03f4d1cbc',
        activation_commitment_hex: commitV3Hex,
        activation_key_version: 3,
        previous_activation_commitment_hex: commitV2Hex,
        previous_activation_key_version: 2,
        event_payload: {
          activationCommitment: `0x${commitV3Hex}`,
          keyVersion: 3,
        },
        command_payload: {
          activationCommitment: `0x${commitV3Hex}`,
          keyVersion: 3,
          previousActivationCommitment: `0x${commitV2Hex}`,
          previousKeyVersion: 2,
        },
        observed_at: new Date('2026-11-15T03:20:00.000Z'),
        finalized_at: new Date('2026-11-15T03:20:24.000Z'),
        submitted_at: new Date('2026-11-15T03:19:55.000Z'),
        confirmed_at: new Date('2026-11-15T03:20:24.000Z'),
        created_at: new Date('2026-11-15T03:19:52.000Z'),
      },
      {
        event_id: '00000000-0000-4000-8000-00000000e005',
        command_id: '00000000-0000-4000-8000-00000000c005',
        command_sequence: '5',
        command_type: 'RENEW_LICENSE',
        command_status: 'CONFIRMED',
        event_type: 'LICENSE_RENEWED',
        finality_status: 'CONFIRMED',
        transaction_hash: `0x${'e5'.repeat(32)}`,
        block_number: '11842800',
        block_hash: `0x${'b5'.repeat(32)}`,
        log_index: 0,
        confirmation_count: 25,
        network: 'sepolia',
        chain_id: '11155111',
        contract_address: '0x4d30200f3d0791e0ae34fa6075a4e4b03f4d1cbc',
        activation_commitment_hex: null,
        activation_key_version: null,
        previous_activation_commitment_hex: null,
        previous_activation_key_version: null,
        event_payload: {
          expiresAt: '2028-11-10T02:30:00.000Z',
        },
        command_payload: {
          expiresAt: '2028-11-10T02:30:00.000Z',
        },
        observed_at: new Date('2026-11-16T07:05:00.000Z'),
        finalized_at: new Date('2026-11-16T07:05:24.000Z'),
        submitted_at: new Date('2026-11-16T07:04:50.000Z'),
        confirmed_at: new Date('2026-11-16T07:05:24.000Z'),
        created_at: new Date('2026-11-16T07:04:45.000Z'),
      },
      {
        event_id: null,
        command_id: '00000000-0000-4000-8000-00000000c006',
        command_sequence: '6',
        command_type: 'SUSPEND_LICENSE',
        command_status: 'SUBMITTED',
        event_type: 'LICENSE_SUSPENDED',
        finality_status: 'PENDING',
        transaction_hash: `0x${'e6'.repeat(32)}`,
        block_number: null,
        block_hash: null,
        log_index: null,
        confirmation_count: 0,
        network: 'sepolia',
        chain_id: '11155111',
        contract_address: '0x4d30200f3d0791e0ae34fa6075a4e4b03f4d1cbc',
        activation_commitment_hex: null,
        activation_key_version: null,
        previous_activation_commitment_hex: null,
        previous_activation_key_version: null,
        event_payload: null,
        command_payload: {
          reason: 'Bảo trì định kỳ theo yêu cầu đơn vị',
        },
        observed_at: null,
        finalized_at: null,
        submitted_at: new Date('2026-11-16T09:00:00.000Z'),
        confirmed_at: null,
        created_at: new Date('2026-11-16T08:59:55.000Z'),
      },
    ];

    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [licenseRow] })
        .mockResolvedValueOnce({ rows: historyRows }),
    } as unknown as Pool;

    const repo = new LicenseProjectionRepository(pool);
    const result = await repo.findPublic(keyV1);

    expect(result.state).toBe('CHAIN_CONFIRMED');
    expect(result.licenseId).toBe('EMU-5375ECB21E024624A827');
    expect(result.matchedBy).toBe('HISTORICAL_ROTATED_KEY');
    expect(result.matchedKeyVersion).toBe(1);
    expect(result.keyVersion).toBe(3);
    expect(result.history).toHaveLength(6);

    // Chronological order: oldest (LICENSE_ISSUED) -> device sync -> rotate v2 -> rotate v3 (same block, higher logIndex) -> renew -> pending suspend
    expect(result.history?.map((item) => item.eventType)).toEqual([
      'LICENSE_ISSUED',
      'ACTIVE_DEVICE_COUNT_SYNCED',
      'KEY_ROTATED',
      'KEY_ROTATED',
      'LICENSE_RENEWED',
      'LICENSE_SUSPENDED',
    ]);

    // Check before -> after state changes on rotation and renewal
    const firstRotate = result.history?.[2];
    expect(firstRotate?.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'keyVersion',
          previousValue: 'Phiên bản Key v1',
          currentValue: 'Phiên bản Key v2',
        }),
      ]),
    );

    const secondRotate = result.history?.[3];
    expect(secondRotate?.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'keyVersion',
          previousValue: 'Phiên bản Key v2',
          currentValue: 'Phiên bản Key v3',
        }),
      ]),
    );

    const renewal = result.history?.[4];
    expect(renewal?.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'expiresAt',
          previousValue: '2027-11-10T02:30:00.000Z',
          currentValue: '2028-11-10T02:30:00.000Z',
        }),
      ]),
    );

    const pendingSuspend = result.history?.[5];
    expect(pendingSuspend?.status).toBe('PENDING');
  });
});
