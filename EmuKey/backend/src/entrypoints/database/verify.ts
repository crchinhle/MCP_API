import {
  databaseCliLogger,
  withDatabase,
} from '../../platform/database/database-cli.js';
import { verifyBaselineDatabase } from '../../platform/database/verify-baseline-database.js';

await withDatabase(async (database) => {
  await database.query('BEGIN READ ONLY');
  try {
    const report = await verifyBaselineDatabase(database);
    if (!report.matchesBaseline) {
      throw new Error(
        `Database does not match baseline: ${JSON.stringify(report)}`,
      );
    }
    databaseCliLogger.info(
      { event: 'database.verified', report },
      'Baseline database verification completed',
    );
  } finally {
    await database.query('ROLLBACK');
  }
});
