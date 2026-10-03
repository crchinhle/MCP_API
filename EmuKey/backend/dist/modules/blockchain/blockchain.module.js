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
import { IdentityModule } from '../identity-access/identity.module.js';
import { ChainCommandService } from './application/chain-command.service.js';
import { ActivationEnvelopeRecoveryService } from './application/activation-envelope-recovery.service.js';
import { BlockchainReconciliationService } from './application/blockchain-reconciliation.service.js';
import { AuditWriter } from '../../platform/audit/audit-writer.js';
import { ChainIndexerService } from './application/chain-indexer.service.js';
import { CHAIN_RPC_INDEXER, RpcChainIndexerService, } from './application/rpc-chain-indexer.service.js';
import { LicenseQueryService } from './application/license-query.service.js';
import { ACTIVATION_ENVELOPE, } from './application/ports/activation-envelope.port.js';
import { CHAIN_RELAYER, } from './application/ports/chain-relayer.port.js';
import { ChainCommandRepository } from './infrastructure/chain-command.repository.js';
import { ChainEventRepository } from './infrastructure/chain-event.repository.js';
import { ChainIndexerCheckpointRepository } from './infrastructure/chain-indexer-checkpoint.repository.js';
import { LicenseProjectionRepository } from './infrastructure/license-projection.repository.js';
import { RedisActivationEnvelope } from './infrastructure/redis-activation-envelope.js';
import { BlockchainOperationsController } from './presentation/blockchain-operations.controller.js';
import { LicenseController, PublicLicenseController, } from './presentation/license.controller.js';
let BlockchainModule = class BlockchainModule {
};
BlockchainModule = __decorate([
    Module({
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
                useFactory: (redis, config) => {
                    if (config.getOrThrow('ACTIVATION_ENVELOPE_ADAPTER') !== 'redis') {
                        throw new Error('Only the Redis activation envelope adapter is configured');
                    }
                    return new RedisActivationEnvelope(redis, config.getOrThrow('ACTIVATION_ENVELOPE_KEY'));
                },
            },
            {
                provide: CHAIN_RELAYER,
                inject: [ConfigService],
                useFactory: async (config) => {
                    const adapter = config.getOrThrow('EVM_ADAPTER');
                    if (adapter !== 'viem') {
                        throw new Error(`EVM adapter ${adapter} is not configured`);
                    }
                    const [{ LocalPrivateKeyChainSigner }, { ViemChainRelayer }] = await Promise.all([
                        import('./infrastructure/local-private-key-chain-signer.js'),
                        import('./infrastructure/viem-chain-relayer.js'),
                    ]);
                    const signer = new LocalPrivateKeyChainSigner(config.getOrThrow('EVM_RELAYER_PRIVATE_KEY'));
                    const fallbackRpcUrl = config.get('EVM_RPC_FALLBACK_HTTP_URL');
                    return new ViemChainRelayer({
                        chainId: config.getOrThrow('EVM_CHAIN_ID'),
                        ...(fallbackRpcUrl ? { fallbackRpcUrl } : {}),
                        network: config.getOrThrow('EVM_NETWORK'),
                        rpcUrl: config.getOrThrow('EVM_RPC_HTTP_URL'),
                        signer,
                    });
                },
            },
            {
                provide: ChainCommandRepository,
                inject: [Pool],
                useFactory: (pool) => new ChainCommandRepository(pool),
            },
            {
                provide: ChainEventRepository,
                inject: [Pool],
                useFactory: (pool) => new ChainEventRepository(pool),
            },
            {
                provide: ChainIndexerCheckpointRepository,
                inject: [Pool],
                useFactory: (pool) => new ChainIndexerCheckpointRepository(pool),
            },
            {
                provide: LicenseProjectionRepository,
                inject: [Pool],
                useFactory: (pool) => new LicenseProjectionRepository(pool),
            },
            {
                provide: ChainCommandService,
                inject: [
                    ChainCommandRepository,
                    CHAIN_RELAYER,
                    ACTIVATION_ENVELOPE,
                    ActivationEnvelopeRecoveryService,
                ],
                useFactory: (repository, relayer, envelopes, recovery) => new ChainCommandService(repository, relayer, envelopes, recovery),
            },
            {
                provide: ActivationEnvelopeRecoveryService,
                inject: [ChainCommandRepository, ACTIVATION_ENVELOPE],
                useFactory: (repository, envelopes) => new ActivationEnvelopeRecoveryService(repository, envelopes),
            },
            {
                provide: ChainIndexerService,
                inject: [ChainEventRepository, ConfigService],
                useFactory: (repository, config) => new ChainIndexerService(repository, config.getOrThrow('EVM_CONFIRMATIONS')),
            },
            {
                provide: CHAIN_RPC_INDEXER,
                inject: [
                    ConfigService,
                    ChainIndexerCheckpointRepository,
                    ChainIndexerService,
                ],
                useFactory: async (config, checkpoints, indexer) => {
                    const adapter = config.getOrThrow('EVM_ADAPTER');
                    if (adapter !== 'viem') {
                        throw new Error(`EVM indexer adapter ${adapter} is not configured`);
                    }
                    const { ViemChainEventSource } = await import('./infrastructure/viem-chain-event-source.js');
                    const fallbackRpcUrl = config.get('EVM_RPC_FALLBACK_HTTP_URL');
                    const options = {
                        batchSize: config.getOrThrow('EVM_INDEXER_BATCH_SIZE'),
                        chainId: config.getOrThrow('EVM_CHAIN_ID'),
                        contractAddress: config.getOrThrow('EVM_CONTRACT_ADDRESS'),
                        deploymentBlock: config.getOrThrow('EVM_DEPLOYMENT_BLOCK'),
                        network: config.getOrThrow('EVM_NETWORK'),
                        requiredConfirmations: config.getOrThrow('EVM_CONFIRMATIONS'),
                    };
                    return new RpcChainIndexerService(checkpoints, indexer, new ViemChainEventSource({
                        chainId: options.chainId,
                        contractAddress: options.contractAddress,
                        ...(fallbackRpcUrl ? { fallbackRpcUrl } : {}),
                        network: options.network,
                        rpcUrl: config.getOrThrow('EVM_RPC_HTTP_URL'),
                    }), options);
                },
            },
            {
                provide: LicenseQueryService,
                inject: [LicenseProjectionRepository, ACTIVATION_ENVELOPE, Redis],
                useFactory: (repository, envelopes, redis) => new LicenseQueryService(repository, envelopes, redis),
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
                useFactory: (pool, commands, indexer, projections, audit) => new BlockchainReconciliationService(pool, commands, indexer, projections, audit),
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
], BlockchainModule);
export { BlockchainModule };
//# sourceMappingURL=blockchain.module.js.map