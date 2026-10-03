import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { QueryResultRow } from 'pg';

import {
  databaseCliLogger,
  withDatabase,
} from '../../platform/database/database-cli.js';
import { verifyBaselineDatabase } from '../../platform/database/verify-baseline-database.js';

interface TableRow extends QueryResultRow {
  name: string;
}

const schemaPath = resolve(process.cwd(), 'database', 'schema.sql');

await withDatabase(async (database) => {
  const tableResult = await database.query<TableRow>(
    `SELECT tablename AS name
     FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename`,
  );
  if (tableResult.rowCount !== 0) {
    throw new Error(
      `Refusing to initialize a non-empty public schema: ${tableResult.rows
        .map(({ name }) => name)
        .join(', ')}`,
    );
  }

  const schema = await readFile(schemaPath, 'utf8');
  await database.query(schema);

  const report = await verifyBaselineDatabase(database);
  if (!report.matchesBaseline) {
    throw new Error(
      `Initialized database does not match baseline: ${JSON.stringify(report)}`,
    );
  }

  databaseCliLogger.info(
    { event: 'database.initialized', report, schemaPath },
    'Database schema initialized and verified',
  );
});
