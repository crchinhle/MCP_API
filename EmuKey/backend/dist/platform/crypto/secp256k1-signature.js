import { createPublicKey } from 'node:crypto';
import { recoverAddress, serializeSignature, } from 'viem';
import { publicKeyToAddress } from 'viem/accounts';
const SECP256K1_ORDER = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
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
export function publicAddressFromPem(publicKeyPem) {
    const key = createPublicKey(publicKeyPem);
    const jwk = key.export({ format: 'jwk' });
    if (!jwk.x || !jwk.y)
        throw new Error('KMS_PUBLIC_KEY_INVALID');
    const uncompressed = Buffer.concat([
        Buffer.from([4]),
        Buffer.from(jwk.x, 'base64url'),
        Buffer.from(jwk.y, 'base64url'),
    ]);
    return publicKeyToAddress(`0x${uncompressed.toString('hex')}`);
}
export async function recoverableSignature(digest, derSignature, expectedAddress) {
    const parsed = parseDerSignature(derSignature);
    const s = parsed.s > SECP256K1_ORDER / 2n ? SECP256K1_ORDER - parsed.s : parsed.s;
    for (const yParity of [0, 1]) {
        const candidate = serializeSignature({
            r: hex32(parsed.r),
            s: hex32(s),
            yParity,
        });
        if ((await recoverAddress({ hash: digest, signature: candidate })).toLowerCase() === expectedAddress.toLowerCase()) {
            return candidate;
        }
    }
    throw new Error('KMS_SIGNATURE_RECOVERY_FAILED');
}
//# sourceMappingURL=secp256k1-signature.js.map