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
    const input = { email: 'invited.provider@example.test', displayName: 'Invited Provider', organizationName: 'Invited Ltd', providerChainAddress: `0x${'ab'.repeat(20)}`, providerChainNamespace: 'invited-provider' };
    await service.inviteProvider(admin, input);
    const oldToken = invitationToken;
    expect(await repository.findByEmail(input.email)).toBeNull();
    await expect(service.register({ email: input.email, displayName: 'Impersonator', customerType: 'INDIVIDUAL', password })).rejects.toBeInstanceOf(ConflictException);
    await service.inviteProvider(admin, input);
    await expect(service.acceptProviderInvitation(oldToken, password)).rejects.toMatchObject({ response: { code: 'INVALID_OR_EXPIRED_INVITATION' } });
    const outcomes = await Promise.allSettled([service.acceptProviderInvitation(invitationToken, password), service.acceptProviderInvitation(invitationToken, password)]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const login = await service.login(input.email, password);
    expect(login.user).toMatchObject({ role: 'PROVIDER_ADMIN', status: 'ACTIVE' });
    await expect(service.inviteProvider(admin, input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('leaves expired invitations inactive and rolls back identity conflicts without consuming the invitation', async () => {
    const admin = { sub: '00000000-0000-4000-8000-000000000001', role: 'SYSTEM_ADMIN' as const, sessionVersion: 1 };
    const input = { email: 'expired.provider@example.test', displayName: 'Expired Provider', organizationName: 'Expired Ltd', providerChainAddress: `0x${'cd'.repeat(20)}`, providerChainNamespace: 'expired-provider' };
    await service.inviteProvider(admin, input);
    await pool.query("UPDATE provider_invitations SET expires_at = now() - interval '1 second' WHERE email = $1", [input.email]);
    await expect(service.acceptProviderInvitation(invitationToken, password)).rejects.toMatchObject({ response: { code: 'INVALID_OR_EXPIRED_INVITATION' } });
    expect(await repository.findByEmail(input.email)).toBeNull();
    await service.inviteProvider(admin, input);
    await pool.query("INSERT INTO users (email,password_hash,display_name,role,status) VALUES ($1,'hash','Conflict','SUPPORT_STAFF','ACTIVE')", [input.email]);
    await expect(service.acceptProviderInvitation(invitationToken, password)).rejects.toBeInstanceOf(ConflictException);
    const pending = await pool.query('SELECT accepted_at FROM provider_invitations WHERE email = $1', [input.email]);
    expect(pending.rows[0].accepted_at).toBeNull();
  });

  it('keeps an undelivered invitation durable and allows an administrator to resend it', async () => {
    const admin = { sub: '00000000-0000-4000-8000-000000000001', role: 'SYSTEM_ADMIN' as const, sessionVersion: 1 };
    const input = { email: 'retry.provider@example.test', displayName: 'Retry Provider', organizationName: 'Retry Ltd', providerChainAddress: `0x${'12'.repeat(20)}`, providerChainNamespace: 'retry-provider' };
    const unavailable = new IdentityService(repository, redis, new TextEncoder().encode('test-secret'), {
      sendEmailVerification: async () => {}, sendPasswordReset: async () => {},
      sendProviderInvitation: async () => { throw new Error('Mail provider unavailable'); },
    });
    await expect(unavailable.inviteProvider(admin, input)).rejects.toMatchObject({ response: { code: 'INVITATION_EMAIL_FAILED' } });
    expect((await repository.listProviderInvitations()).find((item) => item.email === input.email)).toMatchObject({ status: 'PENDING', sentAt: null });
    expect(await repository.findByEmail(input.email)).toBeNull();
    await service.inviteProvider(admin, input);
    expect((await repository.listProviderInvitations()).find((item) => item.email === input.email)?.sentAt).not.toBeNull();
    await expect(service.acceptProviderInvitation(invitationToken, password)).resolves.toMatchObject({ role: 'PROVIDER_ADMIN' });
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
