import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createHmac } from 'node:crypto';
import { SignJWT } from 'jose';

import { LicensingService } from '../../src/modules/licensing/licensing.service.js';
import { activationCommitment } from '../../src/platform/crypto/license-crypto.js';

const customer = {
  role: 'CUSTOMER' as const,
  sessionVersion: 1,
  sub: '00000000-0000-4000-8000-000000000004',
};
const licenseId = '00000000-0000-4000-8000-000000000401';
const secret: Hex = `0x${'11'.repeat(32)}`;
const devicePrivateKey: Hex = `0x${'22'.repeat(32)}`;
const deviceAddress = privateKeyToAccount(devicePrivateKey).address;

function fixture() {
  const challenge = 'emukey:test-device-challenge';
  const redis = {
    del: vi.fn(),
    eval: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(challenge),
    set: vi.fn(),
  };
  const repository = {
    createDeviceCommand: vi.fn().mockResolvedValue({
      commandId: '00000000-0000-4000-8000-000000000901',
      deviceId: '00000000-0000-4000-8000-000000000902',
      licenseId,
      status: 'PENDING',
    }),
    createDeviceRevokeCommand: vi.fn(),
    createRotationCommand: vi.fn(),
    findActivationLicense: vi.fn().mockResolvedValue({
      activationCommitment: activationCommitment(secret),
      activationKeyVersion: 1,
      customerUserId: customer.sub,
      expiresAt: new Date(Date.now() + 86_400_000),
      id: licenseId,
      maxActiveDevices: 2,
      providerUserId: '00000000-0000-4000-8000-000000000002',
      status: 'ACTIVE',
    }),
    findSecurity: vi.fn().mockResolvedValue({
      activationCommitment: activationCommitment(secret),
      activationKeyVersion: 1,
      customerUserId: customer.sub,
      expiresAt: new Date(Date.now() + 86_400_000),
      id: licenseId,
      maxActiveDevices: 2,
      providerUserId: '00000000-0000-4000-8000-000000000002',
      status: 'ACTIVE',
    }),
    findDevice: vi.fn().mockResolvedValue(null),
    findDeviceById: vi.fn(),
  };
  const service = new LicensingService(
    repository as never,
    {} as never,
    {} as never,
    redis as never,
    new TextEncoder().encode('test-secret'),
    { chainId: 31_337, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'hardhat' },
  );
  return { challenge, deviceAddress, redis, repository, service };
}

