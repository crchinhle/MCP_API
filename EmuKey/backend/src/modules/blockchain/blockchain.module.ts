import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Pool } from 'pg';

import { IdentityModule } from '../identity-access/identity.module.js';
import { ChainCommandService } from './application/chain-command.service.js';
import { ActivationEnvelopeRecoveryService } from './application/activation-envelope-recovery.service.js';
import { BlockchainReconciliationService } from './application/blockchain-reconciliation.service.js';
import { AuditWriter } from '../../platform/audit/audit-writer.js';
import { ChainIndexerService } from './application/chain-indexer.service.js';
import {
  CHAIN_RPC_INDEXER,
  RpcChainIndexerService,
  type ChainRpcIndexerPort,
} from './application/rpc-chain-indexer.service.js';
import { LicenseQueryService } from './application/license-query.service.js';
import {
  ACTIVATION_ENVELOPE,
  type ActivationEnvelopePort,
} from './application/ports/activation-envelope.port.js';
import {
  CHAIN_RELAYER,
  type ChainRelayerPort,
} from './application/ports/chain-relayer.port.js';
import { ChainCommandRepository } from './infrastructure/chain-command.repository.js';
import { ChainEventRepository } from './infrastructure/chain-event.repository.js';
import { ChainIndexerCheckpointRepository } from './infrastructure/chain-indexer-checkpoint.repository.js';
import { LicenseProjectionRepository } from './infrastructure/license-projection.repository.js';
import { RedisActivationEnvelope } from './infrastructure/redis-activation-envelope.js';
import { BlockchainOperationsController } from './presentation/blockchain-operations.controller.js';
import {
  LicenseController,
  PublicLicenseController,
} from './presentation/license.controller.js';

