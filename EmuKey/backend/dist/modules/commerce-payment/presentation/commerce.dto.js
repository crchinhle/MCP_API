var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
export class CreateOrderDto {
    // Catalog IDs already persisted by the demo seed are PostgreSQL UUIDs,
    // but may not carry RFC version/variant bits. Validate their full syntax;
    // the repository still requires an existing published plan/product.
    planId;
    targetLicenseId;
}
__decorate([
    ApiProperty({ pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' }),
    IsString(),
    Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { message: 'planId must be a canonical PostgreSQL UUID' }),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "planId", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "targetLicenseId", void 0);
export class AcceptServiceTermsDto {
    accepted;
    version;
    hash;
}
__decorate([
    ApiProperty({ enum: [true] }),
    IsIn([true]),
    __metadata("design:type", Boolean)
], AcceptServiceTermsDto.prototype, "accepted", void 0);
__decorate([
    ApiProperty(),
    IsString(),
    MinLength(1),
    MaxLength(40),
    __metadata("design:type", String)
], AcceptServiceTermsDto.prototype, "version", void 0);
__decorate([
    ApiProperty({ pattern: '^[0-9a-f]{64}$' }),
    IsString(),
    Matches(/^[0-9a-f]{64}$/i),
    __metadata("design:type", String)
], AcceptServiceTermsDto.prototype, "hash", void 0);
export class ReviewPaymentDto {
    status;
    reason;
}
__decorate([
    ApiProperty({ enum: ['RESOLVED', 'CLOSED_NO_ACTION'] }),
    IsIn(['RESOLVED', 'CLOSED_NO_ACTION']),
    __metadata("design:type", String)
], ReviewPaymentDto.prototype, "status", void 0);
__decorate([
    ApiProperty(),
    IsString(),
    MinLength(3),
    MaxLength(1_000),
    __metadata("design:type", String)
], ReviewPaymentDto.prototype, "reason", void 0);
const ORDER_STATUSES = [
    'WAITING_SERVICE_TERMS_ACCEPTANCE',
    'WAITING_PAYMENT',
    'PAYMENT_ACCEPTED',
    'CANCELLED',
    'EXPIRED',
];
const PAYMENT_CLASSIFICATIONS = [
    'MATCHED',
    'DUPLICATE',
    'UNMATCHED',
    'AMOUNT_MISMATCH',
    'INVALID',
];
export class OrderDto {
    renewalStatus;
    renewalExpiresAt;
    billingCycleSnapshot;
    createdAt;
    currency;
    customerUserId;
    durationMonthsSnapshot;
    entitlementsSnapshot;
    id;
    licenseId;
    maxActiveDevicesSnapshot;
    orderNumber;
    orderStatus;
    orderType;
    paymentDueAt;
    planCommitmentSnapshot;
    planId;
    planNameSnapshot;
    planVersionSnapshot;
    priceVndSnapshot;
    productId;
    productNameSnapshot;
    providerNameSnapshot;
    providerUserId;
    publicLicenseId;
    targetLicenseId;
    serviceTermsAcceptedAt;
    serviceTermsVersionSnapshot;
    serviceTermsHashSnapshot;
}
__decorate([
    ApiPropertyOptional({ nullable: true, type: String, description: 'Latest RENEW_LICENSE command status for this exact order, not the original issuance.' }),
    __metadata("design:type", Object)
], OrderDto.prototype, "renewalStatus", void 0);
__decorate([
    ApiPropertyOptional({ format: 'date-time', nullable: true, type: String, description: 'Target expiry of this renewal; effective only after canonical chain confirmation.' }),
    __metadata("design:type", Object)
], OrderDto.prototype, "renewalExpiresAt", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], OrderDto.prototype, "billingCycleSnapshot", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], OrderDto.prototype, "createdAt", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], OrderDto.prototype, "currency", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], OrderDto.prototype, "customerUserId", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], OrderDto.prototype, "durationMonthsSnapshot", void 0);
__decorate([
    ApiProperty({ type: Object }),
    __metadata("design:type", Object)
], OrderDto.prototype, "entitlementsSnapshot", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], OrderDto.prototype, "id", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid', nullable: true, type: String }),
    __metadata("design:type", Object)
], OrderDto.prototype, "licenseId", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], OrderDto.prototype, "maxActiveDevicesSnapshot", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], OrderDto.prototype, "orderNumber", void 0);
__decorate([
    ApiProperty({ enum: ORDER_STATUSES }),
    __metadata("design:type", Object)
], OrderDto.prototype, "orderStatus", void 0);
__decorate([
    ApiProperty({ enum: ['NEW_PURCHASE', 'RENEWAL'] }),
    __metadata("design:type", String)
], OrderDto.prototype, "orderType", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], OrderDto.prototype, "paymentDueAt", void 0);
__decorate([
    ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$' }),
    __metadata("design:type", String)
], OrderDto.prototype, "planCommitmentSnapshot", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], OrderDto.prototype, "planId", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], OrderDto.prototype, "planNameSnapshot", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], OrderDto.prototype, "planVersionSnapshot", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], OrderDto.prototype, "priceVndSnapshot", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], OrderDto.prototype, "productId", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], OrderDto.prototype, "productNameSnapshot", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], OrderDto.prototype, "providerNameSnapshot", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], OrderDto.prototype, "providerUserId", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], OrderDto.prototype, "publicLicenseId", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid', nullable: true, type: String }),
    __metadata("design:type", Object)
], OrderDto.prototype, "targetLicenseId", void 0);
__decorate([
    ApiPropertyOptional({ format: 'date-time', nullable: true, type: String }),
    __metadata("design:type", Object)
], OrderDto.prototype, "serviceTermsAcceptedAt", void 0);
__decorate([
    ApiPropertyOptional({ type: String, nullable: true }),
    __metadata("design:type", Object)
], OrderDto.prototype, "serviceTermsVersionSnapshot", void 0);
__decorate([
    ApiPropertyOptional({ pattern: '^[0-9a-f]{64}$', nullable: true, type: String }),
    __metadata("design:type", Object)
], OrderDto.prototype, "serviceTermsHashSnapshot", void 0);
export class OrderTermsDto {
    content;
    version;
    hash;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], OrderTermsDto.prototype, "content", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], OrderTermsDto.prototype, "version", void 0);
