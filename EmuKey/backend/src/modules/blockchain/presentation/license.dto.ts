import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiPropertyOptional()
  activationKeyAvailable?: boolean;
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
  @ApiProperty() activationKey!: string;
  @ApiProperty() keyVersion!: number;
}

export class LicenseDeviceDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() deviceRef!: string;
  @ApiProperty({ enum: ['ACTIVE', 'REVOKED'] }) status!: string;
  @ApiProperty() bindingGeneration!: number;
  @ApiPropertyOptional({ nullable: true }) activatedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) revokedAt!: string | null;
}

export class PublicLicenseVerificationDto {
  @ApiPropertyOptional({ nullable: true, type: Number }) blockNumber?:
    number | null;
  @ApiPropertyOptional() confirmationCount?: number;
  @ApiPropertyOptional() expiresAt?: string;
  @ApiPropertyOptional() finality?: string;
  @ApiPropertyOptional() licenseId?: string;
  @ApiPropertyOptional({ type: LicensePlanDto }) plan?: LicensePlanDto;
  @ApiPropertyOptional() productName?: string;
  @ApiPropertyOptional({ type: LicenseProviderDto })
  provider?: LicenseProviderDto;
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
