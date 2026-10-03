export declare const BILLING_CYCLES: readonly ["MONTHLY", "YEARLY"];
export type BillingCycle = (typeof BILLING_CYCLES)[number];
export declare class CreateProductDto {
    code: string;
    name: string;
    description?: string;
    imageUrl?: string;
}
export declare class UpdateProductDto {
    name?: string;
    description?: string;
    imageUrl?: string;
}
export declare class CreatePlanDto {
    productId: string;
    code: string;
    name: string;
    billingCycle: BillingCycle;
    durationMonths: number;
    priceVnd: number;
    maxActiveDevices: number;
    entitlements?: Record<string, unknown>;
}
export declare class UpdatePlanDto {
    name?: string;
    billingCycle?: BillingCycle;
    durationMonths?: number;
    priceVnd?: number;
    maxActiveDevices?: number;
    entitlements?: Record<string, unknown>;
}
export declare class AdminProductDto {
    code: string;
    createdAt: string;
    description: string | null;
    id: string;
    imageUrl: string | null;
    name: string;
    publishedAt: string | null;
    status: 'ARCHIVED' | 'DRAFT' | 'PUBLISHED';
    updatedAt: string;
}
export declare class AdminPlanDto {
    billingCycle: BillingCycle;
    code: string;
    createdAt: string;
    durationMonths: number;
    entitlements: Record<string, unknown>;
    id: string;
    maxActiveDevices: number;
    name: string;
    planCommitment: string;
    priceVnd: number;
    productId: string;
    publishedAt: string | null;
    status: 'ARCHIVED' | 'DRAFT' | 'PUBLISHED';
    updatedAt: string;
    version: number;
}
export declare class PublicCatalogPlanDto {
    billingCycle: BillingCycle;
    code: string;
    durationMonths: number;
    entitlements: Record<string, unknown>;
    id: string;
    maxActiveDevices: number;
    name: string;
    priceVnd: number;
}
export declare class PublicCatalogProductDto {
    imageUrl: string | null;
    name: string;
    plans: PublicCatalogPlanDto[];
    publishedAt: string | null;
    slug: string;
    summary: string;
}
export declare class PlanComparisonDimensionDto {
    key: string;
    label: string;
    values: Record<string, unknown>;
}
export declare class ComparedPlanDto {
    billingCycle: BillingCycle;
    id: string;
    name: string;
    productId: string;
    productName: string;
    version: number;
}
export declare class ComparePlansResponseDto {
    dimensions: PlanComparisonDimensionDto[];
    plans: ComparedPlanDto[];
}
export declare class CatalogDeleteResultDto {
    deleted: boolean;
}