__decorate([
    ApiProperty({ pattern: '^[0-9a-f]{64}$' }),
    __metadata("design:type", String)
], OrderTermsDto.prototype, "hash", void 0);
export class RenewalPreviewDto {
    licenseId;
    planId;
    planName;
    productName;
    durationMonths;
    priceVnd;
    currentExpiresAt;
    estimatedExpiresAt;
    canRenew;
    pendingOrder;
}
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], RenewalPreviewDto.prototype, "licenseId", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], RenewalPreviewDto.prototype, "planId", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], RenewalPreviewDto.prototype, "planName", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], RenewalPreviewDto.prototype, "productName", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], RenewalPreviewDto.prototype, "durationMonths", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], RenewalPreviewDto.prototype, "priceVnd", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], RenewalPreviewDto.prototype, "currentExpiresAt", void 0);
__decorate([
    ApiProperty({ format: 'date-time', description: 'Estimate only; final expiry uses verified payment time.' }),
    __metadata("design:type", String)
], RenewalPreviewDto.prototype, "estimatedExpiresAt", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Boolean)
], RenewalPreviewDto.prototype, "canRenew", void 0);
__decorate([
    ApiProperty({ type: OrderDto, nullable: true }),
    __metadata("design:type", Object)
], RenewalPreviewDto.prototype, "pendingOrder", void 0);
export class CheckoutSessionDto {
    amountVnd;
    attemptId;
    checkoutFields;
    checkoutMethod;
    checkoutReference;
    checkoutUrl;
    expiresAt;
    expiresWithOrder;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], CheckoutSessionDto.prototype, "amountVnd", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], CheckoutSessionDto.prototype, "attemptId", void 0);
__decorate([
    ApiProperty({ additionalProperties: { type: 'string' }, type: 'object' }),
    __metadata("design:type", Object)
], CheckoutSessionDto.prototype, "checkoutFields", void 0);
__decorate([
    ApiProperty({ enum: ['POST'] }),
    __metadata("design:type", String)
], CheckoutSessionDto.prototype, "checkoutMethod", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], CheckoutSessionDto.prototype, "checkoutReference", void 0);
__decorate([
    ApiProperty({ format: 'uri' }),
    __metadata("design:type", String)
], CheckoutSessionDto.prototype, "checkoutUrl", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], CheckoutSessionDto.prototype, "expiresAt", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Boolean)
], CheckoutSessionDto.prototype, "expiresWithOrder", void 0);
export class PaymentIngestResultDto {
    activationRequired;
    classification;
    commandId;
    licenseId;
    transactionId;
}
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", Boolean)
], PaymentIngestResultDto.prototype, "activationRequired", void 0);
__decorate([
    ApiProperty({ enum: PAYMENT_CLASSIFICATIONS }),
    __metadata("design:type", Object)
], PaymentIngestResultDto.prototype, "classification", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentIngestResultDto.prototype, "commandId", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentIngestResultDto.prototype, "licenseId", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentIngestResultDto.prototype, "transactionId", void 0);
export class PaymentHistoryDto {
    amountVnd;
    classification;
    orderId;
    orderNumber;
    orderType;
    planNameSnapshot;
    productNameSnapshot;
    providerEventId;
    providerTransactionReference;
    providerOccurredAt;
    receivedAt;
    reviewStatus;
    transactionId;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], PaymentHistoryDto.prototype, "amountVnd", void 0);
