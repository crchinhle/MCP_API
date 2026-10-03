import type { Redis } from 'ioredis';
import type { Mocked } from 'vitest';

import { LicenseQueryService } from '../../src/modules/blockchain/application/license-query.service.js';
import type { ActivationEnvelopePort } from '../../src/modules/blockchain/application/ports/activation-envelope.port.js';
import type { LicenseProjectionRepository } from '../../src/modules/blockchain/infrastructure/license-projection.repository.js';
import type { AuthPrincipal } from '../../src/modules/identity-access/identity.types.js';

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
      consume: vi.fn().mockResolvedValue({
        commandId,
        commitment: `0x${'22'.repeat(32)}`,
        keyVersion: 1,
        licenseId,
        secret: `0x${'33'.repeat(32)}`,
      }),
    } as unknown as Mocked<ActivationEnvelopePort>;
    const service = new LicenseQueryService(repository, envelopes, {} as Redis);

    await expect(
      service.retrieveActivation(customer, licenseId),
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
