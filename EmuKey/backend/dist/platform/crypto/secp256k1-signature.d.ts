import { type Address, type Hex } from 'viem';
export declare function parseDerSignature(signature: Uint8Array): {
    r: bigint;
    s: bigint;
};
export declare function publicAddressFromPem(publicKeyPem: string): Address;
export declare function recoverableSignature(digest: Hex, derSignature: Uint8Array, expectedAddress: Address): Promise<Hex>;