describe('LicensingService Phase 6 boundaries', () => {
  it('rejects a bearer key that does not match the current commitment', async () => {
    const { service } = fixture();

    await expect(
      service.activate(customer, {
        activationKey: `0x${'33'.repeat(32)}`,
        challenge: 'emukey:test-device-challenge',
        devicePublicKey: deviceAddress,
        deviceRef: 'opaque-device-1',
        licenseId,
        proof: `0x${'44'.repeat(65)}`,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('verifies the bearer key and device signature before activating a PostgreSQL device row', async () => {
    const { challenge, deviceAddress, repository, service } = fixture();
    const proof = await privateKeyToAccount(devicePrivateKey).signMessage({ message: challenge });

    await expect(
      service.activate(customer, {
        activationKey: secret,
        challenge,
        devicePublicKey: deviceAddress,
        deviceRef: 'opaque-device-1',
        licenseId,
        proof,
      }),
    ).resolves.toMatchObject({ status: 'ACTIVE', licenseId });
    expect(repository.createDeviceCommand).toHaveBeenCalledWith(
      null,
      licenseId,
      createHmac('sha256', new TextEncoder().encode('test-secret')).update('device-ref:opaque-device-1').digest('hex'),
      deviceAddress,
      expect.any(String),
      1,
      expect.objectContaining({ chainId: 31_337 }),
    );
    expect(repository.findActivationLicense).toHaveBeenCalledWith(activationCommitment(secret));
  });

  it('does not reveal or mutate a license outside the authenticated customer scope', async () => {
    const { repository, service } = fixture();
    repository.findSecurity.mockResolvedValueOnce(null);

    await expect(
      service.challenge(customer, {
        deviceRef: 'device-owned-by-another-customer',
        licenseId,
        purpose: 'ISSUE_ENTITLEMENT',
        deviceId: '00000000-0000-4000-8000-000000000902',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findSecurity).toHaveBeenCalledWith(licenseId);
  });

  it('binds a one-time challenge to purpose, key version and binding generation', async () => {
    const { redis, service } = fixture();

    const result = await service.challenge(customer, {
        activationKey: secret,
        deviceRef: 'new-device',
        licenseId,
        purpose: 'ACTIVATE_DEVICE',
    });

    expect(result).toMatchObject({ bindingGeneration: 1, keyVersion: 1, purpose: 'ACTIVATE_DEVICE' });
    expect(result.challenge).toMatch(
      new RegExp(`^emukey:v1:ACTIVATE_DEVICE:${licenseId}:[0-9a-f]{64}:1:1:[0-9]+:[A-Za-z0-9_-]+$`),
    );
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining(':ACTIVATE_DEVICE:1:1'),
      result.challenge,
      'EX',
      300,
    );
  });

  it('does not issue entitlement while the device is not active in PostgreSQL', async () => {
    const projection = {
      entitlementContext: vi.fn().mockResolvedValue({
        deviceStatus: 'REVOKED',
        entitlementVersion: 1,
        entitlements: { desktop: true },
        expiresAt: new Date(Date.now() + 86_400_000),
        finality: 'PENDING',
        licenseFinality: 'CONFIRMED',
        status: 'ACTIVE',
      }),
    };
    const gated = new LicensingService(
      {} as never,
      projection as never,
      {} as never,
      {} as never,
      new TextEncoder().encode('test-secret'),
      { chainId: 31_337, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'hardhat' },
    );

    await expect(gated.issueEntitlement(customer, { licenseId, deviceId: '00000000-0000-4000-8000-000000000902', challenge: 'challenge', proof: `0x${'44'.repeat(65)}` }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a previously issued entitlement after its projection version changes', async () => {
    const jwtSecret = new TextEncoder().encode('test-secret');
    const projection = {
      entitlementContext: vi.fn().mockResolvedValue({
        deviceStatus: 'ACTIVE',
        entitlementVersion: 3,
        entitlements: { desktop: true },
        expiresAt: new Date(Date.now() + 86_400_000),
        finality: 'CONFIRMED',
        keyVersion: 2,
        licenseFinality: 'CONFIRMED',
        status: 'ACTIVE',
      }),
    };
    const service = new LicensingService(
      {} as never,
      projection as never,
      {} as never,
      {} as never,
      jwtSecret,
      { chainId: 31_337, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'hardhat' },
    );
    const staleToken = await new SignJWT({
      deviceId: '00000000-0000-4000-8000-000000000902',
      entitlementVersion: 2,
       bindingGeneration: 1,
       keyVersion: 1,
       licenseId,
      rights: { desktop: true },
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('emukey-licensing')
      .setAudience('emukey-license-client')
      .setExpirationTime('5m')
      .sign(jwtSecret);

    await expect(
      service.verifyEntitlement(customer, { token: staleToken }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('supports remote revoke without requiring proof from the lost device', async () => {
    const { repository } = fixture();
    repository.findDeviceById = vi.fn().mockResolvedValue({
      bindingGeneration: 4,
      devicePublicKey: deviceAddress,
      deviceRef: 'lost-device',
      id: '00000000-0000-4000-8000-000000000902',
      status: 'ACTIVE',
    });
    repository.createDeviceRevokeCommand = vi.fn().mockResolvedValue({
      commandId: '00000000-0000-4000-8000-000000000903',
      deviceId: '00000000-0000-4000-8000-000000000902',
      licenseId,
      status: 'PENDING',
    });
    const identity = {
      verifyCurrentPassword: vi.fn().mockResolvedValue(true),
      consumeLicensingActionVerification: vi.fn().mockResolvedValue(undefined),
    };
    const remote = new LicensingService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      new TextEncoder().encode('test-secret'),
      { chainId: 31_337, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'hardhat' },
      identity as never,
    );

    await expect(remote.remoteRevokeDevice(customer, licenseId, '00000000-0000-4000-8000-000000000902', {
      actionToken: 'remote-action-token',
      currentPassword: 'CurrentPassword1!',
    })).resolves.toMatchObject({ status: 'REVOKED', licenseId });
    expect(identity.consumeLicensingActionVerification).toHaveBeenCalledWith(
      'remote-action-token', customer.sub, licenseId, 'REMOTE_REVOKE_DEVICE', '00000000-0000-4000-8000-000000000902',
    );
    expect(repository.createDeviceRevokeCommand).toHaveBeenCalledWith(
      customer.sub,
      licenseId,
       'lost-device',
       '00000000-0000-4000-8000-000000000902',
       4,
      expect.objectContaining({ chainId: 31_337 }),
    );
  });

  it('recovers a lost activation key by creating a new on-chain rotation', async () => {
    const { repository } = fixture();
    repository.createRotationCommand = vi.fn().mockResolvedValue({
      commandId: '00000000-0000-4000-8000-000000000904',
      deviceId: null,
      licenseId,
      reused: false,
      status: 'PENDING',
    });
    const envelopes = { prepare: vi.fn().mockResolvedValue(undefined) };
    const identity = {
      verifyCurrentPassword: vi.fn().mockResolvedValue(true),
      consumeLicensingActionVerification: vi.fn().mockResolvedValue(undefined),
    };
    const recovery = new LicensingService(
      repository as never,
      {} as never,
      envelopes as never,
      {} as never,
      new TextEncoder().encode('test-secret'),
      { chainId: 31_337, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'hardhat' },
      identity as never,
    );

    await expect(recovery.recoverActivationKey(customer, licenseId, {
      actionToken: 'recovery-action-token',
      currentPassword: 'CurrentPassword1!',
    })).resolves.toMatchObject({ status: 'PENDING', licenseId });
    expect(identity.consumeLicensingActionVerification).toHaveBeenCalledWith(
      'recovery-action-token', customer.sub, licenseId, 'KEY_RECOVERY', undefined,
    );
    expect(repository.createRotationCommand).toHaveBeenCalledWith(
      customer.sub,
      licenseId,
      expect.stringMatching(/^0x[0-9a-f]{64}$/),
      2,
      expect.objectContaining({ chainId: 31_337 }),
    );
    expect(envelopes.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ commandId: '00000000-0000-4000-8000-000000000904', keyVersion: 2, licenseId }),
      86_400,
    );
  });

  it('resolves an email action token to its permitted context without consuming it', async () => {
    const { repository } = fixture();
    repository.findDeviceById = vi.fn().mockResolvedValue({
      bindingGeneration: 2,
      devicePublicKey: deviceAddress,
      deviceRef: 'other-device',
      id: '00000000-0000-4000-8000-000000000902',
      status: 'ACTIVE',
    });
    const identity = { resolveLicensingActionVerification: vi.fn().mockResolvedValue({
      action: 'REMOTE_REVOKE_DEVICE',
      deviceId: '00000000-0000-4000-8000-000000000902',
      expiresAt: new Date().toISOString(),
      licenseId,
    }) };
    const service = new LicensingService(
      repository as never, {} as never, {} as never, {} as never,
      new TextEncoder().encode('test-secret'),
      { chainId: 31_337, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'hardhat' },
      identity as never,
    );

    await expect(service.resolveActionVerification(customer, 'resolve-action-token')).resolves.toMatchObject({
      action: 'REMOTE_REVOKE_DEVICE', licenseId,
    });
    expect(identity.resolveLicensingActionVerification).toHaveBeenCalledWith('resolve-action-token', customer.sub);
  });

  it('does not resolve an action token that belongs to another account', async () => {
    const identity = { resolveLicensingActionVerification: vi.fn().mockRejectedValue(
      new UnauthorizedException({ code: 'INVALID_OR_EXPIRED_ACTION_TOKEN' }),
    ) };
    const service = new LicensingService(
      {} as never, {} as never, {} as never, {} as never,
      new TextEncoder().encode('test-secret'),
      { chainId: 31_337, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3', network: 'hardhat' },
      identity as never,
    );

    await expect(service.resolveActionVerification(customer, 'other-account-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
