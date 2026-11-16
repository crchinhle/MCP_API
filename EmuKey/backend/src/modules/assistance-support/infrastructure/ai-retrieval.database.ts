import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

export interface AiReadQueryPort {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
}

/** Separate inference connection. Credentials and SQL are never exposed to the model. */
@Injectable()
export class AiRetrievalDatabase
  implements AiReadQueryPort, OnApplicationShutdown
{
  private readonly pool: Pool;
  constructor(config: ConfigService) {
    this.pool = new Pool({
      connectionString:
        config.get<string>('AI_RETRIEVAL_DATABASE_URL') ??
        config.getOrThrow<string>('DATABASE_URL'),
      max: 4,
      connectionTimeoutMillis: 5000,
    });
    const logger = new Logger(AiRetrievalDatabase.name);
    this.pool.on('error', () =>
      logger.warn({ event: 'ai.retrieval.connection_error' }),
    );
  }
  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>> {
    const client = await this.pool.connect();
    try {
      // SET LOCAL works with transaction poolers; startup options are often rejected by them.
      await client.query('BEGIN READ ONLY');
      await client.query('SET LOCAL ROLE emukey_ai_reader');
      await client.query("SET LOCAL statement_timeout='5s'");
      const result = await client.query<R>(text, values);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async onApplicationShutdown() {
    await this.pool.end();
  }
}
