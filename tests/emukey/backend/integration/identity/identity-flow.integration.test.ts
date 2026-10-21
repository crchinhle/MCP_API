import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { Pool } from 'pg';

import { IdentityRepository } from '../../../../../EmuKey/backend/src/modules/identity-access/identity.repository.js';
import { IdentityService } from '../../../../../EmuKey/backend/src/modules/identity-access/identity.service.js';
import { seedBaseline } from '../../../../../EmuKey/backend/src/platform/database/seed-baseline.js';

describe('identity security flow', () => {
  let postgres: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let pool: Pool;
  let redis: Redis;
  let repository: IdentityRepository;
  let service: IdentityService;
  let verificationToken = '';
  let invitationToken = '';
  const password = 'Identity-test@123';
  const profile = { displayName: 'Recipient Owner', organizationName: 'Recipient Organization' };

  beforeAll(async () => {
    [postgres, redisContainer] = await Promise.all([
      new PostgreSqlContainer('pgvector/pgvector:pg15')
        .withDatabase('emukey_identity_test')
        .withUsername('emukey')
        .withPassword('test-password')
        .start(),
      new RedisContainer('redis:8.2-alpine').start(),
    ]);
    pool = new Pool({ connectionString: postgres.getConnectionUri() });
    await pool.query(await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8'));
    await seedBaseline(pool, password);
    redis = new Redis(redisContainer.getConnectionUrl());
    repository = new IdentityRepository(pool);
    service = new IdentityService(
      repository,
      redis,
      new TextEncoder().encode('identity-integration-secret-32-bytes'),
      {
        sendEmailVerification: (_email, token) => {
          verificationToken = token;
          return Promise.resolve();
        },
        sendPasswordReset: () => Promise.resolve(),
        sendProviderInvitation: (_email, token) => { invitationToken = token; return Promise.resolve(); },
      },
    );
  }, 120_000);

  afterAll(async () => {
    if (redis) await redis.quit();
    if (pool) await pool.end();
    await Promise.all([postgres?.stop(), redisContainer?.stop()]);
  });

  it('seeds customer and internal identities and authenticates them', async () => {
    const roles = await pool.query<{ role: string }>('SELECT DISTINCT role FROM users ORDER BY role');
    expect(roles.rows.map(({ role }) => role)).toEqual([
      'CUSTOMER',
      'PROVIDER_ADMIN',
      'SUPPORT_STAFF',
      'SYSTEM_ADMIN',
    ]);
    const login = await service.login('provider.admin@example.test', password);
    expect(login.user).toMatchObject({ role: 'PROVIDER_ADMIN', status: 'ACTIVE' });
    expect(login.user).not.toHaveProperty('passwordHash');
    const customerLogin = await service.login('customer@example.test', password);
    expect(customerLogin.user).toMatchObject({ role: 'CUSTOMER', status: 'ACTIVE' });
  });

  it('registers a customer in pending verification state without a per-account key', async () => {
    await service.register({ customerType: 'STUDENT', displayName: 'New Customer', email: 'new.customer@example.test', password });
    const created = await repository.findByEmail('new.customer@example.test');
    expect(created).toMatchObject({ customerType: 'STUDENT', role: 'CUSTOMER', status: 'PENDING_EMAIL_VERIFICATION' });
    expect(created).not.toHaveProperty('controllerKey');
    await service.verifyEmail(verificationToken);
    const verified = await repository.findByEmail('new.customer@example.test');
    expect(verified?.status).toBe('ACTIVE');
    expect(verified?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('rotates refresh tokens and revokes the family on replay', async () => {
    const login = await service.login('support.staff@example.test', password);
    const rotated = await service.refresh(login.refreshToken);
    await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.authenticate(rotated.accessToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('persists invitations, invalidates replaced links, and activates exactly once under concurrent requests', async () => {
    const admin = { sub: '00000000-0000-4000-8000-000000000001', role: 'SYSTEM_ADMIN' as const, sessionVersion: 1 };
    const input = { email: 'invited.provider@example.test' };
    await service.inviteProvider(admin, input);
    const oldToken = invitationToken;
    expect(await repository.findByEmail(input.email)).toBeNull();
    expect(await service.inspectProviderInvitation(oldToken)).toMatchObject({ email: input.email });
    expect(await service.inspectProviderInvitation(oldToken)).toMatchObject({ email: input.email });
    await expect(service.register({ email: input.email, displayName: 'Impersonator', customerType: 'INDIVIDUAL', password })).rejects.toBeInstanceOf(ConflictException);
    await service.inviteProvider(admin, input);
    await expect(service.acceptProviderInvitation(oldToken, password, profile)).rejects.toMatchObject({ response: { code: 'INVALID_OR_EXPIRED_INVITATION' } });
    const outcomes = await Promise.allSettled([service.acceptProviderInvitation(invitationToken, password, profile), service.acceptProviderInvitation(invitationToken, password, profile)]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const login = await service.login(input.email, password);
    expect(login.user).toMatchObject({ role: 'PROVIDER_ADMIN', status: 'ACTIVE', displayName: profile.displayName });
    const identity = await pool.query('SELECT organization_name, provider_chain_address, provider_chain_namespace FROM users WHERE email = $1', [input.email]);
    expect(identity.rows[0]).toMatchObject({ organization_name: profile.organizationName, provider_chain_address: null, provider_chain_namespace: expect.stringMatching(/^provider-[0-9a-f-]{36}$/) });
    await expect(service.inspectProviderInvitation(invitationToken)).rejects.toMatchObject({ response: { code: 'INVALID_OR_EXPIRED_INVITATION' } });
    await expect(service.inviteProvider(admin, input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('assigns distinct namespaces to providers with the same organization and preserves tenant ownership', async () => {
    const admin = { sub: '00000000-0000-4000-8000-000000000001', role: 'SYSTEM_ADMIN' as const, sessionVersion: 1 };
    const emails = ['same-organization-a@example.test', 'same-organization-b@example.test'];
    for (const email of emails) {
      await service.inviteProvider(admin, { email });
      await service.acceptProviderInvitation(invitationToken, password, profile);
    }
    const identities = await pool.query('SELECT id, provider_chain_namespace, provider_chain_address FROM users WHERE email = ANY($1::citext[])', [emails]);
    expect(new Set(identities.rows.map((row) => row.id)).size).toBe(2);
    expect(new Set(identities.rows.map((row) => row.provider_chain_namespace)).size).toBe(2);
    expect(identities.rows.every((row) => row.provider_chain_address === null)).toBe(true);
  });

  it('upgrades the legacy invitation layout without rewriting legacy tokens or provider chain identity', async () => {
    const client = await pool.connect();
    await client.query('BEGIN');
    try {
      // Disposable Testcontainers database only; rollback restores existing test rows.
      await client.query('TRUNCATE provider_invitations');
      // Reconstitute the old constraints on an otherwise identical empty invitation table.
      await client.query('ALTER TABLE provider_invitations ALTER COLUMN display_name SET NOT NULL, ALTER COLUMN organization_name SET NOT NULL, ALTER COLUMN provider_chain_address SET NOT NULL, ALTER COLUMN provider_chain_namespace SET NOT NULL');
      await client.query(`INSERT INTO provider_invitations (email, display_name, organization_name, provider_chain_address, provider_chain_namespace, token_hash, invited_by_user_id, expires_at)
        VALUES ('legacy-layout@example.test', 'Old Owner', 'Old Organization', $1, 'legacy-layout', decode($2, 'hex'), '00000000-0000-4000-8000-000000000001', now() + interval '1 day')`, [`0x${'ef'.repeat(20)}`, '01'.repeat(32)]);
      const migration = await readFile(resolve(process.cwd(), 'database/migrations/20261021-provider-namespace-onboarding.sql'), 'utf8');
      await client.query(migration.replace(/^BEGIN;\s*/m, '').replace(/COMMIT;\s*$/m, ''));
      const legacy = await client.query("SELECT provider_chain_address, provider_chain_namespace, encode(token_hash, 'hex') AS digest FROM provider_invitations WHERE email = 'legacy-layout@example.test'");
      expect(legacy.rows[0]).toEqual({ provider_chain_address: `0x${'ef'.repeat(20)}`, provider_chain_namespace: 'legacy-layout', digest: '01'.repeat(32) });
      await client.query(`INSERT INTO provider_invitations (email, token_hash, invited_by_user_id, expires_at) VALUES ('email-only-layout@example.test', decode($1, 'hex'), '00000000-0000-4000-8000-000000000001', now() + interval '1 day')`, ['02'.repeat(32)]);
    } finally { await client.query('ROLLBACK'); client.release(); }
  });

  it('leaves expired invitations inactive and rolls back identity conflicts without consuming the invitation', async () => {
    const admin = { sub: '00000000-0000-4000-8000-000000000001', role: 'SYSTEM_ADMIN' as const, sessionVersion: 1 };
    const input = { email: 'expired.provider@example.test' };
    await service.inviteProvider(admin, input);
    await pool.query("UPDATE provider_invitations SET expires_at = now() - interval '1 second' WHERE email = $1", [input.email]);
    await expect(service.acceptProviderInvitation(invitationToken, password, profile)).rejects.toMatchObject({ response: { code: 'INVALID_OR_EXPIRED_INVITATION' } });
    expect(await repository.findByEmail(input.email)).toBeNull();
    await service.inviteProvider(admin, input);
    await pool.query("INSERT INTO users (email,password_hash,display_name,role,status) VALUES ($1,'hash','Conflict','SUPPORT_STAFF','ACTIVE')", [input.email]);
    await expect(service.acceptProviderInvitation(invitationToken, password, profile)).rejects.toBeInstanceOf(ConflictException);
    const pending = await pool.query('SELECT accepted_at FROM provider_invitations WHERE email = $1', [input.email]);
    expect(pending.rows[0].accepted_at).toBeNull();
  });

  it('keeps an undelivered invitation durable and allows an administrator to resend it', async () => {
    const admin = { sub: '00000000-0000-4000-8000-000000000001', role: 'SYSTEM_ADMIN' as const, sessionVersion: 1 };
    const input = { email: 'retry.provider@example.test' };
    const unavailable = new IdentityService(repository, redis, new TextEncoder().encode('test-secret'), {
      sendEmailVerification: async () => {}, sendPasswordReset: async () => {},
      sendProviderInvitation: async () => { throw new Error('Mail provider unavailable'); },
    });
    await expect(unavailable.inviteProvider(admin, input)).rejects.toMatchObject({ response: { code: 'INVITATION_EMAIL_FAILED' } });
    expect((await repository.listProviderInvitations()).find((item) => item.email === input.email)).toMatchObject({ status: 'PENDING', sentAt: null });
    expect(await repository.findByEmail(input.email)).toBeNull();
    await service.inviteProvider(admin, input);
    expect((await repository.listProviderInvitations()).find((item) => item.email === input.email)?.sentAt).not.toBeNull();
    await expect(service.acceptProviderInvitation(invitationToken, password, profile)).resolves.toMatchObject({ role: 'PROVIDER_ADMIN' });
  });

  it('accepts legacy invitations with recipient-owned names while retaining their immutable chain identity', async () => {
    const admin = { sub: '00000000-0000-4000-8000-000000000001', role: 'SYSTEM_ADMIN' as const, sessionVersion: 1 };
    const email = 'legacy-recipient@example.test';
    await service.inviteProvider(admin, { email });
    const address = `0x${'ef'.repeat(20)}`;
    await pool.query('UPDATE provider_invitations SET display_name = $2, organization_name = $3, provider_chain_address = $4, provider_chain_namespace = $5 WHERE email = $1', [email, 'Admin supplied name', 'Admin supplied company', address, 'legacy-recipient']);
    await service.acceptProviderInvitation(invitationToken, password, profile);
    const identity = await pool.query('SELECT display_name, organization_name, provider_chain_address, provider_chain_namespace FROM users WHERE email = $1', [email]);
    expect(identity.rows[0]).toEqual({ display_name: profile.displayName, organization_name: profile.organizationName, provider_chain_address: address, provider_chain_namespace: 'legacy-recipient' });
  });

  it('preserves at least one active system administrator', async () => {
    const adminId = '00000000-0000-4000-8000-000000000001';
    await expect(
      service.changeAccountState(
        adminId,
        'DISABLED',
        { role: 'SYSTEM_ADMIN', sessionVersion: 1, sub: adminId },
        'integration check',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
