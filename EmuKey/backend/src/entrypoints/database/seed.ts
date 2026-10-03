import {
  databaseCliLogger,
  requiredEnvironment,
  withDatabase,
} from '../../platform/database/database-cli.js';
import { seedBaseline } from '../../platform/database/seed-baseline.js';

if (requiredEnvironment('NODE_ENV') !== 'development') {
  throw new Error('Database seed is allowed only when NODE_ENV=development');
}

await withDatabase(async (database) => {
  await seedBaseline(database, requiredEnvironment('SEED_PASSWORD'));
  databaseCliLogger.info(
    { event: 'database.seeded' },
    'Baseline seed completed',
  );
});
