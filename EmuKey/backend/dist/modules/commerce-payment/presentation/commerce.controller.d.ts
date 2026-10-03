import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { CommerceService } from '../application/commerce.service.js';
import { AcceptServiceTermsDto, CreateOrderDto, ReviewPaymentDto } from './commerce.dto.js';
export declare class CommerceController {
    private readonly service;
    constructor(service: CommerceService);
    create(actor: AuthPrincipal, idempotencyKey: string | undefined, dto: CreateOrderDto): Promise<import("../infrastructure/commerce.repository.js").OrderRecord>;
    list(actor: AuthPrincipal): Promise<import("../infrastructure/commerce.repository.js").OrderRecord[]>;
    renewalPreview(actor: AuthPrincipal, licenseId: string): Promise<{
        licenseId: string;
        planId: string;
        planName: string;
        productName: string;
        currentExpiresAt: Date;
        durationMonths: number;
        priceVnd: number;
        estimatedExpiresAt: Date;
        canRenew: boolean;
        pendingOrder: import("../infrastructure/commerce.repository.js").OrderRecord | null;
    }>;
    find(actor: AuthPrincipal, id: string): Promise<import("../infrastructure/commerce.repository.js").OrderRecord>;
    serviceTerms(actor: AuthPrincipal, id: string): Promise<{
        content: string;
        hash: string;
        version: string;
    }>;
    acceptServiceTerms(actor: AuthPrincipal, id: string, dto: AcceptServiceTermsDto): Promise<import("../infrastructure/commerce.repository.js").OrderRecord>;
    checkout(actor: AuthPrincipal, id: string): Promise<{
        amountVnd: number;
        attemptId: string;
        expiresAt: string;
        expiresWithOrder: boolean;
        checkoutFields: Record<string, string>;
        checkoutMethod: "POST";
        checkoutReference: string;
        checkoutUrl: string;
    }>;
    cancel(actor: AuthPrincipal, id: string): Promise<import("../infrastructure/commerce.repository.js").OrderRecord>;
}
export declare class PaymentController {
    private readonly service;
    constructor(service: CommerceService);
    ingest(payload: unknown, signature?: string): Promise<import("../infrastructure/commerce.repository.js").PaymentIngestResult>;
    history(actor: AuthPrincipal): Promise<import("../infrastructure/commerce.repository.js").PaymentHistoryRecord[]>;
    reviewQueue(actor: AuthPrincipal): Promise<import("../infrastructure/commerce.repository.js").PaymentReviewRecord[]>;
    review(actor: AuthPrincipal, id: string, dto: ReviewPaymentDto): Promise<import("../infrastructure/commerce.repository.js").PaymentReviewRecord>;
    getReceipt(actor: AuthPrincipal, id: string): Promise<import("../infrastructure/commerce.repository.js").PaymentReceiptRecord>;
}
