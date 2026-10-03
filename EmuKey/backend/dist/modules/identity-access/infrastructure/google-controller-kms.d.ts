import type { Hex } from 'viem';
import { type GoogleKmsApiPort, type GoogleKmsProtectionLevel } from '../../../platform/crypto/google-cloud-kms.js';
import { type ControllerAuthorizationInput } from '../../../platform/crypto/license-crypto.js';
import type { ControllerKeyIdentity, ControllerKmsPort } from '../application/ports/controller-kms.port.js';
export interface GoogleControllerKmsOptions {
    api?: GoogleKmsApiPort;
    keyPrefix: string;
    keyRingName: string;
    protectionLevel: GoogleKmsProtectionLevel;
}
export declare class GoogleControllerKms implements ControllerKmsPort {
    private readonly options;
    private readonly api;
    constructor(options: GoogleControllerKmsOptions);
    provision(customerUserId: string): Promise<ControllerKeyIdentity>;
    signAuthorization(keyReference: string, input: ControllerAuthorizationInput): Promise<Hex>;
}
