import type { ChainCommandInput, ChainReceipt, ChainRelayerPort, PreparedChainTransaction } from '../application/ports/chain-relayer.port.js';
export declare class DeterministicLocalChainRelayer implements ChainRelayerPort {
    private readonly receipts;
    getSubmissionContext(input: ChainCommandInput): Promise<{
        pendingNonce: number;
        relayerAddress: string;
    }>;
    prepare(input: ChainCommandInput, nonce: number): Promise<PreparedChainTransaction>;
    broadcast(transaction: PreparedChainTransaction): Promise<void>;
    receipt(transactionHash: string): Promise<ChainReceipt | null>;
}
