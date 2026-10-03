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

import { IdentityRepository } from '../../../src/modules/identity-access/identity.repository.js';
import { IdentityService } from '../../../src/modules/identity-access/identity.service.js';
import { seedBaseline } from '../../../src/platform/database/seed-baseline.js';

describe('identity security flow', () => {
  let postgres: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let pool: Pool;
  let redis: Redis;
  let repository: IdentityRepository;
  let service: IdentityService;
  let verificationToken = '';
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
