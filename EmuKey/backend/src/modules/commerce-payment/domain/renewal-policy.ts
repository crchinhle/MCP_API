/** Renewal preserves unused time and never bills for an already elapsed period. */
export function renewalExpiry(currentExpiry: Date, verifiedPaidAt: Date, months: number): Date {
  const result = new Date(Math.max(currentExpiry.getTime(), verifiedPaidAt.getTime()));
  if (!Number.isFinite(result.getTime()) || !Number.isSafeInteger(months) || months <= 0) {
    throw new Error('INVALID_RENEWAL_PERIOD');
  }
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
