import { Pool } from 'pg';
export interface ClaimedBlockRange {
    fromBlock: number;
    toBlock: number;
}
export interface IndexedEventIdentity {
    blockHash: string;
    id: string;
    logIndex: number;
    transactionHash: string;
}
export interface ChainCommandEventContext {
    commandId: string;
    licenseDeviceId?: string;
    licenseId: string;
    providerUserId: string;
}
export interface CheckpointOwner {
    chainId: number;
    contractAddress: string;
    network: string;
}
export declare class ChainIndexerCheckpointRepository {
    private readonly pool;
    constructor(pool: Pool);
    claimRange(owner: CheckpointOwner, workerId: string, deploymentBlock: number, latestBlock: number, batchSize: number, overlap: number): Promise<ClaimedBlockRange | null>;
    completeRange(owner: CheckpointOwner, workerId: string, range: ClaimedBlockRange, blockHash: string): Promise<void>;
    release(owner: CheckpointOwner, workerId: string): Promise<void>;
    eventIdentities(owner: CheckpointOwner, fromBlock: number, toBlock: number): Promise<IndexedEventIdentity[]>;
    commandContext(commandId: string): Promise<ChainCommandEventContext | null>;
}
