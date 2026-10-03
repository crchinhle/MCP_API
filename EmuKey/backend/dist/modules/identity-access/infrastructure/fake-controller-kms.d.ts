import { type Hex } from 'viem';
import type { ControllerKeyIdentity, ControllerKmsPort } from '../application/ports/controller-kms.port.js';
import type { ControllerAuthorizationInput } from '../../../platform/crypto/license-crypto.js';
export declare class FakeControllerKms implements ControllerKmsPort {
    provision(customerUserId: string): Promise<ControllerKeyIdentity>;
    signAuthorization(keyReference: string, input: ControllerAuthorizationInput): Promise<Hex>;
}
