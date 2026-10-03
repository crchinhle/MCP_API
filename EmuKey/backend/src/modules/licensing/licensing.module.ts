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
import { ACTIVATION_ENVELOPE, type ActivationEnvelopePort } from '../blockchain/application/ports/activation-envelope.port.js';

@Module({
  imports: [BlockchainModule, IdentityModule],
  controllers: [LicensingController],
  providers: [
    {
      provide: LicensingRepository,
      inject: [Pool],
      useFactory: (pool: Pool) => new LicensingRepository(pool),
    },
    {
      provide: LicensingService,
      inject: [LicensingRepository, LicenseProjectionRepository, ACTIVATION_ENVELOPE, Redis, ConfigService, IdentityService],
      useFactory: (
        repository: LicensingRepository,
        projection: LicenseProjectionRepository,
        envelopes: ActivationEnvelopePort,
        redis: Redis,
        config: ConfigService,
        identity: IdentityService,
      ) => new LicensingService(
        repository,
        projection,
        envelopes,
        redis,
        new TextEncoder().encode(config.getOrThrow<string>('JWT_SECRET')),
        {
          chainId: config.getOrThrow<number>('EVM_CHAIN_ID'),
          contractAddress: config.getOrThrow<string>('EVM_CONTRACT_ADDRESS'),
          network: config.getOrThrow<string>('EVM_NETWORK'),
        },
        identity,
      ),
    },
  ],
})
export class LicensingModule {}
