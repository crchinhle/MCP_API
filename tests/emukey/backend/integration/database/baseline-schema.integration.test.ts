import { readDatabaseSql, transactionBody } from '../../../../../EmuKey/backend/src/platform/database/database-cli.js';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';
import { verify } from 'argon2';

import { verifyBaselineDatabase } from '../../../../../EmuKey/backend/src/platform/database/verify-baseline-database.js';

describe('account-linked Customer PostgreSQL baseline', () => {
  let container: StartedPostgreSqlContainer;
  let database: Client;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg15')
      .withDatabase('EmuKey')
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

  it('initializes the account-linked schema including durable provider invitations', async () => {
     const report = await verifyBaselineDatabase(database);
     expect(report).toMatchObject({
      extraTables: [],
      matchesBaseline: true,
      missingExtensions: [],
      missingTables: [],
      tables: 19,
    });
  });

  it('ships one SQL source for the final schema and demo seed', async () => {
    const files = await readdir(resolve(process.cwd(), 'database'), { recursive: true });
    expect(files.filter((name) => name.endsWith('.sql'))).toEqual(['schema.sql']);
  });

  it('omits obsolete profile, lease, token estimate and message receipt fields', async () => {
    const result = await database.query(`SELECT table_name || '.' || column_name AS field
      FROM information_schema.columns WHERE table_schema = 'public' AND
      (table_name, column_name) IN (('provider_invitations','display_name'),
      ('provider_invitations','organization_name'), ('chain_commands','lease_owner'),
      ('chain_commands','lease_expires_at'), ('knowledge_chunks','token_count'), ('messages','read_at'),
      ('plans','provider_user_id'), ('plans','provider_role'), ('plans','billing_cycle'),
      ('orders','billing_cycle_snapshot'), ('knowledge_documents','provider_user_id'))`);
    expect(result.rows).toEqual([]);
  });

  it('rejects dangling typed conversation context at the database boundary', async () => {
    await database.query('BEGIN');
    try {
      const user = await database.query(`INSERT INTO users(email,password_hash,display_name,role,status,customer_type,email_verified_at)
        VALUES ('context-fk@example.test','hash','Context','CUSTOMER','ACTIVE','INDIVIDUAL',now()) RETURNING id`);
      await expect(database.query(`INSERT INTO conversations(customer_user_id, product_id)
        VALUES ($1, 'ffffffff-ffff-4fff-8fff-ffffffffffff')`, [user.rows[0].id])).rejects.toMatchObject({ code: '23503' });
    } finally { await database.query('ROLLBACK'); }
  });

  it('seeds the full demo directly from the SQL source only in explicit development mode and can run twice', async () => {
    const seed = await readDatabaseSql({ demo: true, seedOnly: true });
    await expect(database.query(seed)).rejects.toThrow('development');
    await database.query('ROLLBACK');
    expect((await database.query('SELECT count(*)::int AS total FROM users')).rows[0].total).toBe(0);
    for (let run = 0; run < 2; run += 1) {
      await database.query('BEGIN');
      try {
        await database.query("SET LOCAL emukey.seed_environment='development'");
        // A caller's malformed hash must not overwrite the known demo login hash.
        await database.query("SET LOCAL emukey.seed_password_hash='$argon2id$garbage'");
        await database.query(transactionBody(seed, 'schema.sql'));
        await database.query('COMMIT');
      } catch (error) { await database.query('ROLLBACK'); throw error; }
    }
    const counts = (await database.query(`SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM products) AS products,
      (SELECT count(*)::int FROM plans) AS plans,
      (SELECT count(*)::int FROM licenses) AS licenses,
      (SELECT count(*)::int FROM chain_events WHERE finality_status='CONFIRMED') AS confirmed_events`)).rows[0];
    expect(counts).toEqual({ users: 30, products: 50, plans: 30, licenses: 30, confirmed_events: 0 });
    const account = (await database.query("SELECT password_hash FROM users WHERE email='admin01@demo.emukey.local'")).rows[0];
    expect(await verify(account.password_hash, 'Emu@1234')).toBe(true);
    expect(await verifyBaselineDatabase(database)).toMatchObject({ matchesBaseline: true, tables: 19 });
  });

  it('recreates the final schema by default and removes old public objects without seeding', async () => {
    const sql = await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8');
    await database.query('BEGIN');
    try {
      await database.query('CREATE TABLE obsolete_table (id integer); INSERT INTO obsolete_table VALUES (1)');
      await database.query(transactionBody(sql, 'schema.sql'));
      expect((await database.query("SELECT to_regclass('public.obsolete_table') AS name")).rows[0].name).toBeNull();
      expect((await database.query('SELECT count(*)::int AS total FROM users')).rows[0].total).toBe(0);
      expect(await verifyBaselineDatabase(database)).toMatchObject({ matchesBaseline: true, tables: 19 });
      await database.query(transactionBody(sql, 'schema.sql'));
      expect(await verifyBaselineDatabase(database)).toMatchObject({ matchesBaseline: true, tables: 19 });
    } finally { await database.query('ROLLBACK'); }
  });

  it('resets and verifies inside one reversible transaction', async () => {
    await database.query('BEGIN');
    try {
      await database.query("INSERT INTO users (email,password_hash,display_name,role,status) VALUES ('reset-check@example.test','hash','Reset check','SYSTEM_ADMIN','ACTIVE')");
      await database.query('SAVEPOINT before_reset');
      await database.query(transactionBody(await readDatabaseSql(), 'schema.sql'));
      expect((await database.query('SELECT count(*)::int AS total FROM users')).rows[0].total).toBe(0);
      expect(await verifyBaselineDatabase(database)).toMatchObject({ matchesBaseline: true, tables: 19 });
      await database.query('ROLLBACK TO SAVEPOINT before_reset');
      expect((await database.query("SELECT count(*)::int AS total FROM users WHERE email='reset-check@example.test'")).rows[0].total).toBe(1);
    } finally { await database.query('ROLLBACK'); }
  });

  it('keeps independent objects in other schemas and disables inherited demo settings in the CLI', async () => {
    await database.query('BEGIN');
    try {
      await database.query('CREATE SCHEMA independent; CREATE TABLE independent.keep_me (id integer); INSERT INTO independent.keep_me VALUES (1)');
      await database.query("SET LOCAL emukey.seed_demo='true'");
      await database.query(transactionBody(await readDatabaseSql(), 'schema.sql'));
      expect((await database.query('SELECT id FROM independent.keep_me')).rows).toEqual([{ id: 1 }]);
      expect((await database.query('SELECT count(*)::int AS total FROM users')).rows[0].total).toBe(0);
    } finally { await database.query('ROLLBACK'); }
  });

  it('initializes and seeds atomically, restoring old data when demo seed fails', async () => {
    await database.query('CREATE DATABASE emukey_demo_initialize_test');
    const url = new URL(container.getConnectionUri());
    url.pathname = '/emukey_demo_initialize_test';
    const fresh = new Client({ connectionString: url.toString() });
    await fresh.connect();
    const combined = transactionBody(await readDatabaseSql({ demo: true }), 'schema.sql');
    try {
      await fresh.query('CREATE TABLE old_data (id integer PRIMARY KEY); INSERT INTO old_data VALUES (1)');
      await fresh.query('BEGIN');
      await expect(fresh.query(combined)).rejects.toThrow('development');
      await fresh.query('ROLLBACK');
      expect((await fresh.query('SELECT id FROM old_data')).rows).toEqual([{ id: 1 }]);
      await fresh.query('BEGIN');
      await fresh.query("SET LOCAL emukey.seed_environment='development'");
      await fresh.query(combined);
      await fresh.query('COMMIT');
      expect((await fresh.query("SELECT to_regclass('public.old_data') AS name")).rows[0].name).toBeNull();
      expect((await fresh.query('SELECT count(*)::int AS total FROM products')).rows[0].total).toBe(50);
      expect(await verifyBaselineDatabase(fresh)).toMatchObject({ matchesBaseline: true, tables: 19 });
    } finally { await fresh.query('ROLLBACK'); await fresh.end(); }
  });

  it('has no user audit table', async () => {
    expect((await database.query("SELECT to_regclass('public.audit_logs') AS name")).rows).toEqual([{ name: null }]);
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

  it('seeds guides and accounts twice against the reduced schema without duplicating rows', async () => {
    const seedPath = resolve(process.cwd(), '../../tooling/emukey/fixtures/seed-demo-data.mjs');
    const runSeed = async () => {
      const { stdout } = await promisify(execFile)(process.execPath, [seedPath, '--yes', '--skip-image-check'], {
        env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: container.getConnectionUri() },
      });
      return (JSON.parse(stdout) as { seededRows: Record<string, number> }).seededRows;
    };
    const first = await runSeed();
    expect(first).toMatchObject({ users: 30, knowledge_documents: 30, knowledge_chunks: 30, messages: 30 });
    const extraMessage = (await database.query(`
      INSERT INTO messages (conversation_id, sender_user_id, sender_type, client_message_id, server_sequence, content)
      SELECT conversation_id, sender_user_id, sender_type, gen_random_uuid(), 2, 'User-added message survives reseeding'
      FROM messages ORDER BY id LIMIT 1 RETURNING id
    `)).rows[0] as { id: string };
    expect(await runSeed()).toEqual(first);
    expect((await database.query('SELECT content FROM messages WHERE id = $1', [extraMessage.id])).rows)
      .toEqual([{ content: 'User-added message survives reseeding' }]);
  });

  it('initializes without unused profile, AI metadata, or vector storage', async () => {
    const removed = await database.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND (
         (table_name = 'users' AND column_name IN ('representative_name', 'tax_code')) OR
         (table_name = 'knowledge_chunks' AND column_name IN ('embedding', 'embedding_model', 'embedding_dimension', 'source_metadata')) OR
         (table_name = 'messages' AND column_name = 'model_name') OR
         (table_name = 'audit_logs' AND column_name = 'actor_email_snapshot')
       )`,
    );
    expect(removed.rows).toEqual([]);
    expect((await database.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'")).rows).toEqual([]);
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

});
