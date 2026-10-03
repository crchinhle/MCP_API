import type { ChainIndexerCheckpointRepository, CheckpointOwner } from '../infrastructure/chain-indexer-checkpoint.repository.js';
import type { ChainEventRpcPort } from '../infrastructure/viem-chain-event-source.js';
import type { ChainIndexerService } from './chain-indexer.service.js';
export declare const CHAIN_RPC_INDEXER: unique symbol;
export interface ChainRpcIndexerPort {
    canonicalTime(): Promise<Date>;
    poll(workerId: string): Promise<number | null>;
}
export interface RpcChainIndexerOptions extends CheckpointOwner {
    batchSize: number;
    deploymentBlock: number;
    requiredConfirmations: number;
}
export declare class RpcChainIndexerService implements ChainRpcIndexerPort {
    private readonly checkpoints;
    private readonly indexer;
    private readonly rpc;
    private readonly options;
    private lastCompletedBlock;
    private rpcBlockRangeLimit;
    constructor(checkpoints: Pick<ChainIndexerCheckpointRepository, 'claimRange' | 'commandContext' | 'completeRange' | 'eventIdentities' | 'release'>, indexer: Pick<ChainIndexerService, 'ingest' | 'markReorged'>, rpc: ChainEventRpcPort, options: RpcChainIndexerOptions);
    canonicalTime(): Promise<Date>;
    poll(workerId: string): Promise<number | null>;
    private contractEvents;
    private contractEventsInChunks;
    private providerBlockRangeLimit;
    private ingest;
    private assertContext;
}
