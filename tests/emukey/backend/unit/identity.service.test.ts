import { IdentityService, type IdentityRedis, type PasswordRepository } from '../../../../EmuKey/backend/src/modules/identity-access/identity.service.js';
import type { IdentityUser } from '../../../../EmuKey/backend/src/modules/identity-access/identity.types.js';
import { vi } from 'vitest';
import { verify } from 'argon2';

const user: IdentityUser = { id: 'u1', email: 'a@b.test', passwordHash: '', displayName: 'A', role: 'SUPPORT_STAFF', status: 'ACTIVE', sessionVersion: 1, organizationName: null, customerType: null, emailVerifiedAt: null, phone: null, address: null, failedLoginCount: 0, lockedUntil: null };
class FakeRedis implements IdentityRedis {
  data = new Map<string, string>();
  set(key: string, value: string) { this.data.set(key, value); return Promise.resolve('OK'); }
  get(key: string) { return Promise.resolve(this.data.get(key) ?? null); }
  del(key: string) { return Promise.resolve(this.data.delete(key) ? 1 : 0); }
  eval(script: string, numKeys: number, ...args: (number | string)[]) {
    const key = String(args[0]);
    const value = this.data.get(key) ?? null;
    if (script.includes("GET',KEYS[1]) == ARGV[1]")) {
      if (value !== String(args[1])) return Promise.resolve(0);
      this.data.delete(key);
      return Promise.resolve(1);
    }
    this.data.delete(key);
    if (numKeys === 2 && value) this.data.set(String(args[1]), value);
    return Promise.resolve(value);
  }
  incr(key: string) { const value = Number(this.data.get(key) ?? 0) + 1; this.data.set(key, String(value)); return Promise.resolve(value); }
  expire() { return Promise.resolve(1); }
}
function repo(): PasswordRepository { return { findByEmail: vi.fn(() => Promise.resolve(user)), findById: vi.fn(() => Promise.resolve(user)), listUsers: vi.fn(() => Promise.resolve([user])), activateCustomer: vi.fn(), createCustomer: vi.fn(), createProviderInvitation: vi.fn(), listProviderInvitations: vi.fn(), markProviderInvitationSent: vi.fn(), acceptProviderInvitation: vi.fn(), isProviderInvitationPending: vi.fn().mockResolvedValue(true), updatePassword: vi.fn(), touchLogin: vi.fn(), bumpSessionVersion: vi.fn(), updateProfile: vi.fn(), changeStateByAdmin: vi.fn(), recordFailedLogin: vi.fn(), unlockExpired: vi.fn() }; }

