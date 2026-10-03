import canonicalize from 'canonicalize';
import { encodeAbiParameters, getAddress, keccak256, parseAbiParameters, stringToHex, } from 'viem';
export const DOMAIN_PLAN_V2 = keccak256(stringToHex('LICENSE_PLAN_COMMITMENT_V2'));
function assertCanonicalJson(value, seen = new Set()) {
    if (value === null ||
        typeof value === 'boolean' ||
        typeof value === 'string') {
        return;
    }
    if (typeof value === 'number') {
        if (Number.isFinite(value))
            return;
        throw new Error('Unsupported entitlement value');
    }
    if (typeof value !== 'object') {
        throw new Error('Unsupported entitlement value');
    }
    if (seen.has(value))
        throw new Error('Unsupported entitlement value');
    seen.add(value);
    if (Array.isArray(value)) {
        for (const entry of value)
            assertCanonicalJson(entry, seen);
    }
    else {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            throw new Error('Unsupported entitlement value');
        }
        for (const entry of Object.values(value)) {
            assertCanonicalJson(entry, seen);
        }
    }
    seen.delete(value);
}
export function canonicalizeEntitlements(value) {
    assertCanonicalJson(value);
    const result = canonicalize(value);
    if (result === undefined)
        throw new Error('Unsupported entitlement value');
    return result;
}
export function entitlementsHash(value) {
    return keccak256(stringToHex(canonicalizeEntitlements(value)));
}
export function uuidToBytes16(value) {
    // Encode the canonical PostgreSQL UUID value, not a UUID generation policy.
    // Seeded/imported IDs and UUIDv7 must retain all 128 bits unchanged.
    // https://www.postgresql.org/docs/current/datatype-uuid.html
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error('Invalid UUID');
    }
    return `0x${value.replaceAll('-', '').toLowerCase()}`;
}
function positiveUint(value, name) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive safe integer`);
    }
    return BigInt(value);
}
export function planCommitment(input) {
    return keccak256(encodeAbiParameters(parseAbiParameters('bytes32, address, bytes16, bytes16, uint256, uint256, uint256, bytes32'), [
        DOMAIN_PLAN_V2,
        getAddress(input.providerChainAddress),
        uuidToBytes16(input.productId),
        uuidToBytes16(input.planId),
        positiveUint(input.planVersion, 'planVersion'),
        positiveUint(input.durationMonths, 'durationMonths'),
        positiveUint(input.maxActiveDevices, 'maxActiveDevices'),
        entitlementsHash(input.entitlements),
    ]));
}
export function activationCommitment(secret32) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(secret32)) {
        throw new Error('Activation secret must contain exactly 32 bytes');
    }
    return keccak256(secret32);
}
//# sourceMappingURL=license-crypto.js.map