import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';

import { AuditWriter } from '../../../src/platform/audit/audit-writer.js';
import { verifyBaselineDatabase } from '../../../src/platform/database/verify-baseline-database.js';

describe('account-linked Customer PostgreSQL baseline', () => {
  let container: StartedPostgreSqlContainer;
  let database: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg15')
      .withDatabase('emukey_schema_test')
      .withUsername('emukey')
      .withPassword('test-password')
      .start();
    database = new Client({ connectionString: container.getConnectionUri() });
    await database.connect();
    await database.query(await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8'));
  }, 120_000);

  afterAll(async () => {
    if (database) await database.end();
    if (container) await container.stop();
  });

  it('initializes the exact 18-table account-linked schema', async () => {
     const report = await verifyBaselineDatabase(database);
     expect(report).toMatchObject({
      extraTables: [],
      matchesBaseline: true,
      missingExtensions: [],
      missingTables: [],
      tables: 18,
    });
  });

  it('owns orders and licenses through customer accounts without controller keys', async () => {
    const result = await database.query<{ name: string }>(
      `SELECT table_name || '.' || column_name AS name
       FROM information_schema.columns
       WHERE table_schema='public'
         AND column_name='customer_user_id'
         AND table_name IN ('orders','licenses','conversations')
       ORDER BY name`,
    );
    expect(result.rows.map(({ name }) => name)).toEqual([
      'conversations.customer_user_id',
      'licenses.customer_user_id',
      'orders.customer_user_id',
    ]);
    const controllerTables = await database.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='customer_controllers'",
    );
    expect(controllerTables.rows).toEqual([]);
  });

  it('does not retain the removed order access-token column', async () => {
    const result = await database.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='access_token_hash'",
    );
    expect(result.rows).toEqual([]);
  });

  it('requires normalized EVM provider addresses and keeps them unique', async () => {
    await database.query('BEGIN');
    try {
      await database.query(
        `INSERT INTO users
          (id, email, password_hash, display_name, role, status,
           organization_name, provider_chain_address, provider_chain_namespace)
         VALUES
          ('00000000-0000-4000-8000-000000000091', 'provider.case-a@example.test',
           'hash', 'Provider Case A', 'PROVIDER_ADMIN', 'ACTIVE',
          'Provider Case A', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 'provider-case-a')`,
      );

      await database.query('SAVEPOINT invalid_provider_address');
      await expect(
        database.query(
          `INSERT INTO users
            (id, email, password_hash, display_name, role, status,
             organization_name, provider_chain_address, provider_chain_namespace)
           VALUES
            ('00000000-0000-4000-8000-000000000092', 'provider.case-b@example.test',
             'hash', 'Provider Case B', 'PROVIDER_ADMIN', 'ACTIVE',
             'Provider Case B', '0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD', 'provider-case-b')`,
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await database.query('ROLLBACK TO SAVEPOINT invalid_provider_address');

      await expect(
        database.query(
          `INSERT INTO users
            (id, email, password_hash, display_name, role, status,
             organization_name, provider_chain_address, provider_chain_namespace)
           VALUES
            ('00000000-0000-4000-8000-000000000093', 'provider.case-c@example.test',
             'hash', 'Provider Case C', 'PROVIDER_ADMIN', 'ACTIVE',
             'Provider Case C', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 'provider-case-c')`,
        ),
      ).rejects.toMatchObject({ code: '23505' });
    } finally {
      await database.query('ROLLBACK');
    }
  });

  it('rejects a schema that omits pending activation-key rotation state', async () => {
    await database.query('BEGIN');
    try {
      await database.query(
        'ALTER TABLE licenses DROP CONSTRAINT ck_licenses_pending_activation',
      );
      await database.query(
        'ALTER TABLE licenses DROP COLUMN pending_activation_commitment, DROP COLUMN pending_activation_key_version, DROP COLUMN pending_activation_command_id CASCADE',
      );

      const report = await verifyBaselineDatabase(database);

      expect(report.matchesBaseline).toBe(false);
      expect(report.missingCriticalColumns).toEqual(
        expect.arrayContaining([
          'licenses.pending_activation_commitment',
          'licenses.pending_activation_key_version',
          'licenses.pending_activation_command_id',
        ]),
      );
      expect(report.missingCriticalConstraints).toContain(
        'ck_licenses_pending_activation',
      );
    } finally {
      await database.query('ROLLBACK');
    }
  });

  it('rejects a schema that drops device-shape or command-admission guards', async () => {
    await database.query('BEGIN');
    try {
      await database.query(
        'ALTER TABLE license_devices DROP CONSTRAINT ck_license_devices_ref, DROP CONSTRAINT ck_license_devices_signer_address',
      );
      await database.query(
        'DROP INDEX uq_orders_one_open_renewal, uq_chain_commands_one_forward_mutation, uq_chain_commands_current_issue_order, uq_chain_commands_current_renewal_order',
      );

      const report = await verifyBaselineDatabase(database);

      expect(report.matchesBaseline).toBe(false);
      expect(report.missingCriticalConstraints).toEqual(
        expect.arrayContaining([
          'ck_license_devices_ref',
          'ck_license_devices_signer_address',
        ]),
      );
      expect(report.missingCriticalIndexes).toEqual(
        expect.arrayContaining([
          'uq_orders_one_open_renewal',
          'uq_chain_commands_one_forward_mutation',
          'uq_chain_commands_current_issue_order',
          'uq_chain_commands_current_renewal_order',
        ]),
      );
    } finally {
      await database.query('ROLLBACK');
    }
  });

  it('rolls audit evidence back with its business transaction', async () => {
    const audit = new AuditWriter();
    await database.query('BEGIN');
    await audit.write(database, {
      action: 'ROLLBACK_TEST',
      targetType: 'ORDER',
    });
    await database.query('ROLLBACK');
    const result = await database.query(
      "SELECT id FROM audit_logs WHERE action='ROLLBACK_TEST'",
    );
    expect(result.rows).toEqual([]);
  });
});