describe('IdentityService', () => {
  const providerInput = { email: 'provider@example.test', displayName: 'Provider Owner', organizationName: 'Provider Ltd', providerChainAddress: `0x${'ab'.repeat(20)}`, providerChainNamespace: 'provider-ltd' };
  const admin = { sub: 'admin-1', role: 'SYSTEM_ADMIN' as const, sessionVersion: 1 };

  it('persists a hashed invitation and sends the secret only by email without creating an active user', async () => {
    let secret = '';
    let digest = '';
    const repository = { ...repo(), createProviderInvitation: vi.fn(async (_actor, _input, tokenHash) => { digest = tokenHash; return { id: 'invite-1', email: providerInput.email }; }) };
    const service = new IdentityService(repository, new FakeRedis(), new TextEncoder().encode('test-secret'), {
      sendEmailVerification: vi.fn(), sendPasswordReset: vi.fn(),
      sendProviderInvitation: async (_email, token) => { secret = token; },
    });
    const result = await service.inviteProvider(admin, providerInput);
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toBe(secret);
    expect(result).not.toHaveProperty('token');
    expect(await repository.findByEmail(providerInput.email)).not.toMatchObject({ role: 'PROVIDER_ADMIN' });
  });

  it.each(['CUSTOMER', 'SUPPORT_STAFF', 'PROVIDER_ADMIN'] as const)('rejects provider invitations from %s', async (role) => {
    const service = new IdentityService(repo(), new FakeRedis(), new TextEncoder().encode('test-secret'), { sendEmailVerification: vi.fn(), sendPasswordReset: vi.fn() });
    await expect(service.inviteProvider({ ...admin, role }, providerInput)).rejects.toMatchObject({ status: 403 });
  });

  it('hashes the recipient password and delegates atomic one-time activation to PostgreSQL', async () => {
    let passwordHash = '';
    const repository = { ...repo(), acceptProviderInvitation: vi.fn(async (_digest, hash) => { passwordHash = hash; return { ...user, role: 'PROVIDER_ADMIN' as const }; }) };
    const service = new IdentityService(repository, new FakeRedis(), new TextEncoder().encode('test-secret'), { sendEmailVerification: vi.fn(), sendPasswordReset: vi.fn() });
    const result = await service.acceptProviderInvitation('a'.repeat(43), 'Provider-test@123');
    expect(await verify(passwordHash, 'Provider-test@123')).toBe(true);
    expect(result).toMatchObject({ role: 'PROVIDER_ADMIN', status: 'ACTIVE' });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('limits acceptance attempts by requester even when every token differs', async () => {
    const repository = { ...repo(), isProviderInvitationPending: vi.fn().mockResolvedValue(false) };
    const service = new IdentityService(repository, new FakeRedis(), new TextEncoder().encode('test-secret'), { sendEmailVerification: vi.fn(), sendPasswordReset: vi.fn() });
    for (let i = 0; i < 10; i++) await expect(service.acceptProviderInvitation(String(i).padStart(43, 'a'), 'Provider-test@123', 'requester-1')).rejects.toMatchObject({ status: 400 });
    await expect(service.acceptProviderInvitation('z'.repeat(43), 'Provider-test@123', 'requester-1')).rejects.toMatchObject({ status: 429 });
  });

  it('rejects expired or previously accepted invitations', async () => {
    const repository = { ...repo(), acceptProviderInvitation: vi.fn().mockResolvedValue(null) };
    const service = new IdentityService(repository, new FakeRedis(), new TextEncoder().encode('test-secret'), { sendEmailVerification: vi.fn(), sendPasswordReset: vi.fn() });
    await expect(service.acceptProviderInvitation('a'.repeat(43), 'Provider-test@123')).rejects.toMatchObject({ response: { code: 'INVALID_OR_EXPIRED_INVITATION' } });
  });
  it('fails immediately when email token delivery is missing', () => {
    expect(() => new IdentityService(repo(), new FakeRedis(), new TextEncoder().encode('test-secret'), undefined as never))
      .toThrow('IDENTITY_TOKEN_DELIVERY_REQUIRED');
  });
  it('binds licensing email confirmations to one user, license and action and consumes them once', async () => {
    const customer = { ...user, role: 'CUSTOMER' as const, emailVerifiedAt: new Date() };
    const repository = { ...repo(), findById: vi.fn(() => Promise.resolve(customer)) };
    const redis = new FakeRedis();
    let deliveredToken = '';
    const service = new IdentityService(repository, redis, new TextEncoder().encode('test-secret'), {
      sendEmailVerification: vi.fn(),
      sendLicensingActionVerification: vi.fn((_email: string, token: string) => { deliveredToken = token; return Promise.resolve(); }),
      sendPasswordReset: vi.fn(),
    });

    await service.issueLicensingActionVerification('u1', 'license-1', 'ROTATE_KEY');
    const replayCandidate = deliveredToken;
    await expect(service.consumeLicensingActionVerification(replayCandidate, 'u1', 'license-1', 'REVOKE_DEVICE'))
      .rejects.toMatchObject({ response: { code: 'INVALID_OR_EXPIRED_ACTION_TOKEN' } });
    await expect(service.consumeLicensingActionVerification(replayCandidate, 'u1', 'license-1', 'ROTATE_KEY')).resolves.toBeUndefined();
    await expect(service.consumeLicensingActionVerification(deliveredToken, 'u1', 'license-1', 'ROTATE_KEY'))
      .rejects.toMatchObject({ response: { code: 'INVALID_OR_EXPIRED_ACTION_TOKEN' } });
  });

  it('binds remote revoke email confirmations to the exact device', async () => {
    const customer = { ...user, role: 'CUSTOMER' as const, emailVerifiedAt: new Date() };
    const repository = { ...repo(), findById: vi.fn(() => Promise.resolve(customer)) };
    const redis = new FakeRedis();
    let deliveredToken = '';
    const service = new IdentityService(repository, redis, new TextEncoder().encode('test-secret'), {
      sendEmailVerification: vi.fn(),
      sendLicensingActionVerification: vi.fn((_email: string, token: string) => { deliveredToken = token; return Promise.resolve(); }),
      sendPasswordReset: vi.fn(),
    });

    await service.issueLicensingActionVerification('u1', 'license-1', 'REMOTE_REVOKE_DEVICE', 'device-1');
    await expect(service.consumeLicensingActionVerification(deliveredToken, 'u1', 'license-1', 'REMOTE_REVOKE_DEVICE', 'device-2'))
      .rejects.toMatchObject({ response: { code: 'INVALID_OR_EXPIRED_ACTION_TOKEN' } });
    await expect(service.consumeLicensingActionVerification(deliveredToken, 'u1', 'license-1', 'REMOTE_REVOKE_DEVICE', 'device-1'))
      .resolves.toBeUndefined();
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const redis = new FakeRedis(); const service = new IdentityService(repo(), redis, new TextEncoder().encode('test-secret'), { sendEmailVerification: vi.fn(), sendPasswordReset: vi.fn() }); const first = await service.issue(user); const second = await service.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(service.refresh(first.refreshToken)).rejects.toMatchObject({ response: { code: 'REFRESH_REUSE_DETECTED' } });
  });
  it('consumes reset tokens once and bumps the durable session version', async () => {
    const repository = repo(); const redis = new FakeRedis(); const service = new IdentityService(repository, redis, new TextEncoder().encode('test-secret'), { sendEmailVerification: vi.fn(), sendPasswordReset: vi.fn() }); await service.forgotPassword(user.email);
    expect([...redis.data.keys()].filter((key) => key.startsWith('reset:'))).toHaveLength(1);
    const token = 'not-readable-from-redis';
    await expect(service.resetPassword(token, 'new-password-123')).rejects.toMatchObject({ response: { code: 'INVALID_OR_EXPIRED_TOKEN' } });
  });
});
