import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class RetrieveActivationKeyDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() deliveryId!: string;
}
export class AcknowledgeActivationKeyDto extends RetrieveActivationKeyDto {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) keyVersion!: number;
}

export class LicensePlanDto {
  @ApiProperty() commitment!: string;
  @ApiProperty() name!: string;
  @ApiProperty() version!: number;
}

export class LicenseProviderDto {
  @ApiProperty() displayName!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) organizationName!:
    string | null;
}

export class LicenseProjectionDto {
  @ApiPropertyOptional({enum:['LEGACY_DEVICE','PROVIDER_HANDOFF']}) fulfillmentMode?:string;
  @ApiPropertyOptional({nullable:true,type:String}) providerDeliveryStatus?:string|null;
  @ApiPropertyOptional({nullable:true,type:String}) providerAcceptedAt?:string|null;
  @ApiPropertyOptional() providerRevision?:number;
  @ApiPropertyOptional({nullable:true,type:Number}) providerAcceptedRevision?:number|null;
  @ApiPropertyOptional() keyAvailable?:boolean;
  @ApiPropertyOptional()
  activationKeyAvailable?: boolean;
  @ApiPropertyOptional({ nullable: true, type: String, pattern: '^[0-9a-f]{4}$' })
  activationKeyLast4?: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) blockNumber!:
    number | null;
  @ApiProperty() confirmationCount!: number;
  @ApiProperty() activeDeviceCount!: number;
  @ApiProperty() deviceStateVersion!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() entitlementVersion!: number;
  @ApiProperty() expiresAt!: string;
  @ApiProperty() finality!: string;
  @ApiProperty() id!: string;
  @ApiProperty() keyVersion!: number;
  @ApiProperty({ enum: ['PENDING_FINALITY', 'TRUSTED', 'UNTRUSTED_REORG'] }) activationKeyTrustStatus!: string;
  @ApiProperty() maxActiveDevices!: number;
  @ApiProperty({ format: 'uuid' }) originOrderId!: string;
  @ApiProperty() periodStart!: string;
  @ApiProperty({ type: LicensePlanDto }) plan!: LicensePlanDto;
  @ApiProperty() productName!: string;
  @ApiProperty({ type: LicenseProviderDto }) provider!: LicenseProviderDto;
  @ApiProperty() publicLicenseId!: string;
  @ApiProperty({
    enum: ['PENDING_ONCHAIN', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED'],
  })
  status!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) transactionHash!:
    string | null;
  @ApiProperty() updatedAt!: string;
}

export class ActivationKeyDto {
  @ApiProperty({ format: 'uuid' }) deliveryId!: string;
  @ApiProperty({ format: 'date-time' }) retryUntil!: string;
  @ApiProperty() activationKey!: string;
  @ApiProperty() keyVersion!: number;
}

export class LicenseDeviceDto {
  @ApiPropertyOptional({ nullable: true, type: String }) displayName?: string | null;
  @ApiPropertyOptional() platform?: string;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() deviceRef!: string;
  @ApiProperty({ enum: ['ACTIVE', 'REVOKED'] }) status!: string;
  @ApiProperty() bindingGeneration!: number;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) activatedAt!: string | null;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) revokedAt!: string | null;
}

export class PublicLicenseHistoryChangeDto {
  @ApiProperty() field!: string;
  @ApiProperty() label!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) previousValue?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) currentValue?:
    string | null;
}

export class PublicLicenseHistoryEventDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: [
      'LICENSE_ISSUED',
      'LICENSE_RENEWED',
      'LICENSE_SUSPENDED',
      'LICENSE_RESUMED',
      'LICENSE_REVOKED',
      'KEY_ROTATED',
      'DEVICE_ACTIVATED',
      'DEVICE_REVOKED',
      'ACTIVE_DEVICE_COUNT_SYNCED',
    ],
  })
  eventType!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: ['CONFIRMED', 'PENDING', 'REORGED'] })
  status!: string;
  @ApiProperty() occurredAt!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) blockTimestamp?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) observedAt?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) finalizedAt?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) transactionHash?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) blockNumber?:
    number | null;
  @ApiPropertyOptional({ nullable: true, type: String }) blockHash?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) logIndex?:
    number | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) transactionIndex?:
    number | null;
  @ApiPropertyOptional() confirmationCount?: number;
  @ApiPropertyOptional({ nullable: true, type: String }) commandId?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) commandSequence?:
    number | null;
  @ApiPropertyOptional({ nullable: true, type: String }) network?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) chainId?:
    number | null;
  @ApiPropertyOptional({ nullable: true, type: String }) contractAddress?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) explorerTxUrl?:
    string | null;
  @ApiPropertyOptional({ type: [PublicLicenseHistoryChangeDto] })
  changes?: PublicLicenseHistoryChangeDto[];
}

export class PublicLicenseVerificationDto {
  @ApiPropertyOptional({ enum: ['LEGACY_DEVICE', 'PROVIDER_HANDOFF'] }) fulfillmentMode?: string;
  @ApiPropertyOptional() providerDeliveryStatus?: string;
  @ApiPropertyOptional({ nullable: true, type: Number }) blockNumber?:
    number | null;
  @ApiPropertyOptional() confirmationCount?: number;
  @ApiPropertyOptional() periodStart?: string;
  @ApiPropertyOptional() expiresAt?: string;
  @ApiPropertyOptional() maxActiveDevices?: number;
  @ApiPropertyOptional() activeDeviceCount?: number;
  @ApiPropertyOptional() keyVersion?: number;
  @ApiPropertyOptional({
    enum: [
      'PUBLIC_ID',
      'CURRENT_KEY',
      'HISTORICAL_ROTATED_KEY',
      'PENDING_ROTATED_KEY',
    ],
  })
  matchedBy?: string;
  @ApiPropertyOptional({ nullable: true, type: Number }) matchedKeyVersion?:
    number | null;
  @ApiPropertyOptional() finality?: string;
  @ApiPropertyOptional() licenseId?: string;
  @ApiPropertyOptional({ type: LicensePlanDto }) plan?: LicensePlanDto;
  @ApiPropertyOptional() productName?: string;
  @ApiPropertyOptional({ type: LicenseProviderDto })
  provider?: LicenseProviderDto;
  @ApiPropertyOptional({ nullable: true, type: String }) network?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) chainId?:
    number | null;
  @ApiPropertyOptional({ nullable: true, type: String }) contractAddress?:
    string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) explorerUrl?:
    string | null;
  @ApiPropertyOptional({
    enum: ['ONCHAIN_VERIFIED', 'INDEXED_ONCHAIN_LOGS', 'UNVERIFIED_PENDING'],
  })
  historySource?: string;
  @ApiPropertyOptional() historyComplete?: boolean;
  @ApiPropertyOptional({ nullable: true, type: String }) historyNote?:
    string | null;
  @ApiPropertyOptional({
    enum: ['VERIFIED', 'INDEXED_FALLBACK', 'UNAVAILABLE'],
  })
  rpcStatus?: string;
  @ApiPropertyOptional({ type: [PublicLicenseHistoryEventDto] })
  history?: PublicLicenseHistoryEventDto[];
  @ApiProperty({
    enum: [
      'CHAIN_CONFIRMED',
      'PENDING_ONCHAIN',
      'PROJECTION_STALE',
      'REORGED',
      'NOT_FOUND',
    ],
  })
  state!: string;
  @ApiPropertyOptional() status?: string;
  @ApiPropertyOptional({ nullable: true, type: String }) transactionHash?:
    string | null;
}
