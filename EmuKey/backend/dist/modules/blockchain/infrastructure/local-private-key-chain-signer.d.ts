import type { Address, Hex } from 'viem';
import type { ChainDigestSigner } from './viem-chain-relayer.js';
export declare class LocalPrivateKeyChainSigner implements ChainDigestSigner {
    private readonly account;
    constructor(privateKey: string);
    publicAddress(): Promise<Address>;
    sign(digest: Hex): Promise<Hex>;
}
