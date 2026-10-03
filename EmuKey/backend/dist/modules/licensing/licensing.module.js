var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Pool } from 'pg';
import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { IdentityModule } from '../identity-access/identity.module.js';
import { IdentityService } from '../identity-access/identity.service.js';
import { LicensingController } from './licensing.controller.js';
import { LicensingService } from './licensing.service.js';
import { LicensingRepository } from './infrastructure/licensing.repository.js';
import { LicenseProjectionRepository } from '../blockchain/infrastructure/license-projection.repository.js';
import { ACTIVATION_ENVELOPE } from '../blockchain/application/ports/activation-envelope.port.js';
let LicensingModule = class LicensingModule {
};
LicensingModule = __decorate([
    Module({
        imports: [BlockchainModule, IdentityModule],
        controllers: [LicensingController],
        providers: [
            {
                provide: LicensingRepository,
                inject: [Pool],
                useFactory: (pool) => new LicensingRepository(pool),
            },
            {
                provide: LicensingService,
                inject: [LicensingRepository, LicenseProjectionRepository, ACTIVATION_ENVELOPE, Redis, ConfigService, IdentityService],
                useFactory: (repository, projection, envelopes, redis, config, identity) => new LicensingService(repository, projection, envelopes, redis, new TextEncoder().encode(config.getOrThrow('JWT_SECRET')), {
                    chainId: config.getOrThrow('EVM_CHAIN_ID'),
                    contractAddress: config.getOrThrow('EVM_CONTRACT_ADDRESS'),
                    network: config.getOrThrow('EVM_NETWORK'),
                }, identity),
            },
        ],
    })
], LicensingModule);
export { LicensingModule };
//# sourceMappingURL=licensing.module.js.map