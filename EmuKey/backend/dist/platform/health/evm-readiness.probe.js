import { createPublicClient, defineChain, getAddress, } from 'viem';
import { createViemRpcTransport } from '../blockchain/viem-rpc-transport.js';
export class EvmReadinessProbe {
    name = 'blockchain';
    address;
    chainId;
    client;
    constructor(config, client) {
        this.address = getAddress(config.getOrThrow('EVM_CONTRACT_ADDRESS'));
        this.chainId = config.getOrThrow('EVM_CHAIN_ID');
        if (client) {
            this.client = client;
            return;
        }
        const rpcUrl = config.getOrThrow('EVM_RPC_HTTP_URL');
        const chain = defineChain({
            id: this.chainId,
            name: config.getOrThrow('EVM_NETWORK'),
            nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
            rpcUrls: { default: { http: [rpcUrl] } },
            testnet: true,
        });
        this.client = createPublicClient({
            cacheTime: 0,
            chain,
            transport: createViemRpcTransport(rpcUrl, config.get('EVM_RPC_FALLBACK_HTTP_URL')),
        });
    }
    async check() {
        if ((await this.client.getChainId()) !== this.chainId) {
            throw new Error('EVM_CHAIN_ID_MISMATCH');
        }
        const code = await this.client.getCode({ address: this.address });
        if (!code || code === '0x') {
            throw new Error('EVM_CONTRACT_NOT_DEPLOYED');
        }
    }
}
//# sourceMappingURL=evm-readiness.probe.js.map