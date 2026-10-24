import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  databaseCliLogger,
  readDatabaseSql,
  transactionBody,
  withDatabase,
} from '../../platform/database/database-cli.js';
import { verifyBaselineDatabase } from '../../platform/database/verify-baseline-database.js';

const schemaPath = resolve(process.cwd(), 'database', 'schema.sql');
const { values } = parseArgs({ options: { demo: { type: 'boolean', default: false } } });
if (values.demo && process.env.NODE_ENV !== 'development') {
  throw new Error('Demo initialization requires development mode');
}
const schema = transactionBody(await readDatabaseSql({ demo: values.demo }), schemaPath);

await withDatabase(async (database) => {
  await database.query('BEGIN');
  try {
    if (values.demo) await database.query("SET LOCAL emukey.seed_environment='development'");
    await database.query(schema);
    const report = await verifyBaselineDatabase(database);
    if (!report.matchesBaseline) {
      throw new Error(`Initialized database does not match baseline: ${JSON.stringify(report)}`);
    }
    await database.query('COMMIT');
    databaseCliLogger.info(
      { event: 'database.initialized', report, schemaPath, demo: values.demo },
      'Database public schema recreated and verified',
    );
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
});
