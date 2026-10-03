import type { Address, Hex } from 'viem';
import type { ControllerAuthorizationInput } from '../../../../platform/crypto/license-crypto.js';
export declare const CONTROLLER_KMS: unique symbol;
export interface ControllerKeyIdentity {
    keyReference: string;
    keyVersion: number;
    publicAddress: Address;
}
export interface ControllerKmsPort {
    provision(customerUserId: string): Promise<ControllerKeyIdentity>;
    signAuthorization(keyReference: string, input: ControllerAuthorizationInput): Promise<Hex>;
}
