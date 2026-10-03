import { keccak256, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { controllerAuthorizationTypedData } from '../../../platform/crypto/license-crypto.js';
function privateKey(customerUserId) {
    return keccak256(stringToHex(`emukey-fake-controller:${customerUserId}`));
}
export class FakeControllerKms {
    provision(customerUserId) {
        const account = privateKeyToAccount(privateKey(customerUserId));
        return Promise.resolve({
            keyReference: `fake-controller:${customerUserId}:v1`,
            keyVersion: 1,
            publicAddress: account.address,
        });
    }
    async signAuthorization(keyReference, input) {
        const match = /^fake-controller:(.+):v1$/.exec(keyReference);
        if (!match?.[1])
            throw new Error('UNKNOWN_CONTROLLER_KEY');
        return privateKeyToAccount(privateKey(match[1])).signTypedData(controllerAuthorizationTypedData(input));
    }
}
//# sourceMappingURL=fake-controller-kms.js.map