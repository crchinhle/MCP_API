import {
  createPublicClient,
  defineChain,
  getAddress,
  type Address,
  type Hex,
} from 'viem';

import { licenseRegistryAbi } from './license-registry-contract.js';
import { createViemRpcTransport } from '../../../platform/blockchain/viem-rpc-transport.js';

const INDEXED_EVENT_NAMES = new Set([
  'ActivationKeyRotated',
  'ActiveDeviceCountSynced',
  'LicenseIssued',
  'LicenseRenewed',
  'LicenseStatusChanged',
]);

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
  contractEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<RpcContractEvent[]>;
  latestBlock(): Promise<number>;
}

export interface ViemChainEventSourceOptions {
  chainId: number;
  contractAddress: Address;
  fallbackRpcUrl?: string;
  network: string;
  rpcUrl: string;
}

function sanitizeRpcError(operation: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const sanitized = message.replaceAll(
    /https?:\/\/[^\s]+/g,
    '[REDACTED_RPC_URL]',
  );
  return new Error(`${operation}: ${sanitized}`);
}

export class ViemChainEventSource implements ChainEventRpcPort {
  private readonly client;

  constructor(private readonly options: ViemChainEventSourceOptions) {
    const chain = defineChain({
      id: options.chainId,
      name: options.network,
      nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
      rpcUrls: { default: { http: [options.rpcUrl] } },
      testnet: options.network !== 'mainnet',
    });
    this.client = createPublicClient({
      cacheTime: 0,
      chain,
      transport: createViemRpcTransport(options.rpcUrl, options.fallbackRpcUrl),
    });
  }

  async latestBlock(): Promise<number> {
    try {
      return Number(await this.client.getBlockNumber());
    } catch (error) {
      throw sanitizeRpcError('CHAIN_RPC_LATEST_BLOCK_FAILED', error);
    }
  }

  async blockHash(blockNumber: number): Promise<Hex> {
    try {
      const block = await this.client.getBlock({
        blockNumber: BigInt(blockNumber),
      });
      if (!block.hash) throw new Error('CHAIN_BLOCK_HASH_UNAVAILABLE');
      return block.hash;
    } catch (error) {
      throw sanitizeRpcError('CHAIN_RPC_BLOCK_HASH_FAILED', error);
    }
  }

  async blockTimestamp(blockNumber: number): Promise<Date> {
    try {
      const block = await this.client.getBlock({ blockNumber: BigInt(blockNumber) });
      return new Date(Number(block.timestamp) * 1_000);
    } catch (error) {
      throw sanitizeRpcError('CHAIN_RPC_BLOCK_TIMESTAMP_FAILED', error);
    }
  }

  async contractEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<RpcContractEvent[]> {
    try {
      const logs = await this.client.getContractEvents({
        abi: licenseRegistryAbi,
        address: getAddress(this.options.contractAddress),
        fromBlock: BigInt(fromBlock),
        strict: true,
        toBlock: BigInt(toBlock),
      });
      return logs
        .filter(
          (log) =>
            'eventName' in log &&
            INDEXED_EVENT_NAMES.has(String(log.eventName)),
        )
        .map((log) => {
          if (
            !log.blockHash ||
            log.blockNumber === null ||
            log.logIndex === null ||
            !log.transactionHash ||
            !('eventName' in log) ||
            !('args' in log)
          ) {
            throw new Error('CHAIN_EVENT_INCOMPLETE');
          }
          return {
            args: log.args as Record<string, unknown>,
            blockHash: log.blockHash,
            blockNumber: log.blockNumber,
            eventName: String(log.eventName),
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
          };
        });
    } catch (error) {
      throw sanitizeRpcError('CHAIN_RPC_GET_EVENTS_FAILED', error);
    }
  }
}