__decorate([
    ApiProperty({ enum: PAYMENT_CLASSIFICATIONS }),
    __metadata("design:type", String)
], PaymentHistoryDto.prototype, "classification", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid', nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentHistoryDto.prototype, "orderId", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentHistoryDto.prototype, "orderNumber", void 0);
__decorate([
    ApiPropertyOptional({ enum: ['NEW_PURCHASE', 'RENEWAL'], nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentHistoryDto.prototype, "orderType", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentHistoryDto.prototype, "planNameSnapshot", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentHistoryDto.prototype, "productNameSnapshot", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PaymentHistoryDto.prototype, "providerEventId", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentHistoryDto.prototype, "providerTransactionReference", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], PaymentHistoryDto.prototype, "providerOccurredAt", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], PaymentHistoryDto.prototype, "receivedAt", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentHistoryDto.prototype, "reviewStatus", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentHistoryDto.prototype, "transactionId", void 0);
export class PaymentReceiptDto {
    amountVnd;
    currency;
    orderId;
    orderNumber;
    orderType;
    paidAt;
    providerOccurredAt;
    receivedAt;
    timingBasis;
    planNameSnapshot;
    productNameSnapshot;
    providerNameSnapshot;
    providerTransactionReference;
    transactionId;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], PaymentReceiptDto.prototype, "amountVnd", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PaymentReceiptDto.prototype, "currency", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentReceiptDto.prototype, "orderId", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PaymentReceiptDto.prototype, "orderNumber", void 0);
__decorate([
    ApiProperty({ enum: ['NEW_PURCHASE', 'RENEWAL'] }),
    __metadata("design:type", String)
], PaymentReceiptDto.prototype, "orderType", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], PaymentReceiptDto.prototype, "paidAt", void 0);
__decorate([
    ApiProperty({ format: 'date-time', description: 'Timestamp reported by the payment provider.' }),
    __metadata("design:type", String)
], PaymentReceiptDto.prototype, "providerOccurredAt", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], PaymentReceiptDto.prototype, "receivedAt", void 0);
__decorate([
    ApiProperty({ enum: ['PROVIDER', 'SANDBOX_RECEIPT'] }),
    __metadata("design:type", String)
], PaymentReceiptDto.prototype, "timingBasis", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PaymentReceiptDto.prototype, "planNameSnapshot", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PaymentReceiptDto.prototype, "productNameSnapshot", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PaymentReceiptDto.prototype, "providerNameSnapshot", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentReceiptDto.prototype, "providerTransactionReference", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentReceiptDto.prototype, "transactionId", void 0);
export class PaymentReviewDto {
    amountVnd;
    classification;
    id;
    orderId;
    orderNumber;
    providerEventId;
    providerTransactionReference;
    reviewReason;
    reviewStatus;
    receivedAt;
    providerOccurredAt;
    reviewedAt;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], PaymentReviewDto.prototype, "amountVnd", void 0);
__decorate([
    ApiProperty({ enum: PAYMENT_CLASSIFICATIONS }),
    __metadata("design:type", String)
], PaymentReviewDto.prototype, "classification", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], PaymentReviewDto.prototype, "id", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid', nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentReviewDto.prototype, "orderId", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentReviewDto.prototype, "orderNumber", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], PaymentReviewDto.prototype, "providerEventId", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentReviewDto.prototype, "providerTransactionReference", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentReviewDto.prototype, "reviewReason", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentReviewDto.prototype, "reviewStatus", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], PaymentReviewDto.prototype, "receivedAt", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], PaymentReviewDto.prototype, "providerOccurredAt", void 0);
__decorate([
    ApiPropertyOptional({ format: 'date-time', nullable: true, type: String }),
    __metadata("design:type", Object)
], PaymentReviewDto.prototype, "reviewedAt", void 0);
//# sourceMappingURL=commerce.dto.js.map