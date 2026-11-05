import { describe, expect, it } from 'vitest';
import { canReceiveProviderKey, deliveryRetryDelay, validProviderReceipt } from '../../../../EmuKey/backend/src/modules/licensing/domain/provider-delivery-policy.js';

describe('provider key handoff policy', () => {
  const ready = { status: 'ACTIVE', trust: 'TRUSTED', expiresAt: new Date('2030-01-01'), revision: 2, acceptedRevision: 2 };
  it('requires the receiver to accept the current revision, not merely payment or chain confirmation', () => {
    expect(canReceiveProviderKey({ ...ready, acceptedRevision: null }, new Date('2026-01-01'))).toBe(false);
    expect(canReceiveProviderKey({ ...ready, acceptedRevision: 1 }, new Date('2026-01-01'))).toBe(false);
    expect(canReceiveProviderKey(ready, new Date('2026-01-01'))).toBe(true);
  });
  it('refuses expired, suspended and untrusted licenses despite an old receipt', () => {
    expect(canReceiveProviderKey(ready, new Date('2030-01-01'))).toBe(false);
    expect(canReceiveProviderKey({ ...ready, status: 'SUSPENDED' }, new Date())).toBe(false);
    expect(canReceiveProviderKey({ ...ready, trust: 'UNTRUSTED_REORG' }, new Date())).toBe(false);
  });
  it('requires a matching structured receipt rather than any successful HTTP body', () => {
    const receipt = { deliveryId: 'delivery', licenseId: 'license', revision: 2, receiptId: 'receipt', result: 'ACCEPTED' };
    expect(validProviderReceipt(receipt, { deliveryId: 'delivery', licenseId: 'license', revision: 2 })).toBe(true);
    expect(validProviderReceipt({ ...receipt, revision: 1 }, receipt)).toBe(false);
    expect(validProviderReceipt('<html>OK</html>', receipt)).toBe(false);
  });
  it('bounds retry attempts without creating replacement keys', () => {
    expect(deliveryRetryDelay(1, 0.5)).toBe(5_000);
    expect(deliveryRetryDelay(7, 0.5)).toBe(21_600_000);
    expect(deliveryRetryDelay(8, 0.5)).toBeNull();
  });
});
