import { type Address, type Hex, type TransactionReceipt } from 'viem';
import { type ChainCommandInput, type ChainReceipt, type ChainRelayerPort, type PreparedChainTransaction } from '../application/ports/chain-relayer.port.js';
export interface ChainDigestSigner {
    publicAddress(): Promise<Address>;
    sign(digest: Hex): Promise<Hex>;
}
export interface ViemRelayerRpc {
    getChainId(): Promise<number>;
    estimateFeesPerGas(): Promise<{
        maxFeePerGas: bigint;
        maxPriorityFeePerGas: bigint;
    }>;
    estimateGas(input: {
        account: Address;
        data: Hex;
        to: Address;
    }): Promise<bigint>;
    getTransactionCount(input: {
        address: Address;
        blockTag: 'pending';
    }): Promise<number>;
    getTransactionReceipt(input: {
        hash: Hex;
    }): Promise<TransactionReceipt>;
    sendRawTransaction(input: {
        serializedTransaction: Hex;
    }): Promise<Hex>;
}
export interface ViemChainRelayerOptions {
    chainId: number;
    fallbackRpcUrl?: string;
    network: string;
    rpc?: ViemRelayerRpc;
    rpcUrl: string;
    signer: ChainDigestSigner;
}
export declare function encodeChainCommand(input: ChainCommandInput): Hex;
export declare class ViemChainRelayer implements ChainRelayerPort {
    private readonly options;
    private readonly rpc;
    constructor(options: ViemChainRelayerOptions);
    getSubmissionContext(input: ChainCommandInput): Promise<{
        pendingNonce: number;
        relayerAddress: `0x${string}`;
    }>;
    prepare(input: ChainCommandInput, nonce: number): Promise<PreparedChainTransaction>;
    broadcast(transaction: PreparedChainTransaction): Promise<void>;
    receipt(transactionHash: string): Promise<ChainReceipt | null>;
    private assertInputNetwork;
}