@Module({
  imports: [IdentityModule],
  controllers: [
    BlockchainOperationsController,
    LicenseController,
    PublicLicenseController,
  ],
  providers: [
    {
      provide: ACTIVATION_ENVELOPE,
      inject: [Redis, ConfigService],
      useFactory: (
        redis: Redis,
        config: ConfigService,
      ): ActivationEnvelopePort => {
        if (
          config.getOrThrow<string>('ACTIVATION_ENVELOPE_ADAPTER') !== 'redis'
        ) {
          throw new Error(
            'Only the Redis activation envelope adapter is configured',
          );
        }
        return new RedisActivationEnvelope(
          redis,
          config.getOrThrow<string>('ACTIVATION_ENVELOPE_KEY'),
        );
      },
    },
    {
      provide: CHAIN_RELAYER,
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<ChainRelayerPort> => {
        const adapter = config.getOrThrow<string>('EVM_ADAPTER');
        if (adapter !== 'viem') {
          throw new Error(`EVM adapter ${adapter} is not configured`);
        }
        const [{ LocalPrivateKeyChainSigner }, { ViemChainRelayer }] =
          await Promise.all([
            import('./infrastructure/local-private-key-chain-signer.js'),
            import('./infrastructure/viem-chain-relayer.js'),
          ]);
        const signer = new LocalPrivateKeyChainSigner(
          config.getOrThrow<string>('EVM_RELAYER_PRIVATE_KEY'),
        );
        const fallbackRpcUrl = config.get<string>('EVM_RPC_FALLBACK_HTTP_URL');
        return new ViemChainRelayer({
          chainId: config.getOrThrow<number>('EVM_CHAIN_ID'),
          ...(fallbackRpcUrl ? { fallbackRpcUrl } : {}),
          network: config.getOrThrow<string>('EVM_NETWORK'),
          rpcUrl: config.getOrThrow<string>('EVM_RPC_HTTP_URL'),
          signer,
        });
      },
    },
    {
      provide: ChainCommandRepository,
      inject: [Pool],
      useFactory: (pool: Pool) => new ChainCommandRepository(pool),
    },
    {
      provide: ChainEventRepository,
      inject: [Pool],
      useFactory: (pool: Pool) => new ChainEventRepository(pool),
    },
    {
      provide: ChainIndexerCheckpointRepository,
      inject: [Pool],
      useFactory: (pool: Pool) => new ChainIndexerCheckpointRepository(pool),
    },
    {
      provide: LicenseProjectionRepository,
      inject: [Pool],
      useFactory: (pool: Pool) => new LicenseProjectionRepository(pool),
    },
    {
      provide: ChainCommandService,
      inject: [
        ChainCommandRepository,
        CHAIN_RELAYER,
        ACTIVATION_ENVELOPE,
        ActivationEnvelopeRecoveryService,
      ],
      useFactory: (
        repository: ChainCommandRepository,
        relayer: ChainRelayerPort,
        envelopes: ActivationEnvelopePort,
        recovery: ActivationEnvelopeRecoveryService,
      ) => new ChainCommandService(repository, relayer, envelopes, recovery),
    },
    {
      provide: ActivationEnvelopeRecoveryService,
      inject: [ChainCommandRepository, ACTIVATION_ENVELOPE],
      useFactory: (
        repository: ChainCommandRepository,
        envelopes: ActivationEnvelopePort,
      ) => new ActivationEnvelopeRecoveryService(repository, envelopes),
    },
    {
      provide: ChainIndexerService,
      inject: [ChainEventRepository, ConfigService],
      useFactory: (repository: ChainEventRepository, config: ConfigService) =>
        new ChainIndexerService(
          repository,
          config.getOrThrow<number>('EVM_CONFIRMATIONS'),
        ),
    },
    {
      provide: CHAIN_RPC_INDEXER,
      inject: [
        ConfigService,
        ChainIndexerCheckpointRepository,
        ChainIndexerService,
      ],
      useFactory: async (
        config: ConfigService,
        checkpoints: ChainIndexerCheckpointRepository,
        indexer: ChainIndexerService,
      ): Promise<ChainRpcIndexerPort> => {
        const adapter = config.getOrThrow<string>('EVM_ADAPTER');
        if (adapter !== 'viem') {
          throw new Error(`EVM indexer adapter ${adapter} is not configured`);
        }
        const { ViemChainEventSource } =
          await import('./infrastructure/viem-chain-event-source.js');
        const fallbackRpcUrl = config.get<string>('EVM_RPC_FALLBACK_HTTP_URL');
        const options = {
          batchSize: config.getOrThrow<number>('EVM_INDEXER_BATCH_SIZE'),
          chainId: config.getOrThrow<number>('EVM_CHAIN_ID'),
          contractAddress: config.getOrThrow<string>('EVM_CONTRACT_ADDRESS'),
          deploymentBlock: config.getOrThrow<number>('EVM_DEPLOYMENT_BLOCK'),
          network: config.getOrThrow<string>('EVM_NETWORK'),
          requiredConfirmations: config.getOrThrow<number>('EVM_CONFIRMATIONS'),
        };
        return new RpcChainIndexerService(
          checkpoints,
          indexer,
          new ViemChainEventSource({
            chainId: options.chainId,
            contractAddress: options.contractAddress as `0x${string}`,
            ...(fallbackRpcUrl ? { fallbackRpcUrl } : {}),
            network: options.network,
            rpcUrl: config.getOrThrow<string>('EVM_RPC_HTTP_URL'),
          }),
          options,
        );
      },
    },
    {
      provide: LicenseQueryService,
      inject: [LicenseProjectionRepository, ACTIVATION_ENVELOPE, Redis],
      useFactory: (
        repository: LicenseProjectionRepository,
        envelopes: ActivationEnvelopePort,
        redis: Redis,
      ) => new LicenseQueryService(repository, envelopes, redis),
    },
    {
      provide: BlockchainReconciliationService,
      inject: [
        Pool,
        ChainCommandService,
        CHAIN_RPC_INDEXER,
        ChainEventRepository,
        AuditWriter,
      ],
      useFactory: (
        pool: Pool,
        commands: ChainCommandService,
        indexer: ChainRpcIndexerPort,
        projections: ChainEventRepository,
        audit: AuditWriter,
      ) =>
        new BlockchainReconciliationService(
          pool,
          commands,
          indexer,
          projections,
          audit,
        ),
    },
  ],
  exports: [
    ACTIVATION_ENVELOPE,
    ActivationEnvelopeRecoveryService,
    ChainCommandService,
    ChainIndexerService,
    CHAIN_RPC_INDEXER,
    BlockchainReconciliationService,
    LicenseQueryService,
    LicenseProjectionRepository,
  ],
})
export class BlockchainModule {}
