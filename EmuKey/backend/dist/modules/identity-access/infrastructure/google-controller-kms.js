import { GoogleCloudKmsApi, GoogleKmsSecp256k1Signer, } from '../../../platform/crypto/google-cloud-kms.js';
import { controllerAuthorizationDigest, } from '../../../platform/crypto/license-crypto.js';
export class GoogleControllerKms {
    options;
    api;
    constructor(options) {
        this.options = options;
        this.api = options.api ?? new GoogleCloudKmsApi();
    }
    async provision(customerUserId) {
        const keyReference = await this.api.ensureSecp256k1Key({
            keyId: `${this.options.keyPrefix}-${customerUserId}`,
            keyRingName: this.options.keyRingName,
            protectionLevel: this.options.protectionLevel,
        });
        const signer = new GoogleKmsSecp256k1Signer(this.api, keyReference);
        return {
            keyReference,
            keyVersion: Number(keyReference.split('/').at(-1) ?? 1),
            publicAddress: await signer.publicAddress(),
        };
    }
    async signAuthorization(keyReference, input) {
        return new GoogleKmsSecp256k1Signer(this.api, keyReference).sign(controllerAuthorizationDigest(input));
    }
}
//# sourceMappingURL=google-controller-kms.js.map