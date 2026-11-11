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
const { values } = parseArgs({ options: { demo: { type: 'boolean', default: false }, 'allow-destructive': { type: 'boolean', default: false } } });
if (process.env.NODE_ENV === 'production') throw new Error('Database initialization is disabled in production; recreate a dedicated database in development mode.');
if (values.demo && process.env.NODE_ENV !== 'development') {
  throw new Error('Demo initialization requires development mode');
}
const schema = transactionBody(await readDatabaseSql({ demo: values.demo }), schemaPath);

await withDatabase(async (database) => {
  await database.query('BEGIN');
  try {
    await database.query("SELECT pg_advisory_xact_lock(hashtext('emukey-schema-maintenance'))");
    const existing = await database.query("SELECT 1 FROM pg_tables WHERE schemaname='public' LIMIT 1");
    if (existing.rows.length && !values['allow-destructive']) throw new Error('Database is not empty; explicitly pass --allow-destructive to recreate the public schema and discard its data.');
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
