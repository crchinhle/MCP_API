import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Address, Hex } from 'viem';

import {
  activationCommitment,
  canonicalizeEntitlements,
  planCommitment,
  uuidToBytes16,
} from '../../../../../EmuKey/backend/src/platform/crypto/license-crypto.js';

describe('license cryptographic protocol V2', () => {
  it.each([
    ['e02c3bd8-b66e-a31b-83bf-ecaf10af8c83', '0xe02c3bd8b66ea31b83bfecaf10af8c83'],
    ['FEEB4F2C-3EA5-9838-0B4A-185D6E3DAB6F', '0xfeeb4f2c3ea598380b4a185d6e3dab6f'],
    ['01900000-0000-7000-8000-000000000001', '0x01900000000070008000000000000001'],
  ])('preserves all 128 bits of database UUID %s', (id, bytes) => {
    expect(uuidToBytes16(id)).toBe(bytes);
  });
  it.each(['not-a-uuid', 'e02c3bd8b66ea31b83bfecaf10af8c83', 'g02c3bd8-b66e-a31b-83bf-ecaf10af8c83', 'e02c3bd8-b66e-a31b-83bf-ecaf10af8c830'])('rejects malformed database UUID %s', (id) => {
    expect(() => uuidToBytes16(id)).toThrow('Invalid UUID');
  });
  const vector = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../../contracts/test-vectors/crypto-v2.json'), 'utf8'),
  ) as {
    entitlements: { hash: Hex; jcs: string; value: Record<string, unknown> };
    plan: { commitment: Hex; durationMonths: number; maxActiveDevices: number; planId: string; planVersion: number; productId: string; providerChainAddress: Address };
    activation: { commitment: Hex; secret: Hex };
  };

  it('uses RFC 8785 JCS ordering and rejects unsupported values', () => {
    expect(canonicalizeEntitlements({ z: 1, a: { y: true, x: 'ok' } })).toBe('{"a":{"x":"ok","y":true},"z":1}');
    expect(() => canonicalizeEntitlements({ invalid: Number.NaN })).toThrow('Unsupported entitlement value');
    expect(() => canonicalizeEntitlements({ invalid: undefined })).toThrow('Unsupported entitlement value');
  });

  it('matches the frozen V2 vector and excludes Service Terms', () => {
    expect(canonicalizeEntitlements(vector.entitlements.value)).toBe(vector.entitlements.jcs);
    const input = { ...vector.plan, entitlements: vector.entitlements.value };
    expect(planCommitment(input)).toBe(vector.plan.commitment);
    expect(planCommitment(input)).toBe(planCommitment({ ...input }));
    expect(planCommitment({ ...input, entitlements: { ...vector.entitlements.value, service: false } })).not.toBe(vector.plan.commitment);
    expect(uuidToBytes16(input.planId)).toHaveLength(34);
    expect(() => uuidToBytes16('not-a-uuid')).toThrow('Invalid UUID');
  });

  it('keeps activation commitment deterministic', () => {
    expect(activationCommitment(vector.activation.secret)).toBe(vector.activation.commitment);
  });
});
