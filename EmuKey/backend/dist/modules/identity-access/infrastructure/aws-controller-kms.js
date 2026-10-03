import { createPublicKey } from 'node:crypto';
import { CreateAliasCommand, CreateKeyCommand, GetPublicKeyCommand, KMSClient, ListAliasesCommand, SignCommand, } from '@aws-sdk/client-kms';
import { recoverAddress, serializeSignature, } from 'viem';
import { publicKeyToAddress } from 'viem/accounts';
import { controllerAuthorizationDigest, } from '../../../platform/crypto/license-crypto.js';
const SECP256K1_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
function bytesFromBase64Url(value) {
    return Buffer.from(value, 'base64url');
}
function publicAddress(publicKeyDer) {
    const key = createPublicKey({
        format: 'der',
        key: Buffer.from(publicKeyDer),
        type: 'spki',
    });
    const jwk = key.export({ format: 'jwk' });
    if (!jwk.x || !jwk.y)
        throw new Error('KMS_PUBLIC_KEY_INVALID');
    const uncompressed = Buffer.concat([
        Buffer.from([4]),
        bytesFromBase64Url(jwk.x),
        bytesFromBase64Url(jwk.y),
    ]);
    return publicKeyToAddress(`0x${uncompressed.toString('hex')}`);
}
function readDerLength(bytes, offset) {
    const first = bytes[offset];
    if (first === undefined)
        throw new Error('KMS_SIGNATURE_INVALID');
    if ((first & 0x80) === 0)
        return { length: first, next: offset + 1 };
    const count = first & 0x7f;
    if (count < 1 || count > 4)
        throw new Error('KMS_SIGNATURE_INVALID');
    let length = 0;
    for (let index = 0; index < count; index += 1) {
        const value = bytes[offset + 1 + index];
        if (value === undefined)
            throw new Error('KMS_SIGNATURE_INVALID');
        length = length * 256 + value;
    }
    return { length, next: offset + 1 + count };
}
function readDerInteger(bytes, offset) {
    if (bytes[offset] !== 0x02)
        throw new Error('KMS_SIGNATURE_INVALID');
    const size = readDerLength(bytes, offset + 1);
    const end = size.next + size.length;
    if (end > bytes.length || size.length === 0) {
        throw new Error('KMS_SIGNATURE_INVALID');
    }
    return {
        next: end,
        value: BigInt(`0x${Buffer.from(bytes.slice(size.next, end)).toString('hex')}`),
    };
}
export function parseDerSignature(signature) {
    if (signature[0] !== 0x30)
        throw new Error('KMS_SIGNATURE_INVALID');
    const sequence = readDerLength(signature, 1);
    if (sequence.next + sequence.length !== signature.length) {
        throw new Error('KMS_SIGNATURE_INVALID');
    }
    const r = readDerInteger(signature, sequence.next);
    const s = readDerInteger(signature, r.next);
    if (s.next !== signature.length || r.value === 0n || s.value === 0n) {
        throw new Error('KMS_SIGNATURE_INVALID');
    }
    return { r: r.value, s: s.value };
}
function hex32(value) {
    return `0x${value.toString(16).padStart(64, '0')}`;
}
export class AwsControllerKms {
    aliasPrefix;
    client;
    constructor(options) {
        this.aliasPrefix = options.aliasPrefix.replace(/\/$/, '');
        const config = { region: options.region };
        if (options.endpoint)
            config.endpoint = options.endpoint;
        this.client = options.client ?? new KMSClient(config);
    }
    async provision(customerUserId) {
        const alias = `${this.aliasPrefix}/${customerUserId}`;
        let keyId = await this.findAlias(alias);
        if (!keyId) {
            const created = await this.client.send(new CreateKeyCommand({
                Description: `EmuKey Customer Controller ${customerUserId}`,
                KeySpec: 'ECC_SECG_P256K1',
                KeyUsage: 'SIGN_VERIFY',
                Tags: [{ TagKey: 'emukey-customer-id', TagValue: customerUserId }],
            }));
            keyId = String(created.KeyMetadata?.KeyId ?? '');
            if (!keyId)
                throw new Error('KMS_CREATE_KEY_FAILED');
            try {
                await this.client.send(new CreateAliasCommand({ AliasName: alias, TargetKeyId: keyId }));
            }
            catch (error) {
                const concurrentKeyId = await this.findAlias(alias);
                if (!concurrentKeyId)
                    throw error;
                keyId = concurrentKeyId;
            }
        }
        const response = await this.client.send(new GetPublicKeyCommand({ KeyId: keyId }));
        const publicKey = response.PublicKey;
        if (!publicKey)
            throw new Error('KMS_PUBLIC_KEY_UNAVAILABLE');
        return {
            keyReference: keyId,
            keyVersion: 1,
            publicAddress: publicAddress(publicKey),
        };
    }
    async signAuthorization(keyReference, input) {
        const digest = controllerAuthorizationDigest(input);
        const [signed, publicKeyResponse] = await Promise.all([
            this.client.send(new SignCommand({
                KeyId: keyReference,
                Message: Buffer.from(digest.slice(2), 'hex'),
                MessageType: 'DIGEST',
                SigningAlgorithm: 'ECDSA_SHA_256',
            })),
            this.client.send(new GetPublicKeyCommand({ KeyId: keyReference })),
        ]);
        const signature = signed.Signature;
        const publicKey = publicKeyResponse.PublicKey;
        if (!signature || !publicKey)
            throw new Error('KMS_SIGNING_FAILED');
        const parsed = parseDerSignature(signature);
        const s = parsed.s > SECP256K1_ORDER / 2n ? SECP256K1_ORDER - parsed.s : parsed.s;
        const expectedAddress = publicAddress(publicKey).toLowerCase();
        for (const yParity of [0, 1]) {
            const candidate = serializeSignature({
                r: hex32(parsed.r),
                s: hex32(s),
                yParity,
            });
            if ((await recoverAddress({ hash: digest, signature: candidate })).toLowerCase() === expectedAddress) {
                return candidate;
            }
        }
        throw new Error('KMS_SIGNATURE_RECOVERY_FAILED');
    }
    async findAlias(alias) {
        let marker;
        do {
            const response = await this.client.send(new ListAliasesCommand({ Limit: 100, Marker: marker }));
            const match = response.Aliases?.find((entry) => entry.AliasName === alias);
            if (match?.TargetKeyId)
                return match.TargetKeyId;
            marker = response.Truncated ? String(response.NextMarker) : undefined;
        } while (marker);
        return null;
    }
}
//# sourceMappingURL=aws-controller-kms.js.map