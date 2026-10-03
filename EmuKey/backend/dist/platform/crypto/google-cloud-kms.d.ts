import type { Address, Hex } from 'viem';
export type GoogleKmsProtectionLevel = 'HSM';
export interface GoogleKmsApiPort {
    ensureSecp256k1Key(input: {
        keyId: string;
        keyRingName: string;
        protectionLevel: GoogleKmsProtectionLevel;
    }): Promise<string>;
    publicKeyPem(keyVersionName: string): Promise<string>;
    signDigest(keyVersionName: string, digest: Hex): Promise<Uint8Array>;
}
interface GoogleKmsClientLike {
    asymmetricSign(request: Record<string, unknown>): Promise<[Record<string, unknown>, ...unknown[]]>;
    createCryptoKey(request: Record<string, unknown>): Promise<[Record<string, unknown>, ...unknown[]]>;
    getCryptoKey(request: Record<string, unknown>): Promise<[Record<string, unknown>, ...unknown[]]>;
    getPublicKey(request: Record<string, unknown>): Promise<[Record<string, unknown>, ...unknown[]]>;
}
export declare class GoogleCloudKmsApi implements GoogleKmsApiPort {
    private readonly client;
    constructor(client?: GoogleKmsClientLike);
    ensureSecp256k1Key(input: {
        keyId: string;
        keyRingName: string;
        protectionLevel: GoogleKmsProtectionLevel;
    }): Promise<string>;
    publicKeyPem(keyVersionName: string): Promise<string>;
    signDigest(keyVersionName: string, digest: Hex): Promise<Uint8Array>;
}
export declare class GoogleKmsSecp256k1Signer {
    private readonly api;
    readonly keyVersionName: string;
    private address?;
    constructor(api: GoogleKmsApiPort, keyVersionName: string);
    publicAddress(): Promise<Address>;
    sign(digest: Hex): Promise<Hex>;
}
export {};
