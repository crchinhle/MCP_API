import type { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  defineChain,
  getAddress,
  type Address,
  type Hex,
} from 'viem';

import type { ReadinessProbe } from './platform-readiness.service.js';
import { createViemRpcTransport } from '../blockchain/viem-rpc-transport.js';

export interface EvmReadinessClient {
  getChainId(): Promise<number>;
  getCode(input: { address: Address }): Promise<Hex | undefined>;
}

export class EvmReadinessProbe implements ReadinessProbe {
  readonly name = 'blockchain';
  private readonly address: Address;
  private readonly chainId: number;
  private readonly client: EvmReadinessClient;

  constructor(
    config: Pick<ConfigService, 'get' | 'getOrThrow'>,
    client?: EvmReadinessClient,
  ) {
    this.address = getAddress(
      config.getOrThrow<string>('EVM_CONTRACT_ADDRESS'),
    );
    this.chainId = config.getOrThrow<number>('EVM_CHAIN_ID');
    if (client) {
      this.client = client;
      return;
    }
    const rpcUrl = config.getOrThrow<string>('EVM_RPC_HTTP_URL');
    const chain = defineChain({
      id: this.chainId,
      name: config.getOrThrow<string>('EVM_NETWORK'),
      nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
      rpcUrls: { default: { http: [rpcUrl] } },
      testnet: true,
    });
    this.client = createPublicClient({
      cacheTime: 0,
      chain,
      transport: createViemRpcTransport(
        rpcUrl,
        config.get<string>('EVM_RPC_FALLBACK_HTTP_URL'),
      ),
    });
  }

  async check(): Promise<void> {
    if ((await this.client.getChainId()) !== this.chainId) {
      throw new Error('EVM_CHAIN_ID_MISMATCH');
    }
    const code = await this.client.getCode({ address: this.address });
    if (!code || code === '0x') {
      throw new Error('EVM_CONTRACT_NOT_DEPLOYED');
    }
  }
}
