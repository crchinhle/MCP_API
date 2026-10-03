import { renewalExpiry } from '../../../../EmuKey/backend/src/modules/commerce-payment/domain/renewal-policy.js';

describe('renewal expiry', () => {
  it.each([
    ['2026-12-15T12:00:00Z', '2026-09-29T09:00:00Z', 1, '2027-01-15T12:00:00.000Z'],
    ['2026-01-15T12:00:00Z', '2026-09-29T09:00:00Z', 1, '2026-10-29T09:00:00.000Z'],
    ['2026-01-01T00:00:00Z', '2026-01-31T09:00:00Z', 1, '2026-02-28T09:00:00.000Z'],
    ['2024-02-29T09:00:00Z', '2024-01-01T00:00:00Z', 12, '2025-02-28T09:00:00.000Z'],
    ['2026-09-29T09:00:00Z', '2026-09-29T09:00:00Z', 1, '2026-10-29T09:00:00.000Z'],
  ])('extends the later of expiry %s and verified payment %s by %i calendar months', (expiry, paidAt, months, expected) => {
    expect(renewalExpiry(new Date(expiry), new Date(paidAt), months).toISOString()).toBe(expected);
  });
});
