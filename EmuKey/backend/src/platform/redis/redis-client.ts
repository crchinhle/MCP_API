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
      retryStrategy: () => null,
    });
  }

  onApplicationShutdown(): void {
    this.disconnect(false);
  }
}
