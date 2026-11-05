import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisClient extends Redis implements OnApplicationShutdown {
  constructor(config: ConfigService) {
    super(config.getOrThrow<string>('REDIS_URL'), {
      connectTimeout: 2_000,
      enableOfflineQueue: true,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // Reconnect the shared client after an outage; each command still fails
      // after one retry so an HTTP request cannot wait through unlimited retries.
      retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
    });
  }

  onApplicationShutdown(): void {
    this.disconnect(false);
  }
}
