import { privateKeyToAccount } from 'viem/accounts';
export class LocalPrivateKeyChainSigner {
    account;
    constructor(privateKey) {
        if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
            throw new Error('EVM_RELAYER_PRIVATE_KEY must contain a 32-byte hex key');
        }
        this.account = privateKeyToAccount(privateKey);
    }
    publicAddress() {
        return Promise.resolve(this.account.address);
    }
    sign(digest) {
        return this.account.sign({ hash: digest });
    }
}
//# sourceMappingURL=local-private-key-chain-signer.js.map