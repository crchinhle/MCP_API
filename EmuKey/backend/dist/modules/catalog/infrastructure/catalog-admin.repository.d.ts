import { Pool } from 'pg';
import type { Hex } from 'viem';
import { AuditWriter } from '../../../platform/audit/audit-writer.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { BillingCycle } from '../presentation/catalog.dto.js';
export interface ProductRecord {
    code: string;
    createdAt: Date;
    description: string | null;
    imageUrl: string | null;
    id: string;
    name: string;
    providerUserId: string;
    publishedAt: Date | null;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    updatedAt: Date;
}
export interface PlanRecord {
    billingCycle: BillingCycle;
    code: string;
    createdAt: Date;
    durationMonths: number;
    entitlements: Record<string, unknown>;
    id: string;
    maxActiveDevices: number;
    name: string;
    planCommitment: Hex;
    priceVnd: number;
    productId: string;
    providerUserId: string;
    publishedAt: Date | null;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    updatedAt: Date;
    version: number;
}
export interface ProductInput {
    code?: string;
    description?: string | null;
    imageUrl?: string | null;
    name?: string;
}
export interface PlanInput {
    billingCycle?: BillingCycle;
    code?: string;
    durationMonths?: number;
    entitlements?: Record<string, unknown>;
    maxActiveDevices?: number;
    name?: string;
    priceVnd?: number;
    productId?: string;
}
export declare class CatalogAdminRepository {
    private readonly pool;
    private readonly audit;
    constructor(pool: Pool, audit?: AuditWriter);
    listProducts(actor: AuthPrincipal): Promise<ProductRecord[]>;
    findProduct(actor: AuthPrincipal, id: string): Promise<ProductRecord | null>;
    createProduct(actor: AuthPrincipal, input: Required<ProductInput>): Promise<ProductRecord>;
    updateProduct(actor: AuthPrincipal, id: string, input: ProductInput): Promise<ProductRecord>;
    transitionProduct(actor: AuthPrincipal, id: string, status: 'PUBLISHED' | 'ARCHIVED'): Promise<ProductRecord>;
    deleteProduct(actor: AuthPrincipal, id: string): Promise<void>;
    listPlans(actor: AuthPrincipal, productId?: string): Promise<PlanRecord[]>;
    findPlan(actor: AuthPrincipal, id: string): Promise<PlanRecord | null>;
    createPlan(actor: AuthPrincipal, input: Required<PlanInput>): Promise<PlanRecord>;
    updatePlan(actor: AuthPrincipal, id: string, input: PlanInput): Promise<PlanRecord>;
    deletePlan(actor: AuthPrincipal, id: string): Promise<void>;
    transitionPlan(actor: AuthPrincipal, id: string, status: 'PUBLISHED' | 'ARCHIVED'): Promise<PlanRecord>;
    private lockProduct;
    private lockPlan;
    private writeAudit;
    private withTransaction;
}
