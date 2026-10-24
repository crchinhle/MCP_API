import pino from 'pino';
import { Client } from 'pg';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const databaseCliLogger = pino({ name: 'emukey-database' });

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
