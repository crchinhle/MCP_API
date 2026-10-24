import {
  databaseCliLogger,
  requiredEnvironment,
  readDatabaseSql,
  transactionBody,
  withDatabase,
} from '../../platform/database/database-cli.js';
import { seedBaseline } from '../../platform/database/seed-baseline.js';
import { parseArgs } from 'node:util';
import { verifyBaselineDatabase } from '../../platform/database/verify-baseline-database.js';

const { values } = parseArgs({ options: { demo: { type: 'boolean', default: false } } });

if (requiredEnvironment('NODE_ENV') !== 'development') {
  throw new Error('Database seed is allowed only when NODE_ENV=development');
}

await withDatabase(async (database) => {
  if (values.demo) {
    await database.query('BEGIN');
    try {
      const report = await verifyBaselineDatabase(database);
      if (!report.matchesBaseline) throw new Error('Demo seed requires the current database schema');
      await database.query("SET LOCAL emukey.seed_environment='development'");
      await database.query(transactionBody(await readDatabaseSql({ demo: true, seedOnly: true }), 'schema.sql'));
      await database.query('COMMIT');
      databaseCliLogger.info({ event: 'database.demo_seeded' }, 'Demo seed completed: 50 products, 30 plans and 30 accounts');
    } catch (error) { await database.query('ROLLBACK'); throw error; }
    return;
  }
  await seedBaseline(database, requiredEnvironment('SEED_PASSWORD'));
  databaseCliLogger.info(
    { event: 'database.seeded' },
    'Baseline seed completed',
  );
});
