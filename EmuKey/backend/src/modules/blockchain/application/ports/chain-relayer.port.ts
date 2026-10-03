export const CHAIN_RELAYER = Symbol('CHAIN_RELAYER');

export interface ChainCommandInput {
  commandId: string;
  commandType: string;
  contractAddress: string;
  chainId: number;
  network: string;
  payload: Record<string, unknown>;
  payloadHash: string;
}

export interface PreparedChainTransaction {
  network: string;
  nonce: number;
  rawTransaction: string;
  relayerAddress: string;
  transactionHash: string;
}

export type ChainReceiptStatus = 'PENDING' | 'REVERTED' | 'SUCCESS';

export interface ChainReceipt {
  blockHash?: string;
  blockNumber?: number;
  status: ChainReceiptStatus;
  transactionHash: string;
}

export interface ChainRelayerPort {
  broadcast(transaction: PreparedChainTransaction): Promise<void>;
  getSubmissionContext(input: ChainCommandInput): Promise<{
    pendingNonce: number;
    relayerAddress: string;
  }>;
  prepare(
    input: ChainCommandInput,
    nonce: number,
  ): Promise<PreparedChainTransaction>;
  receipt(transactionHash: string): Promise<ChainReceipt | null>;
}

export class ChainSubmissionUnknownError extends Error {
  constructor(public readonly transactionHash?: string) {
    super('CHAIN_SUBMISSION_UNKNOWN');
  }
}
