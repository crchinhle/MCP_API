import { KeyManagementServiceClient, protos } from '@google-cloud/kms';
import crc32c from 'fast-crc32c';
import { publicAddressFromPem, recoverableSignature, } from './secp256k1-signature.js';
function errorCode(error) {
    return typeof error === 'object' && error !== null && 'code' in error
        ? Number(error.code)
        : undefined;
}
function primaryVersion(response) {
    const primary = response.primary;
    if (typeof primary?.name !== 'string' || primary.name === '') {
        throw new Error('GOOGLE_KMS_PRIMARY_VERSION_UNAVAILABLE');
    }
    return primary.name;
}
export class GoogleCloudKmsApi {
    client;
    constructor(client) {
        this.client =
            client ??
                new KeyManagementServiceClient();
    }
    async ensureSecp256k1Key(input) {
        const name = `${input.keyRingName}/cryptoKeys/${input.keyId}`;
        try {
            const [existing] = await this.client.getCryptoKey({ name });
            return primaryVersion(existing);
        }
        catch (error) {
            if (errorCode(error) !== 5)
                throw error;
        }
        try {
            const [created] = await this.client.createCryptoKey({
                cryptoKey: {
                    purpose: protos.google.cloud.kms.v1.CryptoKey.CryptoKeyPurpose
                        .ASYMMETRIC_SIGN,
                    versionTemplate: {
                        algorithm: protos.google.cloud.kms.v1.CryptoKeyVersion
                            .CryptoKeyVersionAlgorithm.EC_SIGN_SECP256K1_SHA256,
                        protectionLevel: protos.google.cloud.kms.v1.ProtectionLevel.HSM,
                    },
                },
                cryptoKeyId: input.keyId,
                parent: input.keyRingName,
            });
            return primaryVersion(created);
        }
        catch (error) {
            if (errorCode(error) !== 6)
                throw error;
            const [existing] = await this.client.getCryptoKey({ name });
            return primaryVersion(existing);
        }
    }
    async publicKeyPem(keyVersionName) {
        const [response] = await this.client.getPublicKey({ name: keyVersionName });
        const pem = response.pem;
        if (response.name !== keyVersionName ||
            typeof pem !== 'string' ||
            pem === '') {
            throw new Error('GOOGLE_KMS_PUBLIC_KEY_UNAVAILABLE');
        }
        const checksum = response.pemCrc32c;
        if (checksum?.value !== undefined &&
            crc32c.calculate(pem) !== Number(checksum.value)) {
            throw new Error('GOOGLE_KMS_PUBLIC_KEY_CORRUPTED');
        }
        return pem;
    }
    async signDigest(keyVersionName, digest) {
        const bytes = Buffer.from(digest.slice(2), 'hex');
        const checksum = crc32c.calculate(bytes);
        const [response] = await this.client.asymmetricSign({
            digest: { sha256: bytes },
            digestCrc32c: { value: checksum },
            name: keyVersionName,
        });
        const signature = response.signature;
        if (response.name !== keyVersionName ||
            response.verifiedDigestCrc32c !== true ||
            !(signature instanceof Uint8Array)) {
            throw new Error('GOOGLE_KMS_SIGNING_FAILED');
        }
        const signatureChecksum = response.signatureCrc32c;
        if (signatureChecksum?.value === undefined ||
            crc32c.calculate(Buffer.from(signature)) !==
                Number(signatureChecksum.value)) {
            throw new Error('GOOGLE_KMS_SIGNATURE_CORRUPTED');
        }
        return signature;
    }
}
export class GoogleKmsSecp256k1Signer {
    api;
    keyVersionName;
    address;
    constructor(api, keyVersionName) {
        this.api = api;
        this.keyVersionName = keyVersionName;
    }
    async publicAddress() {
        this.address ??= publicAddressFromPem(await this.api.publicKeyPem(this.keyVersionName));
        return this.address;
    }
    async sign(digest) {
        return recoverableSignature(digest, await this.api.signDigest(this.keyVersionName, digest), await this.publicAddress());
    }
}
//# sourceMappingURL=google-cloud-kms.js.map