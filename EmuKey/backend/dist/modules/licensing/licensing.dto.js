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
import { IsIn, IsOptional, IsString, IsUUID, ValidateIf, Matches, MaxLength, MinLength, } from 'class-validator';
export class ActivateDeviceDto {
    /** Deprecated client hint retained for one compatibility window; authorization always resolves from activationKey. */
    licenseId;
    activationKey;
    challenge;
    deviceRef;
    devicePublicKey;
    proof;
}
__decorate([
    ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$', description: 'Bearer activation credential supplied by the enterprise administrator' }),
    IsString(),
    Matches(/^0x[0-9a-fA-F]{64}$/),
    __metadata("design:type", String)
], ActivateDeviceDto.prototype, "activationKey", void 0);
__decorate([
    ApiProperty(),
    IsString(),
    MinLength(16),
    MaxLength(128),
    __metadata("design:type", String)
], ActivateDeviceDto.prototype, "challenge", void 0);
__decorate([
    ApiProperty({ minLength: 1, maxLength: 128 }),
    IsString(),
    MinLength(1),
    MaxLength(128),
    __metadata("design:type", String)
], ActivateDeviceDto.prototype, "deviceRef", void 0);
__decorate([
    ApiProperty({ description: 'EVM address corresponding to the device signing key' }),
    IsString(),
    Matches(/^0x[0-9a-fA-F]{40}$/),
    __metadata("design:type", String)
], ActivateDeviceDto.prototype, "devicePublicKey", void 0);
__decorate([
    ApiProperty({ description: 'EIP-191 signature over the activation challenge' }),
    IsString(),
    Matches(/^0x[0-9a-fA-F]{130}$/),
    __metadata("design:type", String)
], ActivateDeviceDto.prototype, "proof", void 0);
export class RevokeDeviceDto {
    actionToken;
    activationKey;
    challenge;
    proof;
}
__decorate([
    ApiProperty({ minLength: 32 }),
    IsString(),
    MinLength(32),
    __metadata("design:type", String)
], RevokeDeviceDto.prototype, "actionToken", void 0);
__decorate([
    ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$' }),
    IsString(),
    Matches(/^0x[0-9a-fA-F]{64}$/),
    __metadata("design:type", String)
], RevokeDeviceDto.prototype, "activationKey", void 0);
__decorate([
    ApiProperty(),
    IsString(),
    MinLength(16),
    MaxLength(128),
    __metadata("design:type", String)
], RevokeDeviceDto.prototype, "challenge", void 0);
__decorate([
    ApiProperty({ description: 'EIP-191 signature over the revoke challenge' }),
    IsString(),
    Matches(/^0x[0-9a-fA-F]{130}$/),
    __metadata("design:type", String)
], RevokeDeviceDto.prototype, "proof", void 0);
export class RemoteRevokeDeviceDto {
    actionToken;
    currentPassword;
}
__decorate([
    ApiProperty({ minLength: 32 }),
    IsString(),
    MinLength(32),
    __metadata("design:type", String)
], RemoteRevokeDeviceDto.prototype, "actionToken", void 0);
__decorate([
    ApiProperty({ minLength: 1 }),
    IsString(),
    MinLength(1),
    __metadata("design:type", String)
], RemoteRevokeDeviceDto.prototype, "currentPassword", void 0);
export class ActivationKeyRecoveryDto {
    actionToken;
    currentPassword;
}
__decorate([
    ApiProperty({ minLength: 32 }),
    IsString(),
    MinLength(32),
    __metadata("design:type", String)
], ActivationKeyRecoveryDto.prototype, "actionToken", void 0);
__decorate([
    ApiProperty({ minLength: 1 }),
    IsString(),
    MinLength(1),
    __metadata("design:type", String)
], ActivationKeyRecoveryDto.prototype, "currentPassword", void 0);
export class RotateActivationKeyDto {
    actionToken;
    currentKey;
}
__decorate([
    ApiProperty({ minLength: 32 }),
    IsString(),
    MinLength(32),
    __metadata("design:type", String)
], RotateActivationKeyDto.prototype, "actionToken", void 0);
__decorate([
    ApiProperty({ pattern: '^0x[0-9a-fA-F]{64}$' }),
    IsString(),
    Matches(/^0x[0-9a-fA-F]{64}$/),
    __metadata("design:type", String)
], RotateActivationKeyDto.prototype, "currentKey", void 0);
export class ResolveLicensingActionDto {
    actionToken;
}
__decorate([
    ApiProperty({ minLength: 20 }),
    IsString(),
    MinLength(20),
    __metadata("design:type", String)
], ResolveLicensingActionDto.prototype, "actionToken", void 0);
export class LicensingActionResolutionDto {
    action;
    licenseId;
    deviceId;
    expiresAt;
}
__decorate([
    ApiProperty({ enum: ['ROTATE_KEY', 'REVOKE_DEVICE', 'REMOTE_REVOKE_DEVICE', 'KEY_RECOVERY'] }),
    __metadata("design:type", String)
], LicensingActionResolutionDto.prototype, "action", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], LicensingActionResolutionDto.prototype, "licenseId", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid', nullable: true, type: String }),
    __metadata("design:type", Object)
], LicensingActionResolutionDto.prototype, "deviceId", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], LicensingActionResolutionDto.prototype, "expiresAt", void 0);
export class LicensingActionVerificationDto {
    action;
    licenseId;
    deviceId;
}
__decorate([
    ApiProperty({ enum: ['ROTATE_KEY', 'REVOKE_DEVICE', 'REMOTE_REVOKE_DEVICE', 'KEY_RECOVERY'] }),
    IsIn(['ROTATE_KEY', 'REVOKE_DEVICE', 'REMOTE_REVOKE_DEVICE', 'KEY_RECOVERY']),
    __metadata("design:type", String)
], LicensingActionVerificationDto.prototype, "action", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    IsUUID(),
    __metadata("design:type", String)
], LicensingActionVerificationDto.prototype, "licenseId", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid', description: 'Required for device-scoped revoke actions' }),
    ValidateIf((value) => value.action === 'REVOKE_DEVICE' || value.action === 'REMOTE_REVOKE_DEVICE'),
    IsUUID(),
    __metadata("design:type", String)
], LicensingActionVerificationDto.prototype, "deviceId", void 0);
export class ActivationChallengeDto {
    licenseId;
    activationKey;
    purpose;
    deviceRef;
    deviceId;
}
__decorate([
    ApiPropertyOptional({ format: 'uuid', description: 'License id for device-bound entitlement or revoke challenges; not required for activation.' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], ActivationChallengeDto.prototype, "licenseId", void 0);
__decorate([
    ApiPropertyOptional({ pattern: '^0x[0-9a-fA-F]{64}$', description: 'Required for activation challenges; used to resolve the license without customer ownership.' }),
    IsOptional(),
    IsString(),
    Matches(/^0x[0-9a-fA-F]{64}$/),
    __metadata("design:type", String)
], ActivationChallengeDto.prototype, "activationKey", void 0);
__decorate([
    ApiProperty({ enum: ['ACTIVATE_DEVICE', 'SELF_REVOKE_DEVICE', 'ISSUE_ENTITLEMENT', 'REFRESH_ENTITLEMENT'] }),
    IsIn(['ACTIVATE_DEVICE', 'SELF_REVOKE_DEVICE', 'ISSUE_ENTITLEMENT', 'REFRESH_ENTITLEMENT']),
    __metadata("design:type", String)
], ActivationChallengeDto.prototype, "purpose", void 0);
__decorate([
    ApiProperty({ minLength: 1, maxLength: 128 }),
    IsString(),
    MinLength(1),
    MaxLength(128),
    __metadata("design:type", String)
], ActivationChallengeDto.prototype, "deviceRef", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid', description: 'Set when requesting a challenge to revoke an existing device' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], ActivationChallengeDto.prototype, "deviceId", void 0);
export class LicenseLifecycleDto {
    command;
    reason;
}
__decorate([
    ApiProperty({ enum: ['SUSPEND_LICENSE', 'RESUME_LICENSE', 'REVOKE_LICENSE'] }),
    IsIn(['SUSPEND_LICENSE', 'RESUME_LICENSE', 'REVOKE_LICENSE']),
    __metadata("design:type", String)
], LicenseLifecycleDto.prototype, "command", void 0);
__decorate([
    ApiPropertyOptional(),
    IsOptional(),
    IsString(),
    MaxLength(500),
    __metadata("design:type", String)
], LicenseLifecycleDto.prototype, "reason", void 0);
export class EntitlementDto {
    token;
    expiresAt;
    licenseId;
    deviceId;
    entitlementVersion;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], EntitlementDto.prototype, "token", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], EntitlementDto.prototype, "expiresAt", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], EntitlementDto.prototype, "licenseId", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], EntitlementDto.prototype, "deviceId", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], EntitlementDto.prototype, "entitlementVersion", void 0);
