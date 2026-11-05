import { Module } from '@nestjs/common';
import { ProviderHandoffModule } from './provider-handoff.module.js';
import { ProviderHandoffService } from './application/provider-handoff.service.js';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Pool } from 'pg';

import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { IdentityModule } from '../identity-access/identity.module.js';
import { IdentityService } from '../identity-access/identity.service.js';
import { LicensingController } from './licensing.controller.js';
import { LicensingService } from './licensing.service.js';
import { LicensingRepository } from './infrastructure/licensing.repository.js';
import { LicenseProjectionReader } from '../blockchain/application/license-projection-reader.js';
import { ACTIVATION_ENVELOPE, type ActivationEnvelopePort } from '../blockchain/application/ports/activation-envelope.port.js';

@Module({
  imports: [BlockchainModule, IdentityModule, ProviderHandoffModule],
  controllers: [LicensingController],
  providers: [
    {
      provide: LicensingRepository,
      inject: [Pool,ProviderHandoffService],
      useFactory: (pool: Pool,handoff:ProviderHandoffService) => new LicensingRepository(pool,handoff),
    },
    {
      provide: LicensingService,
      inject: [LicensingRepository, LicenseProjectionReader, ACTIVATION_ENVELOPE, Redis, ConfigService, IdentityService, ProviderHandoffService],
      useFactory: (
        repository: LicensingRepository,
        projection: LicenseProjectionReader,
        envelopes: ActivationEnvelopePort,
        redis: Redis,
        config: ConfigService,
        identity: IdentityService,
        handoff: ProviderHandoffService,
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
        config.getOrThrow<number>('PUBLIC_ACTIVATION_RATE_LIMIT_PER_MINUTE'),
        handoff,
      ),
    },
  ],
})
export class LicensingModule {}
