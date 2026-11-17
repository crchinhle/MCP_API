import { parseArgs } from 'node:util';
import { databaseCliLogger, withDatabase } from '../../platform/database/database-cli.js';
import { verifyBaselineDatabase } from '../../platform/database/verify-baseline-database.js';

const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false } } });

// One explicit, non-destructive transition. This is not an automatic schema diff
// engine: every future transition needs its own preconditions and data tests.
await withDatabase(async (database) => {
  await database.query('BEGIN');
  try {
    await database.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
    await database.query("SELECT pg_advisory_xact_lock(hashtext('emukey-schema-maintenance'))");
    const before = await verifyBaselineDatabase(database);
    if (before.matchesBaseline) {
      await database.query('ROLLBACK');
      databaseCliLogger.info({ event: 'database.migration', status: 'ALREADY_CURRENT' });
      return;
    }
    const otherDrift = Object.entries(before).some(([name, value]) =>
      name !== 'extraTables' && Array.isArray(value) && value.length > 0);
    if (otherDrift || before.extraTables.length !== 1 || before.extraTables[0] !== 'schema_versions') {
      throw new Error('MIGRATION_UNKNOWN_SCHEMA_DRIFT: only legacy schema_versions metadata can be archived');
    }
    const target = await database.query<{ name: string | null }>("SELECT to_regclass('emukey_maintenance.schema_versions') AS name");
    if (target.rows[0]?.name) throw new Error('MIGRATION_ARCHIVE_TARGET_EXISTS');
    await database.query('LOCK TABLE public.schema_versions IN ACCESS EXCLUSIVE MODE');
    const source = await database.query<{ oid: string; rows: string }>("SELECT 'public.schema_versions'::regclass::oid::text AS oid, count(*)::text AS rows FROM public.schema_versions");
    await database.query('CREATE SCHEMA IF NOT EXISTS emukey_maintenance');
    await database.query('ALTER TABLE public.schema_versions SET SCHEMA emukey_maintenance');
    const archived = await database.query<{ oid: string; rows: string }>("SELECT 'emukey_maintenance.schema_versions'::regclass::oid::text AS oid, count(*)::text AS rows FROM emukey_maintenance.schema_versions");
    if (source.rows[0]?.oid !== archived.rows[0]?.oid || source.rows[0]?.rows !== archived.rows[0]?.rows) {
      throw new Error('MIGRATION_ARCHIVE_IDENTITY_MISMATCH');
    }
    const after = await verifyBaselineDatabase(database);
    if (!after.matchesBaseline) throw new Error('MIGRATION_TARGET_BASELINE_MISMATCH');
    await database.query(values.apply ? 'COMMIT' : 'ROLLBACK');
    databaseCliLogger.info({ event: 'database.migration', migration: 'archive-legacy-schema-versions',
      status: values.apply ? 'LEGACY_METADATA_ARCHIVED' : 'REHEARSAL_ROLLED_BACK',
      archivedRows: archived.rows[0]?.rows, businessTables: after.tables });
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
});
