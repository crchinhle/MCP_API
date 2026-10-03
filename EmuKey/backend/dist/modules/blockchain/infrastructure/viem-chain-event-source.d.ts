import { type Address, type Hex } from 'viem';
export interface RpcContractEvent {
    args: Record<string, unknown>;
    blockHash: Hex;
    blockNumber: bigint;
    eventName: string;
    logIndex: number;
    transactionHash: Hex;
}
export interface ChainEventRpcPort {
    blockHash(blockNumber: number): Promise<Hex>;
    blockTimestamp(blockNumber: number): Promise<Date>;
    contractEvents(fromBlock: number, toBlock: number): Promise<RpcContractEvent[]>;
    latestBlock(): Promise<number>;
}
export interface ViemChainEventSourceOptions {
    chainId: number;
    contractAddress: Address;
    fallbackRpcUrl?: string;
    network: string;
    rpcUrl: string;
}
export declare class ViemChainEventSource implements ChainEventRpcPort {
    private readonly options;
    private readonly client;
    constructor(options: ViemChainEventSourceOptions);
    latestBlock(): Promise<number>;
    blockHash(blockNumber: number): Promise<Hex>;
    blockTimestamp(blockNumber: number): Promise<Date>;
    contractEvents(fromBlock: number, toBlock: number): Promise<RpcContractEvent[]>;
}
