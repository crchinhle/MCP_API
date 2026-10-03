import { keccak256, stringToHex } from 'viem';
export class DeterministicLocalChainRelayer {
    receipts = new Map();
    getSubmissionContext(input) {
        if (!input.network)
            throw new Error('CHAIN_NETWORK_REQUIRED');
        return Promise.resolve({
            pendingNonce: 0,
            relayerAddress: '0x0000000000000000000000000000000000001337',
        });
    }
    prepare(input, nonce) {
        const rawTransaction = stringToHex(`${input.commandId}:${input.payloadHash}:${nonce}`);
        return Promise.resolve({
            network: input.network,
            nonce,
            rawTransaction,
            relayerAddress: '0x0000000000000000000000000000000000001337',
            transactionHash: keccak256(rawTransaction),
        });
    }
    broadcast(transaction) {
        this.receipts.set(transaction.transactionHash, {
            status: 'PENDING',
            transactionHash: transaction.transactionHash,
        });
        return Promise.resolve();
    }
    receipt(transactionHash) {
        return Promise.resolve(this.receipts.get(transactionHash) ?? null);
    }
}
//# sourceMappingURL=deterministic-local-chain-relayer.js.map