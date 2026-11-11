export const PURCHASE_MONTHS = [1, 2, 3, 6, 12] as const;

export interface PurchaseSelection {
  deviceQuantity?: number | undefined;
  durationMonths?: number | undefined;
}

export interface PurchaseSnapshot {
  buyerName: string;
  buyerEmail: string;
  basePriceVnd: number;
  baseDeviceQuantity: number;
  baseDurationMonths: number;
  requestedDeviceQuantity: number | null;
  requestedDurationMonths: number | null;
}

/** Integer arithmetic rounds only the final VND total, never the unit rate. */
export function calculatePurchase(
  base: { priceVnd: number; deviceQuantity: number; durationMonths: number },
  selection: PurchaseSelection,
) {
  const deviceQuantity = selection.deviceQuantity ?? base.deviceQuantity;
  const durationMonths = selection.durationMonths ?? base.durationMonths;
  if (!Number.isInteger(deviceQuantity) || deviceQuantity < 1 || deviceQuantity > 2147483647 ||
      !PURCHASE_MONTHS.some((months) => months === durationMonths)) {
    throw new Error('INVALID_PURCHASE_CONFIGURATION');
  }
  if (![base.priceVnd, base.deviceQuantity, base.durationMonths].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new Error('PURCHASE_PRICE_OUT_OF_RANGE');
  }
  const numerator = BigInt(base.priceVnd) * BigInt(deviceQuantity) * BigInt(durationMonths);
  const denominator = BigInt(base.deviceQuantity) * BigInt(base.durationMonths);
  const total = (numerator + denominator - 1n) / denominator;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('PURCHASE_PRICE_OUT_OF_RANGE');
  return { deviceQuantity, durationMonths, priceVnd: Number(total) };
}
