import pino from 'pino';
import { Client } from 'pg';

export const databaseCliLogger = pino({ name: 'emukey-database' });

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
