import { calculatePurchase } from '../../../../EmuKey/backend/src/modules/commerce-payment/domain/purchase-pricing.js';

describe('custom purchase pricing', () => {
  const base = { priceVnd: 1490000, deviceQuantity: 3, durationMonths: 12 };
  it('retains the published price when no customization is requested', () => {
    expect(calculatePurchase(base, {})).toEqual(base);
  });
  it('prorates both dimensions and rounds up once to a whole dong', () => {
    expect(calculatePurchase(base, { deviceQuantity: 2, durationMonths: 2 })).toEqual({ priceVnd: 165556, deviceQuantity: 2, durationMonths: 2 });
  });
  it('keeps integer precision for intermediate multiplication', () => {
    expect(calculatePurchase({ priceVnd: 9007199254740991, deviceQuantity: 3, durationMonths: 12 }, { deviceQuantity: 3, durationMonths: 12 }).priceVnd).toBe(9007199254740991);
  });
  it('rejects unsafe totals and invalid quantities or terms', () => {
    expect(() => calculatePurchase(base, { deviceQuantity: 2147483647, durationMonths: 12 })).not.toThrow();
    expect(() => calculatePurchase({ ...base, priceVnd: Number.MAX_SAFE_INTEGER }, { deviceQuantity: 100, durationMonths: 12 })).toThrow('PURCHASE_PRICE_OUT_OF_RANGE');
    for (const deviceQuantity of [0, -1, 0.5, NaN, 2147483648]) expect(() => calculatePurchase(base, { deviceQuantity })).toThrow();
    for (const durationMonths of [0, 4, 24, NaN]) expect(() => calculatePurchase(base, { durationMonths })).toThrow();
  });
});