export class EntitlementVerifyDto {
    token;
}
__decorate([
    ApiProperty({ description: 'Signed entitlement JWT returned by issue or refresh' }),
    IsString(),
    MinLength(32),
    __metadata("design:type", String)
], EntitlementVerifyDto.prototype, "token", void 0);
export class EntitlementValidationDto {
    bindingGeneration;
    valid;
    expiresAt;
    licenseId;
    deviceId;
    entitlementVersion;
    keyVersion;
    rights;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], EntitlementValidationDto.prototype, "bindingGeneration", void 0);
__decorate([
    ApiProperty({ enum: [true] }),
    __metadata("design:type", Boolean)
], EntitlementValidationDto.prototype, "valid", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], EntitlementValidationDto.prototype, "expiresAt", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], EntitlementValidationDto.prototype, "licenseId", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], EntitlementValidationDto.prototype, "deviceId", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], EntitlementValidationDto.prototype, "entitlementVersion", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], EntitlementValidationDto.prototype, "keyVersion", void 0);
__decorate([
    ApiProperty({ additionalProperties: true, type: 'object' }),
    __metadata("design:type", Object)
], EntitlementValidationDto.prototype, "rights", void 0);
export class EntitlementRefreshDto {
    licenseId;
    deviceId;
    challenge;
    proof;
}
__decorate([
    ApiProperty({ format: 'uuid' }),
    IsUUID(),
    __metadata("design:type", String)
], EntitlementRefreshDto.prototype, "licenseId", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    IsUUID(),
    __metadata("design:type", String)
], EntitlementRefreshDto.prototype, "deviceId", void 0);
__decorate([
    ApiProperty({ minLength: 16 }),
    IsString(),
    MinLength(16),
    __metadata("design:type", String)
], EntitlementRefreshDto.prototype, "challenge", void 0);
__decorate([
    ApiProperty({ description: 'EIP-191 device signature over the entitlement challenge' }),
    IsString(),
    Matches(/^0x[0-9a-fA-F]{130}$/),
    __metadata("design:type", String)
], EntitlementRefreshDto.prototype, "proof", void 0);
export class DeviceChallengeDto {
    licenseId;
    challenge;
    expiresAt;
    bindingGeneration;
    keyVersion;
    purpose;
}
__decorate([
    ApiProperty({ format: 'uuid', description: 'Resolved license id; returned only after the activation credential has been accepted.' }),
    __metadata("design:type", String)
], DeviceChallengeDto.prototype, "licenseId", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], DeviceChallengeDto.prototype, "challenge", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], DeviceChallengeDto.prototype, "expiresAt", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], DeviceChallengeDto.prototype, "bindingGeneration", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], DeviceChallengeDto.prototype, "keyVersion", void 0);
__decorate([
    ApiProperty({ enum: ['ACTIVATE_DEVICE', 'SELF_REVOKE_DEVICE', 'ISSUE_ENTITLEMENT', 'REFRESH_ENTITLEMENT'] }),
    __metadata("design:type", String)
], DeviceChallengeDto.prototype, "purpose", void 0);
export class Phase6CommandDto {
    commandId;
    status;
    licenseId;
    deviceId;
}
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], Phase6CommandDto.prototype, "commandId", void 0);
__decorate([
    ApiProperty({ enum: ['PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN', 'CONFIRMED', 'RETRYABLE_FAILED', 'DEAD_LETTER', 'ABANDONED', 'SUPERSEDED'] }),
    __metadata("design:type", String)
], Phase6CommandDto.prototype, "status", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], Phase6CommandDto.prototype, "licenseId", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid', nullable: true, type: String }),
    __metadata("design:type", Object)
], Phase6CommandDto.prototype, "deviceId", void 0);
export class Phase6CommandStatusDto extends Phase6CommandDto {
    commandType;
    confirmedAt;
    transactionHash;
}
__decorate([
    ApiProperty({ enum: ['ISSUE_LICENSE', 'RENEW_LICENSE', 'SUSPEND_LICENSE', 'RESUME_LICENSE', 'REVOKE_LICENSE', 'ROTATE_KEY', 'SYNC_DEVICE_COUNT'] }),
    __metadata("design:type", String)
], Phase6CommandStatusDto.prototype, "commandType", void 0);
__decorate([
    ApiPropertyOptional({ format: 'date-time', nullable: true, type: String }),
    __metadata("design:type", Object)
], Phase6CommandStatusDto.prototype, "confirmedAt", void 0);
__decorate([
    ApiPropertyOptional({ pattern: '^0x[0-9a-fA-F]{64}$', nullable: true, type: String }),
    __metadata("design:type", Object)
], Phase6CommandStatusDto.prototype, "transactionHash", void 0);
//# sourceMappingURL=licensing.dto.js.map