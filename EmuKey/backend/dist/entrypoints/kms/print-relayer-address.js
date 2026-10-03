import { GoogleCloudKmsApi, GoogleKmsSecp256k1Signer, } from '../../platform/crypto/google-cloud-kms.js';
const keyVersion = process.env.GOOGLE_KMS_RELAYER_KEY_VERSION;
if (!keyVersion)
    throw new Error('GOOGLE_KMS_RELAYER_KEY_VERSION is required');
const signer = new GoogleKmsSecp256k1Signer(new GoogleCloudKmsApi(), keyVersion);
process.stdout.write(`RELAYER_ADDRESS=${await signer.publicAddress()}\n`);
//# sourceMappingURL=print-relayer-address.js.map