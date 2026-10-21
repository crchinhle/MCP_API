import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Client } from 'pg';

import { verifyBaselineDatabase } from '../../../../../EmuKey/backend/src/platform/database/verify-baseline-database.js';

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

  it('initializes the account-linked schema including durable provider invitations', async () => {
     const report = await verifyBaselineDatabase(database);
     expect(report).toMatchObject({
      extraTables: [],
      matchesBaseline: true,
      missingExtensions: [],
      missingTables: [],
      tables: 18,
    });
  });

  it('has no user audit table', async () => {
    expect((await database.query("SELECT to_regclass('public.audit_logs') AS name")).rows).toEqual([{ name: null }]);
  });

  it('removes legacy audit twice while preserving business rows and constraints', async () => {
    const migration = await readFile(resolve(process.cwd(), 'database/migrations/20261020-remove-user-audit.sql'), 'utf8');
    const history = async () => {
      const rows = [];
      for (const table of ['users', 'orders', 'payment_transactions', 'licenses', 'chain_commands', 'chain_events']) {
        rows.push((await database.query(`SELECT jsonb_agg(to_jsonb(t) ORDER BY id) AS data FROM ${table} t`)).rows);
      }
      return rows;
    };
    // Seed real business rows before proving that the audit migration preserves them.
    await promisify(execFile)(process.execPath, [resolve(process.cwd(), '../../tooling/emukey/fixtures/seed-demo-data.mjs'), '--yes', '--skip-image-check'], {
      env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: container.getConnectionUri() },
    });
    const before = await history();
    await database.query(`CREATE TABLE audit_logs (id integer PRIMARY KEY, action text);
      INSERT INTO audit_logs VALUES (1, 'LEGACY_ACTION');
      CREATE FUNCTION reject_audit_logs_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END; $$;
      CREATE TRIGGER audit_logs_no_update_or_delete BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION reject_audit_logs_mutation();
      CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
        FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_logs_mutation();`);
    await database.query(migration);
    await database.query(migration);
    expect(await history()).toEqual(before);
    expect((await database.query("SELECT to_regclass('public.audit_logs') AS name, to_regprocedure('public.reject_audit_logs_mutation()') AS function")).rows)
      .toEqual([{ name: null, function: null }]);
    expect(await verifyBaselineDatabase(database)).toMatchObject({ matchesBaseline: true, tables: 18 });
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

  it('migrates legacy columns without losing account, guide, message, or audit content and can run twice', async () => {
    const migration = await readFile(resolve(process.cwd(), 'database/migrations/20261020-remove-unused-columns.sql'), 'utf8');
    await database.query('CREATE SCHEMA column_removal_test');
    try {
      await database.query(`CREATE EXTENSION IF NOT EXISTS vector;
        SET search_path TO column_removal_test, public;
        CREATE TABLE users (id integer PRIMARY KEY, display_name text, phone text, representative_name text, tax_code text);
        CREATE TABLE knowledge_chunks (
          id integer PRIMARY KEY, content text, embedding vector, embedding_model text, embedding_dimension integer,
          source_metadata jsonb,
          CONSTRAINT ck_knowledge_chunks_embedding CHECK (embedding IS NULL OR vector_dims(embedding) = embedding_dimension),
          CONSTRAINT ck_knowledge_chunks_source_metadata CHECK (jsonb_typeof(source_metadata) = 'object')
        );
        CREATE TABLE messages (id integer PRIMARY KEY, content text, model_name text);
        CREATE TABLE audit_logs (id integer PRIMARY KEY, action text, actor_email_snapshot text);
        INSERT INTO users VALUES (1, 'Customer', '0123456789', 'Representative', 'TAX');
        INSERT INTO knowledge_chunks VALUES (1, 'Activation instructions', '[1,2,3]', 'legacy', 3, '{"page":1}');
        INSERT INTO messages VALUES (1, 'Activate your license first.', 'legacy');
        INSERT INTO audit_logs VALUES (1, 'PROFILE_UPDATED', 'customer@example.test');`);
      await database.query(migration);
      await database.query(migration);
      expect((await database.query('SELECT * FROM users')).rows).toEqual([{ id: 1, display_name: 'Customer', phone: '0123456789' }]);
      expect((await database.query('SELECT * FROM knowledge_chunks')).rows).toEqual([{ id: 1, content: 'Activation instructions' }]);
      expect((await database.query('SELECT * FROM messages')).rows).toEqual([{ id: 1, content: 'Activate your license first.' }]);
      expect((await database.query('SELECT * FROM audit_logs')).rows).toEqual([{ id: 1, action: 'PROFILE_UPDATED' }]);
    } finally {
      await database.query('ROLLBACK');
      await database.query('SET search_path TO public');
      await database.query('DROP SCHEMA column_removal_test CASCADE');
      await database.query('DROP EXTENSION IF EXISTS vector');
    }
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
