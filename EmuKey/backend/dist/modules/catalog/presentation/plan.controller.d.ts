import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { CatalogAdminService } from '../application/catalog-admin.service.js';
import { CreatePlanDto, UpdatePlanDto } from './catalog.dto.js';
import { ComparePlansQuery } from '../application/compare-plans.query.js';
export declare class PlanController {
    private readonly service;
    private readonly comparePlans;
    constructor(service: CatalogAdminService, comparePlans: ComparePlansQuery);
    compare(ids: string | string[]): Promise<{
        dimensions: {
            key: string;
            label: string;
            values: {
                [k: string]: unknown;
            };
        }[];
        plans: {
            billingCycle: unknown;
            id: string;
            name: string;
            productId: string;
            productName: string;
            version: number;
        }[];
    }>;
    list(actor: AuthPrincipal, productId?: string): Promise<{
        billingCycle: "MONTHLY" | "YEARLY";
        code: string;
        createdAt: Date;
        durationMonths: number;
        entitlements: Record<string, unknown>;
        id: string;
        maxActiveDevices: number;
        name: string;
        planCommitment: `0x${string}`;
        priceVnd: number;
        productId: string;
        publishedAt: Date | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
        version: number;
    }[]>;
    find(actor: AuthPrincipal, id: string): Promise<{
        billingCycle: "MONTHLY" | "YEARLY";
        code: string;
        createdAt: Date;
        durationMonths: number;
        entitlements: Record<string, unknown>;
        id: string;
        maxActiveDevices: number;
        name: string;
        planCommitment: `0x${string}`;
        priceVnd: number;
        productId: string;
        publishedAt: Date | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
        version: number;
    }>;
    create(actor: AuthPrincipal, dto: CreatePlanDto): Promise<{
        billingCycle: "MONTHLY" | "YEARLY";
        code: string;
        createdAt: Date;
        durationMonths: number;
        entitlements: Record<string, unknown>;
        id: string;
        maxActiveDevices: number;
        name: string;
        planCommitment: `0x${string}`;
        priceVnd: number;
        productId: string;
        publishedAt: Date | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
        version: number;
    }>;
    update(actor: AuthPrincipal, id: string, dto: UpdatePlanDto): Promise<{
        billingCycle: "MONTHLY" | "YEARLY";
        code: string;
        createdAt: Date;
        durationMonths: number;
        entitlements: Record<string, unknown>;
        id: string;
        maxActiveDevices: number;
        name: string;
        planCommitment: `0x${string}`;
        priceVnd: number;
        productId: string;
        publishedAt: Date | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
        version: number;
    }>;
    delete(actor: AuthPrincipal, id: string): Promise<{
        deleted: boolean;
    }>;
    publish(actor: AuthPrincipal, id: string): Promise<{
        billingCycle: "MONTHLY" | "YEARLY";
        code: string;
        createdAt: Date;
        durationMonths: number;
        entitlements: Record<string, unknown>;
        id: string;
        maxActiveDevices: number;
        name: string;
        planCommitment: `0x${string}`;
        priceVnd: number;
        productId: string;
        publishedAt: Date | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
        version: number;
    }>;
    archive(actor: AuthPrincipal, id: string): Promise<{
        billingCycle: "MONTHLY" | "YEARLY";
        code: string;
        createdAt: Date;
        durationMonths: number;
        entitlements: Record<string, unknown>;
        id: string;
        maxActiveDevices: number;
        name: string;
        planCommitment: `0x${string}`;
        priceVnd: number;
        productId: string;
        publishedAt: Date | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
        version: number;
    }>;
}
