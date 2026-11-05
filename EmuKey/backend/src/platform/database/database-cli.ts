import pino from 'pino';
import { Client } from 'pg';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const databaseCliLogger = pino({ name: 'emukey-database' });

export function upgradeSection(sql: string, from: string, to: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(from) || !/^[a-zA-Z0-9_-]+$/.test(to)) throw new Error('Invalid schema version');
  if (from === '9ed5729' && to === 'provider_handoff_20261104') {
    return [upgradeSection(sql, from, 'cf17043'), upgradeSection(sql, 'cf17043', 'continuity_20261101'),
      upgradeSection(sql, 'continuity_20261101', to)].join('\n');
  }
  const marker = `/* emukey:upgrade:${from}:${to}:begin`;
  const sections = sql.split(marker);
  if (sections.length !== 2) throw new Error('Unknown or ambiguous schema upgrade');
  const end = sections[1]!.indexOf('emukey:upgrade:end */');
  if (end < 0) throw new Error('Unterminated schema upgrade');
  const delta = sections[1]!.slice(0, end).trim().replaceAll('\r\n', '\n');
  if (!delta || /\/\*|\*\/|\b(?:BEGIN|COMMIT|ROLLBACK)\s*;|\bDROP\s+(?:SCHEMA|DATABASE)\b/i.test(delta)) {
    throw new Error('Unsafe schema upgrade section');
  }
  return delta;
}

/** Structural fingerprint excludes data, object OIDs, owners and extension internals. */
export async function schemaDefinitions(database: Client): Promise<string[]> {
  const result = await database.query<{ definition: string }>(`
    SELECT 'column:' || table_name || '.' || column_name || ':' || udt_name || ':' ||
      is_nullable || ':' || coalesce(column_default,'') || ':' || coalesce(generation_expression,'') AS definition
      FROM information_schema.columns WHERE table_schema='public'
    UNION ALL SELECT 'constraint:' || c.conrelid::regclass::text || ':' || c.conname || ':' || pg_get_constraintdef(c.oid,true)
      FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'
    UNION ALL SELECT 'index:' || indexname || ':' || indexdef FROM pg_indexes WHERE schemaname='public'
    UNION ALL SELECT 'trigger:' || t.tgrelid::regclass::text || ':' || pg_get_triggerdef(t.oid,true)
      FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid JOIN pg_namespace n ON n.oid=r.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal
    UNION ALL SELECT 'function:' || p.proname || ':' || pg_get_function_identity_arguments(p.oid) || ':' || pg_get_functiondef(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`);
  return result.rows.map((row) => row.definition.replaceAll('\r\n', '\n')).sort();
}

export async function schemaFingerprint(database: Client): Promise<string> {
  return createHash('sha256').update((await schemaDefinitions(database)).join('\n')).digest('hex');
}

/** Compare literal varchar[] -> text[] catalog casts. Raw fingerprints stay strict. */
export function canonicalCatalogSql(definition: string): string {
  const literal = "'(?:''|[^'])*'::character varying";
  const items = `${literal}(?:,\\s*${literal})*`;
  const arrayCast = new RegExp(`\\(ARRAY\\[(${items})\\]\\)::text\\[\\]|ARRAY\\[(${items})\\]::text\\[\\]`, 'g');
  const textArrays = definition.replace(arrayCast, (_match: string, wrapped: string | undefined, bare: string | undefined) =>
    `ARRAY[${(wrapped ?? bare!).replace(/('(?:''|[^'])*')::character varying/g, '$1::text')}]`);
  const element = `(?:\\(${literal}\\)|${literal})::text`;
  const restored = new RegExp(`ARRAY\\[(${element}(?:,\\s*${element})*)\\]`, 'g');
  return textArrays.replace(restored, (_match: string, values: string) =>
    `ARRAY[${values.replace(/\(('(?:''|[^'])*')::character varying\)::text/g, '$1::text')
      .replace(/('(?:''|[^'])*')::character varying::text/g, '$1::text')}]`);
}

