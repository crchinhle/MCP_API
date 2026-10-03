import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  databaseCliLogger,
  withDatabase,
} from '../../platform/database/database-cli.js';
import { verifyBaselineDatabase } from '../../platform/database/verify-baseline-database.js';

const dropSchemaPath = resolve(
  process.cwd(),
  'database',
  'maintenance',
  'drop-all-public-tables.sql',
);
const schemaPath = resolve(process.cwd(), 'database', 'schema.sql');

function transactionBody(sql: string, source: string): string {
  const begin = sql.indexOf('BEGIN;');
  const commit = sql.lastIndexOf('COMMIT;');

  if (begin < 0 || commit < begin || sql.slice(commit + 7).trim() !== '') {
    throw new Error(`${source} must contain one outer BEGIN/COMMIT transaction`);
  }

  return sql.slice(begin + 6, commit);
}

await withDatabase(async (database) => {
  const dropSchema = transactionBody(
    await readFile(dropSchemaPath, 'utf8'),
    dropSchemaPath,
  );
  const schema = transactionBody(await readFile(schemaPath, 'utf8'), schemaPath);

  await database.query('BEGIN');
  try {
    await database.query(dropSchema);
    await database.query(schema);

    const report = await verifyBaselineDatabase(database);
    if (!report.matchesBaseline) {
      throw new Error(
        `Reset database does not match baseline: ${JSON.stringify(report)}`,
      );
    }

    await database.query('COMMIT');
    databaseCliLogger.info(
      { event: 'database.reset', report, schemaPath },
      'Database schema reset and verified',
    );
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
});
