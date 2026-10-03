import { Pool } from 'pg';
import { type Hex } from 'viem';
import { AuditWriter } from '../../../platform/audit/audit-writer.js';
import { NotificationRepository } from '../../operations/infrastructure/notification.repository.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { VerifiedPaymentEvent } from '../application/ports/payment-gateway.port.js';
export interface OrderRecord {
    billingCycleSnapshot: string;
    createdAt: Date;
    currency: string;
    customerUserId: string;
    durationMonthsSnapshot: number;
    entitlementsSnapshot: Record<string, unknown>;
    id: string;
    licenseId: string | null;
    maxActiveDevicesSnapshot: number;
    orderNumber: string;
    orderStatus: string;
    orderType: 'NEW_PURCHASE' | 'RENEWAL';
    paymentDueAt: Date;
    planCommitmentSnapshot: Hex;
    planId: string;
    planNameSnapshot: string;
    planVersionSnapshot: number;
    priceVndSnapshot: number;
    productId: string;
    productNameSnapshot: string;
    providerNameSnapshot: string;
    providerUserId: string;
    publicLicenseId: string | null;
    targetLicenseId: string | null;
    serviceTermsAcceptedAt: Date | null;
    serviceTermsContentSnapshot: string | null;
    serviceTermsHashSnapshot: string | null;
    serviceTermsVersionSnapshot: string | null;
    renewalStatus?: string | null;
    renewalExpiresAt?: Date | null;
}
export interface ServiceTermsSnapshot {
    content: string;
    hash: string;
    version: string;
}
export interface CheckoutPreparation {
    amountVnd: number;
    attemptId: string;
    checkoutReference: string;
    existing: boolean;
    expiresAt: Date;
    orderId: string;
}
export interface PaymentHistoryRecord {
    amountVnd: number;
    classification: string;
    orderId: string | null;
    orderNumber: string | null;
    orderType: OrderRecord['orderType'] | null;
    planNameSnapshot: string | null;
    productNameSnapshot: string | null;
    providerEventId: string;
    providerTransactionReference: string | null;
    receivedAt: Date;
    reviewStatus: string | null;
    transactionId: string;
}
export interface PaymentReceiptRecord {
    amountVnd: number;
    currency: string;
    orderId: string;
    orderNumber: string;
    orderType: OrderRecord['orderType'];
    paidAt: Date;
    providerOccurredAt: Date;
    receivedAt: Date;
    timingBasis: string;
    planNameSnapshot: string;
    productNameSnapshot: string;
    providerNameSnapshot: string;
    providerTransactionReference: string | null;
    transactionId: string;
}
export interface PaymentReviewRecord {
    amountVnd: number;
    classification: string;
    id: string;
    orderId: string | null;
    orderNumber: string | null;
    providerEventId: string;
    providerTransactionReference: string | null;
    providerOccurredAt: Date;
    receivedAt: Date;
    reviewedAt: Date | null;
    reviewReason: string | null;
    reviewStatus: string | null;
}
export interface ChainConfiguration {
    chainId: number;
    contractAddress: string;
    network: string;
}
export interface IssuanceMaterial {
    activationCommitment: Hex;
    commandId: string;
    licenseId: string;
    payload: Record<string, unknown>;
    payloadHash: Hex;
}
export interface PaymentIngestResult {
    activationRequired?: boolean;
    classification: 'AMOUNT_MISMATCH' | 'DUPLICATE' | 'MATCHED' | 'UNMATCHED';
    commandId?: string;
    licenseId?: string;
    transactionId: string;
}
export declare class CommerceRepository {
    private readonly pool;
    private readonly audit;
    private readonly ipnDeliveryGraceSeconds;
    private readonly notifications;
    constructor(pool: Pool, audit?: AuditWriter, ipnDeliveryGraceSeconds?: number, notifications?: NotificationRepository);
    createOrder(customerUserId: string, idempotencyKey: string, planId: string, targetLicenseId: string | undefined, terms: ServiceTermsSnapshot): Promise<OrderRecord>;
    findPendingRenewal(customerUserId: string, licenseId: string): Promise<OrderRecord | null>;
    findRenewalOffer(customerUserId: string, licenseId: string): Promise<{
        expiresAt: Date;
        status: string;
        planId: string;
        planName: string;
        productName: string;
        priceVnd: number;
        durationMonths: number;
        planPublished: boolean;
        productPublished: boolean;
    } | null>;
    cancelOverdueOrders(customerUserId?: string): Promise<number>;
    findOrder(customerUserId: string, id: string): Promise<OrderRecord | null>;
    listCustomerOrders(customerUserId: string): Promise<OrderRecord[]>;
    acceptServiceTerms(customerUserId: string, id: string, terms: {
        hash: string;
        version: string;
    }): Promise<OrderRecord>;
    cancelOrder(customerUserId: string, id: string): Promise<OrderRecord>;
    prepareCheckout(customerUserId: string, id: string): Promise<CheckoutPreparation>;
    failCheckout(attemptId: string): Promise<void>;
    findSandboxPaymentEvidence(id: string): Promise<{
        event: VerifiedPaymentEvent;
        payload: unknown;
    } | null>;
    ingestPayment(event: VerifiedPaymentEvent, rawPayload: unknown, issuance: IssuanceMaterial, chain: ChainConfiguration, reconciliation?: {
        transactionId: string;
        actor: AuthPrincipal;
        reason: string;
    }): Promise<PaymentIngestResult>;
    listPaymentHistory(actor: AuthPrincipal): Promise<PaymentHistoryRecord[]>;
    getPaymentReceipt(actor: AuthPrincipal, transactionId: string): Promise<PaymentReceiptRecord | null>;
    listPaymentReview(includeClosed?: boolean): Promise<PaymentReviewRecord[]>;
    reviewPayment(actor: AuthPrincipal, id: string, status: 'CLOSED_NO_ACTION' | 'RESOLVED', reason: string): Promise<PaymentReviewRecord>;
    private withTransaction;
}
