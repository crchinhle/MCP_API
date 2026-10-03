import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class DatabasePool extends Pool implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabasePool.name);

  constructor(config: ConfigService) {
    super({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      connectionTimeoutMillis: 10_000,
    });
    this.on('error', (error: Error & { code?: string }) => {
      this.logger.error({
        code: error.code ?? 'POSTGRES_CONNECTION_ERROR',
        event: 'postgres.idle_connection.error',
      });
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.end();
  }
}
