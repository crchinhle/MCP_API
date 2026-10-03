import { createPublicClient, defineChain, encodeFunctionData, getAddress, keccak256, parseSignature, serializeTransaction, } from 'viem';
import { uuidToBytes16 } from '../../../platform/crypto/license-crypto.js';
import { ChainSubmissionUnknownError, } from '../application/ports/chain-relayer.port.js';
import { licenseRegistryAbi } from './license-registry-contract.js';
import { createViemRpcTransport } from '../../../platform/blockchain/viem-rpc-transport.js';
function requiredString(payload, name) {
    const value = payload[name];
    if (typeof value !== 'string' || value === '') {
        throw new Error(`CHAIN_PAYLOAD_${name.toUpperCase()}_REQUIRED`);
    }
    return value;
}
function requiredInteger(payload, name) {
    const value = payload[name];
    if (!Number.isSafeInteger(value) || Number(value) <= 0) {
        throw new Error(`CHAIN_PAYLOAD_${name.toUpperCase()}_INVALID`);
    }
    return BigInt(Number(value));
}
function timestamp(value) {
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds))
        throw new Error('CHAIN_PAYLOAD_DATE_INVALID');
    return BigInt(Math.floor(milliseconds / 1_000));
}
function bytes32(value, name) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
        throw new Error(`CHAIN_PAYLOAD_${name.toUpperCase()}_INVALID`);
    }
    return value;
}
export function encodeChainCommand(input) {
    const payload = input.payload;
    const commandId = uuidToBytes16(input.commandId);
    const licenseId = uuidToBytes16(requiredString(payload, 'licenseId'));
    switch (input.commandType) {
        case 'ISSUE_LICENSE':
            return encodeFunctionData({
                abi: licenseRegistryAbi,
                functionName: 'issueLicense',
                args: [
                    commandId,
                    licenseId,
                    getAddress(requiredString(payload, 'providerAddress')),
                    uuidToBytes16(requiredString(payload, 'productId')),
                    uuidToBytes16(requiredString(payload, 'planId')),
                    requiredInteger(payload, 'planVersion'),
                    bytes32(requiredString(payload, 'planCommitment'), 'planCommitment'),
                    bytes32(requiredString(payload, 'activationCommitment'), 'activationCommitment'),
                    requiredInteger(payload, 'keyVersion'),
                    requiredInteger(payload, 'maxActiveDevices'),
                    timestamp(requiredString(payload, 'expiresAt')),
                ],
            });
        case 'RENEW_LICENSE':
            return encodeFunctionData({
                abi: licenseRegistryAbi,
                functionName: 'renewLicense',
                args: [
                    commandId,
                    licenseId,
                    timestamp(requiredString(payload, 'expiresAt')),
                ],
            });
        case 'SUSPEND_LICENSE':
        case 'RESUME_LICENSE':
        case 'REVOKE_LICENSE':
            return encodeFunctionData({
                abi: licenseRegistryAbi,
                functionName: input.commandType === 'SUSPEND_LICENSE'
                    ? 'suspendLicense'
                    : input.commandType === 'RESUME_LICENSE'
                        ? 'resumeLicense'
                        : 'revokeLicense',
                args: [commandId, licenseId],
            });
        case 'ROTATE_KEY':
            return encodeFunctionData({
                abi: licenseRegistryAbi,
                functionName: 'rotateActivationKey',
                args: [
                    commandId,
                    licenseId,
                    bytes32(requiredString(payload, 'activationCommitment'), 'activationCommitment'),
                    requiredInteger(payload, 'keyVersion'),
                ],
            });
        case 'SYNC_DEVICE_COUNT':
            return encodeFunctionData({
                abi: licenseRegistryAbi,
                functionName: 'syncActiveDeviceCount',
                args: [
                    commandId,
                    licenseId,
                    requiredInteger(payload, 'activeDeviceCount'),
                    requiredInteger(payload, 'deviceStateVersion'),
                ],
            });
        default:
            throw new Error(`CHAIN_COMMAND_${input.commandType}_UNSUPPORTED`);
    }
}
export class ViemChainRelayer {
    options;
    rpc;
    constructor(options) {
        this.options = options;
        if (options.rpc) {
            this.rpc = options.rpc;
            return;
        }
        const chain = defineChain({
            id: options.chainId,
            name: options.network,
            nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
            rpcUrls: { default: { http: [options.rpcUrl] } },
            testnet: options.network !== 'mainnet',
        });
        const client = createPublicClient({
            chain,
            transport: createViemRpcTransport(options.rpcUrl, options.fallbackRpcUrl),
        });
        this.rpc = {
            getChainId: () => client.getChainId(),
            estimateFeesPerGas: () => client.estimateFeesPerGas({ type: 'eip1559' }),
            estimateGas: (input) => client.estimateGas(input),
            getTransactionCount: (input) => client.getTransactionCount(input),
            getTransactionReceipt: (input) => client.getTransactionReceipt(input),
            sendRawTransaction: (input) => client.sendRawTransaction(input),
        };
    }
    async getSubmissionContext(input) {
        this.assertInputNetwork(input);
        const [signerAddress, rpcChainId] = await Promise.all([
            this.options.signer.publicAddress(),
            this.rpc.getChainId(),
        ]);
        const relayerAddress = signerAddress.toLowerCase();
        if (rpcChainId !== this.options.chainId) {
            throw new Error('CHAIN_RPC_CHAIN_ID_MISMATCH');
        }
        return {
            pendingNonce: await this.rpc.getTransactionCount({
                address: relayerAddress,
                blockTag: 'pending',
            }),
            relayerAddress,
        };
    }
    async prepare(input, nonce) {
        this.assertInputNetwork(input);
        const relayerAddress = (await this.options.signer.publicAddress()).toLowerCase();
        const to = getAddress(input.contractAddress);
        const data = encodeChainCommand(input);
        const [fees, estimatedGas] = await Promise.all([
            this.rpc.estimateFeesPerGas(),
            this.rpc.estimateGas({ account: relayerAddress, data, to }),
        ]);
        const transaction = {
            chainId: this.options.chainId,
            data,
            gas: (estimatedGas * 120n) / 100n,
            maxFeePerGas: fees.maxFeePerGas,
            maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
            nonce,
            to,
            type: 'eip1559',
            value: 0n,
        };
        const digest = keccak256(serializeTransaction(transaction));
        const signature = parseSignature(await this.options.signer.sign(digest));
        const rawTransaction = serializeTransaction(transaction, signature);
        return {
            network: input.network,
            nonce,
            rawTransaction,
            relayerAddress,
            transactionHash: keccak256(rawTransaction),
        };
    }
    async broadcast(transaction) {
        try {
            const hash = await this.rpc.sendRawTransaction({
                serializedTransaction: transaction.rawTransaction,
            });
            if (hash.toLowerCase() !== transaction.transactionHash.toLowerCase()) {
                throw new Error('CHAIN_RPC_TRANSACTION_HASH_MISMATCH');
            }
        }
        catch (error) {
            if (error instanceof Error &&
                error.message === 'CHAIN_RPC_TRANSACTION_HASH_MISMATCH') {
                throw error;
            }
            throw new ChainSubmissionUnknownError(transaction.transactionHash);
        }
    }
    async receipt(transactionHash) {
        try {
            const receipt = await this.rpc.getTransactionReceipt({
                hash: transactionHash,
            });
            return {
                blockHash: receipt.blockHash,
                blockNumber: Number(receipt.blockNumber),
                status: receipt.status === 'success' ? 'SUCCESS' : 'REVERTED',
                transactionHash: receipt.transactionHash,
            };
        }
        catch (error) {
            const name = error instanceof Error ? error.name : '';
            const message = error instanceof Error ? error.message : String(error);
            if (/TransactionReceiptNotFound|could not be found|not found/i.test(`${name} ${message}`)) {
                return null;
            }
            throw error;
        }
    }
    assertInputNetwork(input) {
        if (input.chainId !== this.options.chainId ||
            input.network !== this.options.network) {
            throw new Error('CHAIN_COMMAND_NETWORK_MISMATCH');
        }
    }
}
//# sourceMappingURL=viem-chain-relayer.js.map