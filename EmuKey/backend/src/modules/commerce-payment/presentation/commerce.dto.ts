import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateOrderDto {
  // Catalog IDs already persisted by the demo seed are PostgreSQL UUIDs,
  // but may not carry RFC version/variant bits. Validate their full syntax;
  // the repository still requires an existing published plan/product.
  @ApiProperty({ pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' })
  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { message: 'planId must be a canonical PostgreSQL UUID' })
  planId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  targetLicenseId?: string;
}

export class AcceptServiceTermsDto {
  @ApiProperty({ enum: [true] })
  @IsIn([true])
  accepted!: true;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  version!: string;

  @ApiProperty({ pattern: '^[0-9a-f]{64}$' })
  @IsString()
  @Matches(/^[0-9a-f]{64}$/i)
  hash!: string;
}

export class ReviewPaymentDto {
  @ApiProperty({ enum: ['RESOLVED', 'CLOSED_NO_ACTION'] })
  @IsIn(['RESOLVED', 'CLOSED_NO_ACTION'])
  status!: 'CLOSED_NO_ACTION' | 'RESOLVED';

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1_000)
  reason!: string;
}

const ORDER_STATUSES = [
  'WAITING_SERVICE_TERMS_ACCEPTANCE',
  'WAITING_PAYMENT',
  'PAYMENT_ACCEPTED',
  'CANCELLED',
  'EXPIRED',
] as const;
const PAYMENT_CLASSIFICATIONS = [
  'MATCHED',
  'DUPLICATE',
  'UNMATCHED',
  'AMOUNT_MISMATCH',
  'INVALID',
] as const;

export class OrderDto {
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Latest RENEW_LICENSE command status for this exact order, not the original issuance.' })
  renewalStatus?: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String, description: 'Target expiry of this renewal; effective only after canonical chain confirmation.' })
  renewalExpiresAt?: string | null;
  @ApiProperty() billingCycleSnapshot!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ format: 'uuid' }) customerUserId!: string;
  @ApiProperty() durationMonthsSnapshot!: number;
  @ApiProperty({ type: Object }) entitlementsSnapshot!: Record<string, unknown>;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  licenseId!: string | null;
  @ApiProperty() maxActiveDevicesSnapshot!: number;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ enum: ORDER_STATUSES }) orderStatus!: (typeof ORDER_STATUSES)[number];
  @ApiProperty({ enum: ['NEW_PURCHASE', 'RENEWAL'] })
  orderType!: 'NEW_PURCHASE' | 'RENEWAL';
  @ApiProperty({ format: 'date-time' }) paymentDueAt!: string;
  @ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$' }) planCommitmentSnapshot!: string;
  @ApiProperty({ format: 'uuid' }) planId!: string;
  @ApiProperty() planNameSnapshot!: string;
  @ApiProperty() planVersionSnapshot!: number;
  @ApiProperty() priceVndSnapshot!: number;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty() productNameSnapshot!: string;
  @ApiProperty() providerNameSnapshot!: string;
  @ApiProperty({ format: 'uuid' }) providerUserId!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  publicLicenseId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  targetLicenseId!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  serviceTermsAcceptedAt!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  serviceTermsVersionSnapshot!: string | null;
  @ApiPropertyOptional({ pattern: '^[0-9a-f]{64}$', nullable: true, type: String })
  serviceTermsHashSnapshot!: string | null;
}

export class OrderTermsDto {
  @ApiProperty() content!: string;
  @ApiProperty() version!: string;
  @ApiProperty({ pattern: '^[0-9a-f]{64}$' }) hash!: string;
}

export class RenewalPreviewDto {
  @ApiProperty({ format: 'uuid' }) licenseId!: string;
  @ApiProperty({ format: 'uuid' }) planId!: string;
  @ApiProperty() planName!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() durationMonths!: number;
  @ApiProperty() priceVnd!: number;
  @ApiProperty({ format: 'date-time' }) currentExpiresAt!: string;
  @ApiProperty({ format: 'date-time', description: 'Estimate only; final expiry uses verified payment time.' }) estimatedExpiresAt!: string;
  @ApiProperty() canRenew!: boolean;
  @ApiProperty({ type: OrderDto, nullable: true }) pendingOrder!: OrderDto | null;
}

export class CheckoutSessionDto {
  @ApiProperty() amountVnd!: number;
  @ApiProperty({ format: 'uuid' }) attemptId!: string;
  @ApiProperty({ additionalProperties: { type: 'string' }, type: 'object' })
  checkoutFields!: Record<string, string>;
  @ApiProperty({ enum: ['POST'] }) checkoutMethod!: 'POST';
  @ApiProperty() checkoutReference!: string;
  @ApiProperty({ format: 'uri' }) checkoutUrl!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty() expiresWithOrder!: boolean;
}

export class PaymentIngestResultDto {
  @ApiPropertyOptional() activationRequired?: boolean;
  @ApiProperty({ enum: PAYMENT_CLASSIFICATIONS })
  classification!: (typeof PAYMENT_CLASSIFICATIONS)[number];
  @ApiPropertyOptional({ format: 'uuid' }) commandId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) licenseId?: string;
  @ApiProperty({ format: 'uuid' }) transactionId!: string;
}

export class PaymentHistoryDto {
  @ApiProperty() amountVnd!: number;
  @ApiProperty({ enum: PAYMENT_CLASSIFICATIONS }) classification!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String }) orderId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) orderNumber!: string | null;
  @ApiPropertyOptional({ enum: ['NEW_PURCHASE', 'RENEWAL'], nullable: true, type: String })
  orderType!: 'NEW_PURCHASE' | 'RENEWAL' | null;
  @ApiPropertyOptional({ nullable: true, type: String }) planNameSnapshot!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) productNameSnapshot!: string | null;
  @ApiProperty() providerEventId!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  providerTransactionReference!: string | null;
  @ApiProperty({ format: 'date-time' }) providerOccurredAt!: string;
  @ApiProperty({ format: 'date-time' }) receivedAt!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) reviewStatus!: string | null;
  @ApiProperty({ format: 'uuid' }) transactionId!: string;
}

export class PaymentReceiptDto {
  @ApiProperty() amountVnd!: number;
  @ApiProperty() currency!: string;
  @ApiProperty({ format: 'uuid' }) orderId!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ enum: ['NEW_PURCHASE', 'RENEWAL'] })
  orderType!: 'NEW_PURCHASE' | 'RENEWAL';
  @ApiProperty({ format: 'date-time' }) paidAt!: string;
  @ApiProperty({ format: 'date-time', description: 'Timestamp reported by the payment provider.' })
  providerOccurredAt!: string;
  @ApiProperty({ format: 'date-time' }) receivedAt!: string;
  @ApiProperty({ enum: ['PROVIDER', 'SANDBOX_RECEIPT'] }) timingBasis!: string;
  @ApiProperty() planNameSnapshot!: string;
  @ApiProperty() productNameSnapshot!: string;
  @ApiProperty() providerNameSnapshot!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  providerTransactionReference!: string | null;
  @ApiProperty({ format: 'uuid' }) transactionId!: string;
}

export class PaymentReviewDto {
  @ApiProperty() amountVnd!: number;
  @ApiProperty({ enum: PAYMENT_CLASSIFICATIONS }) classification!: string;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String }) orderId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) orderNumber!: string | null;
  @ApiProperty() providerEventId!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  providerTransactionReference!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) reviewReason!: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) reviewStatus!: string | null;
  @ApiProperty({ format: 'date-time' }) receivedAt!: string;
  @ApiProperty({ format: 'date-time' }) providerOccurredAt!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  reviewedAt?: string | null;
}
