import { readFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import pg from 'pg';

const environment = await readFile(fileURLToPath(new URL('../../../EmuKey/backend/.env', import.meta.url)), 'utf8');
const databaseUrl = environment.split(/\r?\n/).find((line) => line.startsWith('DATABASE_URL='))?.slice('DATABASE_URL='.length);
if (!databaseUrl) throw new Error('DATABASE_URL_MISSING');
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const result = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'orders' AND column_name IN ('service_terms_accepted_at', 'service_terms_version_snapshot', 'service_terms_hash_snapshot', 'service_terms_content_snapshot', 'terms_version_snapshot', 'terms_hash_snapshot', 'terms_accepted_at'))
        OR (table_name = 'plans' AND column_name IN ('terms_version', 'terms_hash')))
    ORDER BY table_name, column_name
  `);
  const columns = Object.fromEntries(result.rows.map((row) => [`${row.table_name}.${row.column_name}`, true]));
  const expectedPresent = ['orders.service_terms_accepted_at', 'orders.service_terms_version_snapshot', 'orders.service_terms_hash_snapshot', 'orders.service_terms_content_snapshot'];
  const expectedAbsent = ['plans.terms_version', 'plans.terms_hash', 'orders.terms_version_snapshot', 'orders.terms_hash_snapshot', 'orders.terms_accepted_at'];
  const failures = [
    ...expectedPresent.filter((name) => !columns[name]).map((name) => `${name}:missing`),
    ...expectedAbsent.filter((name) => columns[name]).map((name) => `${name}:unexpected`),
  ];
  const tableCount = await client.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'");
  const output = { status: failures.length === 0 && tableCount.rows[0].count === 18 ? 'REAL_VERIFIED' : 'FAIL', tableCount: tableCount.rows[0].count, present: expectedPresent.filter((name) => columns[name]), absent: expectedAbsent.filter((name) => !columns[name]), failures };
  console.log(JSON.stringify(output, null, 2));
  if (output.status !== 'REAL_VERIFIED') process.exitCode = 1;
} finally {
  await client.end();
}
