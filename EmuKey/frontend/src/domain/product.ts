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
