import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { Pool } from 'pg';
import { Redis } from 'ioredis';

import { validateEnvironment } from './config/environment.js';
import { AuditWriter } from './audit/audit-writer.js';
import { DatabasePool } from './database/database-pool.js';
import { REDACTED_LOG_PATHS } from './observability/log-redaction.js';
import { RedisClient } from './redis/redis-client.js';
import { ServiceTermsContent } from './terms/service-terms-content.js';
import { LocalPrivateStorage } from './storage/local-private-storage.js';
import { CloudinaryPrivateStorage } from './storage/cloudinary-private-storage.js';
import {
  PRIVATE_STORAGE,
  type PrivateStoragePort,
} from './storage/private-storage.port.js';

const queueImports =
  process.env.NODE_ENV === 'test'
    ? []
    : [
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: { url: config.getOrThrow<string>('REDIS_URL') },
          }),
        }),
      ];

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ...queueImports,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.getOrThrow<string>('LOG_LEVEL'),
          redact: { paths: [...REDACTED_LOG_PATHS], censor: '[REDACTED]' },
        },
      }),
    }),
  ],
  providers: [
    AuditWriter,
    ServiceTermsContent,
    DatabasePool,
    RedisClient,
    {
      provide: PRIVATE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PrivateStoragePort => {
        const adapter = config.getOrThrow<string>('STORAGE_ADAPTER');
         if (adapter === 'local') return new LocalPrivateStorage('data/storage');
         if (adapter === 'cloudinary') return new CloudinaryPrivateStorage({
           cloudName: config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
           apiKey: config.getOrThrow<string>('CLOUDINARY_API_KEY'),
           apiSecret: config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
           folder: config.getOrThrow<string>('CLOUDINARY_FOLDER'),
         });
         throw new Error(`Storage adapter ${adapter} is not configured`);
      },
    },
    { provide: Pool, useExisting: DatabasePool },
    { provide: Redis, useExisting: RedisClient },
  ],
  exports: [AuditWriter, ConfigModule, Pool, Redis, PRIVATE_STORAGE, ServiceTermsContent],
})
export class PlatformCoreModule {}
