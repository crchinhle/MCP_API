import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ActivateDeviceDto {
  /** Deprecated client hint retained for one compatibility window; authorization always resolves from activationKey. */
  @ApiPropertyOptional({ format: 'uuid', deprecated: true })
  @IsOptional()
  @IsUUID()
  licenseId?: string;
  @ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$', description: 'Bearer activation credential supplied by the enterprise administrator' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  activationKey!: `0x${string}`;

  @ApiProperty({ minLength: 16, maxLength: 512 })
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  challenge!: string;

  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  deviceRef!: string;

  @ApiProperty({ description: 'EVM address corresponding to the device signing key' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{40}$/)
  devicePublicKey!: `0x${string}`;

  @ApiProperty({ description: 'EIP-191 signature over the activation challenge' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/)
  proof!: `0x${string}`;
}

export class RevokeDeviceDto {
  @ApiProperty({ minLength: 32 })
  @IsString()
  @MinLength(32)
  actionToken!: string;

  @ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  activationKey!: `0x${string}`;

  @ApiProperty()
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  challenge!: string;

  @ApiProperty({ description: 'EIP-191 signature over the revoke challenge' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/)
  proof!: `0x${string}`;
}

export class RemoteRevokeDeviceDto {
  @ApiProperty({ minLength: 32 })
  @IsString()
  @MinLength(32)
  actionToken!: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}

export class ActivationKeyRecoveryDto {
  @ApiProperty({ minLength: 32 })
  @IsString()
  @MinLength(32)
  actionToken!: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  currentPassword!: string;
}

export class RotateActivationKeyDto {
  @ApiProperty({ minLength: 32 })
  @IsString()
  @MinLength(32)
  actionToken!: string;

  @ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  currentKey!: `0x${string}`;
}

export class ResolveLicensingActionDto {
  @ApiProperty({ minLength: 20 })
  @IsString()
  @MinLength(20)
  actionToken!: string;
}

export class LicensingActionResolutionDto {
  @ApiProperty({ enum: ['ROTATE_KEY', 'REVOKE_DEVICE', 'REMOTE_REVOKE_DEVICE', 'KEY_RECOVERY'] })
  action!: string;
  @ApiProperty({ format: 'uuid' })
  licenseId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  deviceId!: string | null;
  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

export class LicensingActionVerificationDto {
  @ApiProperty({ enum: ['ROTATE_KEY', 'REVOKE_DEVICE', 'REMOTE_REVOKE_DEVICE', 'KEY_RECOVERY'] })
  @IsIn(['ROTATE_KEY', 'REVOKE_DEVICE', 'REMOTE_REVOKE_DEVICE', 'KEY_RECOVERY'])
  action!: 'ROTATE_KEY' | 'REVOKE_DEVICE' | 'REMOTE_REVOKE_DEVICE' | 'KEY_RECOVERY';

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  licenseId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Required for device-scoped revoke actions' })
  @ValidateIf((value: LicensingActionVerificationDto) => value.action === 'REVOKE_DEVICE' || value.action === 'REMOTE_REVOKE_DEVICE')
  @IsUUID()
  deviceId?: string;
}

export class ActivationChallengeDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'License id for device-bound entitlement or revoke challenges; not required for activation.' })
  @IsOptional()
  @IsUUID()
  licenseId?: string;

  @ApiPropertyOptional({ pattern: '^0x[0-9a-fA-F]{64}$', description: 'Required for activation challenges; used to resolve the license without customer ownership.' })
  @IsOptional()
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/)
  activationKey?: `0x${string}`;

  @ApiProperty({ enum: ['ACTIVATE_DEVICE', 'SELF_REVOKE_DEVICE', 'ISSUE_ENTITLEMENT', 'REFRESH_ENTITLEMENT'] })
  @IsIn(['ACTIVATE_DEVICE', 'SELF_REVOKE_DEVICE', 'ISSUE_ENTITLEMENT', 'REFRESH_ENTITLEMENT'])
  purpose!: 'ACTIVATE_DEVICE' | 'SELF_REVOKE_DEVICE' | 'ISSUE_ENTITLEMENT' | 'REFRESH_ENTITLEMENT';

  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  deviceRef!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Set when requesting a challenge to revoke an existing device' })
  @IsOptional()
  @IsUUID()
  deviceId?: string;
}

export class LicenseLifecycleDto {
  @ApiProperty({ enum: ['SUSPEND_LICENSE', 'RESUME_LICENSE', 'REVOKE_LICENSE'] })
  @IsIn(['SUSPEND_LICENSE', 'RESUME_LICENSE', 'REVOKE_LICENSE'])
  command!: 'SUSPEND_LICENSE' | 'RESUME_LICENSE' | 'REVOKE_LICENSE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class EntitlementDto {
  @ApiProperty()
  token!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'uuid' })
  licenseId!: string;

  @ApiProperty({ format: 'uuid' })
  deviceId!: string;

  @ApiProperty()
  entitlementVersion!: number;
}

export class EntitlementVerifyDto {
  @ApiProperty({ description: 'Signed entitlement JWT returned by issue or refresh' })
  @IsString()
  @MinLength(32)
  token!: string;
}

export class EntitlementValidationDto {
  @ApiProperty()
  bindingGeneration!: number;

  @ApiProperty({ enum: [true] })
  valid!: true;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'uuid' })
  licenseId!: string;

  @ApiProperty({ format: 'uuid' })
  deviceId!: string;

  @ApiProperty()
  entitlementVersion!: number;

  @ApiProperty()
  keyVersion!: number;

  @ApiProperty({ additionalProperties: true, type: 'object' })
  rights!: Record<string, unknown>;
}

export class EntitlementRefreshDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  licenseId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  deviceId!: string;

  @ApiProperty({ minLength: 16 })
  @IsString()
  @MinLength(16)
  challenge!: string;

  @ApiProperty({ description: 'EIP-191 device signature over the entitlement challenge' })
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/)
  proof!: `0x${string}`;
}

export class DeviceChallengeDto {
  @ApiProperty({ format: 'uuid', description: 'Resolved license id; returned only after the activation credential has been accepted.' })
  licenseId!: string;

  @ApiProperty()
  challenge!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty()
  bindingGeneration!: number;

  @ApiProperty()
  keyVersion!: number;

  @ApiProperty({ enum: ['ACTIVATE_DEVICE', 'SELF_REVOKE_DEVICE', 'ISSUE_ENTITLEMENT', 'REFRESH_ENTITLEMENT'] })
  purpose!: string;
}

export class Phase6CommandDto {
  @ApiProperty({ format: 'uuid' })
  commandId!: string;

  @ApiProperty({ enum: ['PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN', 'CONFIRMED', 'RETRYABLE_FAILED', 'DEAD_LETTER', 'ABANDONED', 'SUPERSEDED'] })
  status!: string;

  @ApiProperty({ format: 'uuid' })
  licenseId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  deviceId!: string | null;
}

export class Phase6CommandStatusDto extends Phase6CommandDto {
  @ApiProperty({ enum: ['ISSUE_LICENSE', 'RENEW_LICENSE', 'SUSPEND_LICENSE', 'RESUME_LICENSE', 'REVOKE_LICENSE', 'ROTATE_KEY', 'SYNC_DEVICE_COUNT'] })
  commandType!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  confirmedAt!: string | null;

  @ApiPropertyOptional({ pattern: '^0x[0-9a-fA-F]{64}$', nullable: true, type: String })
  transactionHash!: string | null;
}
