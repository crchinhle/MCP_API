import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { applyUpgrade, databaseCliLogger, withDatabase } from '../../platform/database/database-cli.js';

const { values } = parseArgs({ options: { from: { type: 'string' }, to: { type: 'string' } } });
if (!values.from || !values.to) throw new Error('Specify --from=<approved-source> --to=<target-version>');
const sql = await readFile(resolve('database/schema.sql'), 'utf8');
await withDatabase(async (database) => {
  const status = await applyUpgrade(database, sql, values.from!, values.to!);
  databaseCliLogger.info({ event: 'database.upgraded', from: values.from, to: values.to, status });
});
