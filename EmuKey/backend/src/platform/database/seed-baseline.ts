import { hash } from 'argon2';
import type { Client } from 'pg';

import { planCommitment } from '../crypto/license-crypto.js';

type DatabaseClient = Pick<Client, 'query'>;

interface SeedUser {
  displayName: string;
  email: string;
  id: string;
  organizationName?: string;
  providerChainAddress?: string;
  providerChainNamespace?: string;
  customerType?: 'INDIVIDUAL';
  emailVerifiedAt?: string;
  role: 'CUSTOMER' | 'SYSTEM_ADMIN' | 'PROVIDER_ADMIN' | 'SUPPORT_STAFF';
  status: 'ACTIVE';
}

const USERS: readonly SeedUser[] = [
  {
    displayName: 'Emukey System Admin',
    email: 'system.admin@example.test',
    id: '00000000-0000-4000-8000-000000000001',
    role: 'SYSTEM_ADMIN',
    status: 'ACTIVE',
  },
  {
    displayName: 'Emukey Provider Admin',
    email: 'provider.admin@example.test',
    id: '00000000-0000-4000-8000-000000000002',
    organizationName: 'Emukey Demo Provider',
    providerChainAddress: '0x0000000000000000000000000000000000000002',
    providerChainNamespace: 'emukey-demo-provider',
    role: 'PROVIDER_ADMIN',
    status: 'ACTIVE',
  },
  {
    displayName: 'Emukey Support Staff',
    email: 'support.staff@example.test',
    id: '00000000-0000-4000-8000-000000000003',
    role: 'SUPPORT_STAFF',
    status: 'ACTIVE',
  },
  {
    customerType: 'INDIVIDUAL',
    displayName: 'Emukey Demo Customer',
    email: 'customer@example.test',
    emailVerifiedAt: '2026-09-08T00:00:00Z',
    id: '00000000-0000-4000-8000-000000000004',
    role: 'CUSTOMER',
    status: 'ACTIVE',
  },
];

async function seedUsers(database: DatabaseClient, passwordHash: string): Promise<void> {
  for (const user of USERS) {
    await database.query(
      `INSERT INTO users (
        id, email, password_hash, display_name, role, status,
        organization_name, provider_chain_address, provider_chain_namespace,
        customer_type, email_verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (email) DO NOTHING`,
      [
        user.id,
        user.email,
        passwordHash,
        user.displayName,
        user.role,
        user.status,
        user.organizationName ?? null,
        user.providerChainAddress ?? null,
        user.providerChainNamespace ?? null,
        user.customerType ?? null,
        user.emailVerifiedAt ?? null,
      ],
    );
  }
}

async function seedCatalog(database: DatabaseClient): Promise<void> {
  const productId = '00000000-0000-4000-8000-000000000200';
  const providerChainAddress = '0x0000000000000000000000000000000000000002';
  const monthlyCommitment = planCommitment({
    durationMonths: 1,
    entitlements: { desktop: true },
    maxActiveDevices: 2,
    planId: '00000000-0000-4000-8000-000000000301',
    planVersion: 1,
    productId,
    providerChainAddress,
  });
  const yearlyCommitment = planCommitment({
    durationMonths: 12,
    entitlements: { desktop: true },
    maxActiveDevices: 3,
    planId: '00000000-0000-4000-8000-000000000302',
    planVersion: 1,
    productId,
    providerChainAddress,
  });
  await database.query(
    `INSERT INTO products (
      id, provider_user_id, code, name, description, image_url, status, published_at
    ) VALUES (
      '00000000-0000-4000-8000-000000000200',
      '00000000-0000-4000-8000-000000000002',
      'EMUKEY_DESKTOP', 'Emukey Desktop',
      'Deterministic local catalog data for development.',
      'https://picsum.photos/seed/emukey-desktop/1200/800',
      'PUBLISHED', '2026-09-08T00:00:00Z'
    ) ON CONFLICT (provider_user_id, code) DO NOTHING`,
  );
  await database.query(
    `INSERT INTO plans (
      id, product_id, provider_user_id, code, version, name, billing_cycle,
       duration_months, price_vnd, max_active_devices, entitlements,
       plan_commitment, status, published_at
    ) VALUES
      (
        '00000000-0000-4000-8000-000000000301',
        '00000000-0000-4000-8000-000000000200',
        '00000000-0000-4000-8000-000000000002',
        'MONTHLY', 1, 'Monthly plan', 'MONTHLY', 1, 120000, 2,
         '{"desktop": true}'::jsonb, decode($1, 'hex'), 'PUBLISHED', '2026-09-08T00:00:00Z'
      ),
      (
        '00000000-0000-4000-8000-000000000302',
        '00000000-0000-4000-8000-000000000200',
        '00000000-0000-4000-8000-000000000002',
        'YEARLY', 1, 'Yearly plan', 'YEARLY', 12, 1200000, 3,
       '{"desktop": true}'::jsonb, decode($2, 'hex'), 'PUBLISHED', '2026-09-08T00:00:00Z'
      )
    ON CONFLICT (product_id, code, version) DO NOTHING`,
    [
       monthlyCommitment.slice(2),
       yearlyCommitment.slice(2),
    ],
  );
}

export async function seedBaseline(
  database: DatabaseClient,
  seedPassword: string,
): Promise<void> {
  if (seedPassword.length < 12) {
    throw new Error('Seed password must contain at least 12 characters');
  }

  const passwordHash = await hash(seedPassword, {
    memoryCost: 19_456,
    parallelism: 1,
    timeCost: 2,
  });

  await database.query('BEGIN');
  try {
    await seedUsers(database, passwordHash);
    await seedCatalog(database);
    await database.query('COMMIT');
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
}