export async function applyUpgrade(database: Client, sql: string, from: string, to: string): Promise<'APPLIED' | 'CURRENT'> {
  if (from === '9ed5729' && to !== 'provider_handoff_20261104') throw new Error('Use the complete legacy-to-handoff upgrade');
  const delta = upgradeSection(sql, from, to);
  const checksum = createHash('sha256').update(delta).digest('hex');
  await database.query('BEGIN');
  try {
    await database.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='5min'");
    await database.query("SELECT pg_advisory_xact_lock(hashtext('emukey-schema-maintenance'))");
    const versionTable = await database.query<{ name: string | null }>("SELECT to_regclass('public.schema_versions') AS name");
    if (versionTable.rows[0]?.name) {
      const versions = await database.query<{ version: string; checksum: string; schema_fingerprint: string }>('SELECT version, checksum, schema_fingerprint FROM schema_versions ORDER BY applied_at DESC');
      if (versions.rows[0]?.version === to && versions.rows[0]?.checksum === checksum) {
        if (await schemaFingerprint(database) !== versions.rows[0].schema_fingerprint) throw new Error('Current schema fingerprint has drifted');
        await database.query('COMMIT');
        return 'CURRENT';
      }
      if (versions.rows[0]?.version === from) {
        if (await schemaFingerprint(database) !== versions.rows[0].schema_fingerprint) throw new Error('Source schema fingerprint has drifted');
        await database.query(delta);
        await database.query('INSERT INTO schema_versions(version,checksum,schema_fingerprint) VALUES ($1,$2,$3)', [to,checksum,await schemaFingerprint(database)]);
        await database.query('COMMIT');
        return 'APPLIED';
      }
      if (versions.rows.length) throw new Error('Unsupported schema version or changed upgrade checksum');
    }
    const approved = [...sql.matchAll(new RegExp(`^-- emukey:legacy-fingerprint:${from}:([a-f0-9]{64})$`, 'gm'))].map(match=>match[1]);
    if (!approved.includes(await schemaFingerprint(database))) throw new Error('Legacy schema fingerprint is not approved');
    await database.query(delta);
    await database.query('INSERT INTO schema_versions(version,checksum,schema_fingerprint) VALUES ($1,$2,$3)', [to,checksum,await schemaFingerprint(database)]);
    await database.query('COMMIT');
    return 'APPLIED';
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
}

export function transactionBody(sql: string, source: string): string {
  const begin = sql.indexOf('BEGIN;');
  const commit = sql.lastIndexOf('COMMIT;');
  if (begin < 0 || commit < begin || sql.slice(commit + 7).trim() !== '') {
    throw new Error(`${source} must contain one outer BEGIN/COMMIT transaction`);
  }
  return sql.slice(begin + 6, commit);
}

export async function readDatabaseSql(options: { demo?: boolean; seedOnly?: boolean } = {}): Promise<string> {
  if (options.seedOnly && !options.demo) throw new Error('Seed-only execution requires demo data');
  const sql = await readFile(resolve(process.cwd(), 'database', 'schema.sql'), 'utf8');
  let body = transactionBody(sql, 'schema.sql');
  if (options.seedOnly) {
    const sections = body.split('-- emukey:seed:begin');
    const seed = sections[1]?.split('-- emukey:seed:end');
    if (sections.length !== 2 || seed?.length !== 2) throw new Error('Missing or ambiguous SQL seed section');
    // Seed-only must never execute the destructive schema initializer.
    body = `SET LOCAL search_path = public;\n${seed[0]}`;
  }
  // Explicit LOCAL selection prevents inherited session settings from enabling demo data.
  return `BEGIN;\nSET LOCAL emukey.seed_demo = '${options.demo ? 'true' : 'false'}';\n${body}\nCOMMIT;\n`;
}

export function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export async function withDatabase(
  operation: (database: Client) => Promise<void>,
): Promise<void> {
  const database = new Client({
    application_name: 'emukey-database-cli',
    connectionString: requiredEnvironment('DATABASE_URL'),
  });
  await database.connect();
  try {
    await operation(database);
  } finally {
    await database.end();
  }
}
