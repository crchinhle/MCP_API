var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
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
                useFactory: (config) => new EvmReadinessProbe(config),
            },
            {
                provide: PlatformReadinessService,
                inject: [
                    PostgresReadinessProbe,
                    RedisReadinessProbe,
                    EvmReadinessProbe,
                ],
                useFactory: (postgres, redis, blockchain) => new PlatformReadinessService([postgres, redis, blockchain]),
            },
        ],
    })
], AppModule);
export { AppModule };
//# sourceMappingURL=app.module.js.map