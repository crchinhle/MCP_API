import type { Redis } from 'ioredis';
import type { Mocked } from 'vitest';

import { LicenseQueryService } from '../../../../EmuKey/backend/src/modules/blockchain/application/license-query.service.js';
import type { ActivationEnvelopePort } from '../../../../EmuKey/backend/src/modules/blockchain/application/ports/activation-envelope.port.js';
import type { LicenseProjectionRepository } from '../../../../EmuKey/backend/src/modules/blockchain/infrastructure/license-projection.repository.js';
import type { AuthPrincipal } from '../../../../EmuKey/backend/src/modules/identity-access/identity.types.js';

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
});
