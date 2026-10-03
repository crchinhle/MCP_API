import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { HealthController } from './platform/health/health.controller.js';
import { PlatformReadinessService } from './platform/health/platform-readiness.service.js';
import { PostgresReadinessProbe } from './platform/health/postgres-readiness.probe.js';
import { RedisReadinessProbe } from './platform/health/redis-readiness.probe.js';
import { EvmReadinessProbe } from './platform/health/evm-readiness.probe.js';
import { NotFoundController } from './platform/http/not-found.controller.js';
import { PlatformCoreModule } from './platform/platform-core.module.js';
import { IdentityModule } from './modules/identity-access/identity.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { CommerceModule } from './modules/commerce-payment/commerce.module.js';
import { BlockchainModule } from './modules/blockchain/blockchain.module.js';
import { AssistanceSupportModule } from './modules/assistance-support/assistance-support.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';
import { LicensingModule } from './modules/licensing/licensing.module.js';

@Module({
  imports: [
    PlatformCoreModule,
    AssistanceSupportModule,
    OperationsModule,
    IdentityModule,
    CatalogModule,
    BlockchainModule,
    CommerceModule,
    LicensingModule,
  ],
  controllers: [HealthController, NotFoundController],
  providers: [
    PostgresReadinessProbe,
    RedisReadinessProbe,
    {
      provide: EvmReadinessProbe,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new EvmReadinessProbe(config),
    },
    {
      provide: PlatformReadinessService,
      inject: [
        PostgresReadinessProbe,
        RedisReadinessProbe,
        EvmReadinessProbe,
      ],
      useFactory: (
        postgres: PostgresReadinessProbe,
        redis: RedisReadinessProbe,
        blockchain: EvmReadinessProbe,
      ) => new PlatformReadinessService([postgres, redis, blockchain]),
    },
  ],
})
export class AppModule {}
