export type ProductTone = 'brand' | 'module' | 'neutral';

export interface DevicePlan {
  readonly id: string;
  readonly devices: number;
  readonly label: string;
  readonly priceVnd: number;
  readonly durationMonths?: number;
  readonly entitlements?: Readonly<Record<string, unknown>>;
}

export interface Product {
  readonly imageUrl: string | null;
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  readonly tone: ProductTone;
  readonly plans: readonly DevicePlan[];
}


/**
 * Selects an exact published offer returned by the backend. A product with one
 * offer can be selected without another user decision; multiple offers require
 * an explicit plan ID so the client never invents a price/quota combination.
 */
export function resolvePurchasableOffer<T extends Pick<DevicePlan, 'id'>>(
  offers: readonly T[],
  requestedPlanId?: string,
): T | undefined {
  if (requestedPlanId) return offers.find((offer) => offer.id === requestedPlanId);
  return offers.length === 1 ? offers[0] : undefined;
}
