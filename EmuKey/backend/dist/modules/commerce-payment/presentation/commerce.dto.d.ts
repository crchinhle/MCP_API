export declare class CreateOrderDto {
    planId: string;
    targetLicenseId?: string;
}
export declare class AcceptServiceTermsDto {
    accepted: true;
    version: string;
    hash: string;
}
export declare class ReviewPaymentDto {
    status: 'CLOSED_NO_ACTION' | 'RESOLVED';
    reason: string;
}
declare const ORDER_STATUSES: readonly ["WAITING_SERVICE_TERMS_ACCEPTANCE", "WAITING_PAYMENT", "PAYMENT_ACCEPTED", "CANCELLED", "EXPIRED"];
declare const PAYMENT_CLASSIFICATIONS: readonly ["MATCHED", "DUPLICATE", "UNMATCHED", "AMOUNT_MISMATCH", "INVALID"];
export declare class OrderDto {
    renewalStatus?: string | null;
    renewalExpiresAt?: string | null;
    billingCycleSnapshot: string;
    createdAt: string;
    currency: string;
    customerUserId: string;
    durationMonthsSnapshot: number;
    entitlementsSnapshot: Record<string, unknown>;
    id: string;
    licenseId: string | null;
    maxActiveDevicesSnapshot: number;
    orderNumber: string;
    orderStatus: (typeof ORDER_STATUSES)[number];
    orderType: 'NEW_PURCHASE' | 'RENEWAL';
    paymentDueAt: string;
    planCommitmentSnapshot: string;
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
    serviceTermsAcceptedAt: string | null;
    serviceTermsVersionSnapshot: string | null;
    serviceTermsHashSnapshot: string | null;
}
export declare class OrderTermsDto {
    content: string;
    version: string;
    hash: string;
}
export declare class RenewalPreviewDto {
    licenseId: string;
    planId: string;
    planName: string;
    productName: string;
    durationMonths: number;
    priceVnd: number;
    currentExpiresAt: string;
    estimatedExpiresAt: string;
    canRenew: boolean;
    pendingOrder: OrderDto | null;
}
export declare class CheckoutSessionDto {
    amountVnd: number;
    attemptId: string;
    checkoutFields: Record<string, string>;
    checkoutMethod: 'POST';
    checkoutReference: string;
    checkoutUrl: string;
    expiresAt: string;
    expiresWithOrder: boolean;
}
export declare class PaymentIngestResultDto {
    activationRequired?: boolean;
    classification: (typeof PAYMENT_CLASSIFICATIONS)[number];
    commandId?: string;
    licenseId?: string;
    transactionId: string;
}
export declare class PaymentHistoryDto {
    amountVnd: number;
    classification: string;
    orderId: string | null;
    orderNumber: string | null;
    orderType: 'NEW_PURCHASE' | 'RENEWAL' | null;
    planNameSnapshot: string | null;
    productNameSnapshot: string | null;
    providerEventId: string;
    providerTransactionReference: string | null;
    providerOccurredAt: string;
    receivedAt: string;
    reviewStatus: string | null;
    transactionId: string;
}
export declare class PaymentReceiptDto {
    amountVnd: number;
    currency: string;
    orderId: string;
    orderNumber: string;
    orderType: 'NEW_PURCHASE' | 'RENEWAL';
    paidAt: string;
    providerOccurredAt: string;
    receivedAt: string;
    timingBasis: string;
    planNameSnapshot: string;
    productNameSnapshot: string;
    providerNameSnapshot: string;
    providerTransactionReference: string | null;
    transactionId: string;
}
export declare class PaymentReviewDto {
    amountVnd: number;
    classification: string;
    id: string;
    orderId: string | null;
    orderNumber: string | null;
    providerEventId: string;
    providerTransactionReference: string | null;
    reviewReason: string | null;
    reviewStatus: string | null;
    receivedAt: string;
    providerOccurredAt: string;
    reviewedAt?: string | null;
}
export {};
