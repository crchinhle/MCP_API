import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';

import { CatalogAdminService } from '../../../src/modules/catalog/application/catalog-admin.service.js';
import { CatalogAdminRepository } from '../../../src/modules/catalog/infrastructure/catalog-admin.repository.js';
import type { AuthPrincipal } from '../../../src/modules/identity-access/identity.types.js';
import { seedBaseline } from '../../../src/platform/database/seed-baseline.js';

describe('provider-scoped catalog lifecycle', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let service: CatalogAdminService;
  const providerA: AuthPrincipal = {
    role: 'PROVIDER_ADMIN',
    sessionVersion: 1,
    sub: '00000000-0000-4000-8000-000000000002',
  };
  const providerB: AuthPrincipal = {
    role: 'PROVIDER_ADMIN',
    sessionVersion: 1,
    sub: '00000000-0000-4000-8000-000000000012',
  };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg15')
      .withDatabase('emukey_catalog_test')
      .withUsername('emukey')
      .withPassword('test-password')
      .start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    await pool.query(
      await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8'),
    );
    await seedBaseline(pool, 'catalog-test-password');
    await pool.query(
      `INSERT INTO users
        (id, email, password_hash, display_name, role, status,
         organization_name, provider_chain_address, provider_chain_namespace)
       VALUES ($1, 'provider.b@example.test', 'hash', 'Provider B',
               'PROVIDER_ADMIN', 'ACTIVE', 'Provider B',
               '0x0000000000000000000000000000000000000012', 'provider-b')`,
      [providerB.sub],
    );
    service = new CatalogAdminService(new CatalogAdminRepository(pool));
  }, 120_000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (container) await container.stop();
  });

  it('binds ownership and denies every cross-provider read or mutation', async () => {
    const product = await service.createProduct(providerA, {
      code: 'SCOPED_PRODUCT',
      description: 'Owned by provider A',
      name: 'Scoped Product',
    });

    expect(await service.listProducts(providerA)).toContainEqual(product);
    expect(await service.listProducts(providerB)).not.toContainEqual(product);
    await expect(service.findProduct(providerB, product.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.updateProduct(providerB, product.id, { name: 'Stolen' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.publishProduct(providerB, product.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.deleteProduct(providerB, product.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    const plan = await service.createPlan(providerA, {
      billingCycle: 'MONTHLY',
      code: 'SCOPED',
      durationMonths: 1,
      maxActiveDevices: 1,
      name: 'Scoped Plan',
      priceVnd: 100_000,
      productId: product.id,
    });
    expect(await service.listPlans(providerB)).not.toContainEqual(plan);
    await expect(service.findPlan(providerB, plan.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.updatePlan(providerB, plan.id, { name: 'Stolen Plan' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.publishPlan(providerB, plan.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.deletePlan(providerB, plan.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.createPlan(providerB, {
        billingCycle: 'MONTHLY',
        code: 'CROSS_PROVIDER',
        durationMonths: 1,
        maxActiveDevices: 1,
        name: 'Cross Provider Plan',
        priceVnd: 100_000,
        productId: product.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const persisted = await pool.query<{ provider_user_id: string }>(
      'SELECT provider_user_id FROM products WHERE id = $1',
      [product.id],
    );
    expect(persisted.rows[0]?.provider_user_id).toBe(providerA.sub);
  });

  it('persists Terms/commitment, keeps published plans immutable and versions revisions', async () => {
    const product = await service.createProduct(providerA, {
      code: 'VERSIONED_PRODUCT',
      name: 'Versioned Product',
    });
    const input = {
      billingCycle: 'MONTHLY' as const,
      code: 'STANDARD',
      durationMonths: 1,
      entitlements: { desktop: true, feature_flags: ['offline'] },
      maxActiveDevices: 2,
      name: 'Standard',
      priceVnd: 120_000,
      productId: product.id,
    };
    const first = await service.createPlan(providerA, input);
    const updatedDraft = await service.updatePlan(providerA, first.id, {
      entitlements: { desktop: true, feature_flags: ['offline', 'export'] },
      maxActiveDevices: 3,
    });
    expect(updatedDraft.planCommitment).not.toBe(first.planCommitment);
    await service.publishProduct(providerA, product.id);
    const published = await service.publishPlan(providerA, first.id);

    expect(published).toMatchObject({ status: 'PUBLISHED', version: 1 });
    expect(published.planCommitment).toBe(updatedDraft.planCommitment);
    expect(published.planCommitment).toMatch(/^0x[0-9a-f]{64}$/);
    await expect(
      service.updatePlan(providerA, first.id, { priceVnd: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);

    const revision = await service.createPlan(providerA, {
      ...input,
      priceVnd: 130_000,
    });
    expect(revision.version).toBe(2);
    expect(revision.id).not.toBe(first.id);
    expect(revision.planCommitment).not.toBe(first.planCommitment);
  });

  it('allocates deterministic versions under concurrent creation', async () => {
    const product = await service.createProduct(providerA, {
      code: 'CONCURRENT_PRODUCT',
      name: 'Concurrent Product',
    });
    const input = {
      billingCycle: 'YEARLY' as const,
      code: 'YEARLY',
      durationMonths: 12,
      maxActiveDevices: 3,
      name: 'Yearly',
      priceVnd: 1_200_000,
      productId: product.id,
    };

    const versions = await Promise.all([
      service.createPlan(providerA, input),
      service.createPlan(providerA, input),
    ]);
    expect(versions.map(({ version }) => version).sort()).toEqual([1, 2]);
  });
});
