import { type Hex } from 'viem';
import { type ControllerAuthorizationInput } from '../../../platform/crypto/license-crypto.js';
import type { ControllerKeyIdentity, ControllerKmsPort } from '../application/ports/controller-kms.port.js';
export interface KmsSender {
    send(command: object): Promise<Record<string, unknown>>;
}
export interface AwsControllerKmsOptions {
    aliasPrefix: string;
    client?: KmsSender;
    endpoint?: string;
    region: string;
}
export declare function parseDerSignature(signature: Uint8Array): {
    r: bigint;
    s: bigint;
};
export declare class AwsControllerKms implements ControllerKmsPort {
    private readonly aliasPrefix;
    private readonly client;
    constructor(options: AwsControllerKmsOptions);
    provision(customerUserId: string): Promise<ControllerKeyIdentity>;
    signAuthorization(keyReference: string, input: ControllerAuthorizationInput): Promise<Hex>;
    private findAlias;
}
