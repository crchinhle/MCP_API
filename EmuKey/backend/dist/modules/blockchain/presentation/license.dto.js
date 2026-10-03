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
export class LicensePlanDto {
    commitment;
    name;
    version;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], LicensePlanDto.prototype, "commitment", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], LicensePlanDto.prototype, "name", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], LicensePlanDto.prototype, "version", void 0);
export class LicenseProviderDto {
    displayName;
    organizationName;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], LicenseProviderDto.prototype, "displayName", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], LicenseProviderDto.prototype, "organizationName", void 0);
export class LicenseProjectionDto {
    activationKeyAvailable;
    blockNumber;
    confirmationCount;
    activeDeviceCount;
    deviceStateVersion;
    createdAt;
    entitlementVersion;
    expiresAt;
    finality;
    id;
    keyVersion;
    activationKeyTrustStatus;
    maxActiveDevices;
    originOrderId;
    periodStart;
    plan;
    productName;
    provider;
    publicLicenseId;
    status;
    transactionHash;
    updatedAt;
}
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", Boolean)
], LicenseProjectionDto.prototype, "activationKeyAvailable", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], LicenseProjectionDto.prototype, "blockNumber", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], LicenseProjectionDto.prototype, "confirmationCount", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], LicenseProjectionDto.prototype, "activeDeviceCount", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], LicenseProjectionDto.prototype, "deviceStateVersion", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], LicenseProjectionDto.prototype, "createdAt", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], LicenseProjectionDto.prototype, "entitlementVersion", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], LicenseProjectionDto.prototype, "expiresAt", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], LicenseProjectionDto.prototype, "finality", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], LicenseProjectionDto.prototype, "id", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], LicenseProjectionDto.prototype, "keyVersion", void 0);
__decorate([
    ApiProperty({ enum: ['PENDING_FINALITY', 'TRUSTED', 'UNTRUSTED_REORG'] }),
    __metadata("design:type", String)
], LicenseProjectionDto.prototype, "activationKeyTrustStatus", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], LicenseProjectionDto.prototype, "maxActiveDevices", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], LicenseProjectionDto.prototype, "originOrderId", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], LicenseProjectionDto.prototype, "periodStart", void 0);
__decorate([
    ApiProperty({ type: LicensePlanDto }),
    __metadata("design:type", LicensePlanDto)
], LicenseProjectionDto.prototype, "plan", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], LicenseProjectionDto.prototype, "productName", void 0);
__decorate([
    ApiProperty({ type: LicenseProviderDto }),
    __metadata("design:type", LicenseProviderDto)
], LicenseProjectionDto.prototype, "provider", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], LicenseProjectionDto.prototype, "publicLicenseId", void 0);
__decorate([
    ApiProperty({
        enum: ['PENDING_ONCHAIN', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED'],
    }),
    __metadata("design:type", String)
], LicenseProjectionDto.prototype, "status", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], LicenseProjectionDto.prototype, "transactionHash", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], LicenseProjectionDto.prototype, "updatedAt", void 0);
export class ActivationKeyDto {
    activationKey;
    keyVersion;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], ActivationKeyDto.prototype, "activationKey", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], ActivationKeyDto.prototype, "keyVersion", void 0);
export class LicenseDeviceDto {
    id;
    deviceRef;
    status;
    bindingGeneration;
    activatedAt;
    revokedAt;
}
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], LicenseDeviceDto.prototype, "id", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], LicenseDeviceDto.prototype, "deviceRef", void 0);
__decorate([
    ApiProperty({ enum: ['ACTIVE', 'REVOKED'] }),
    __metadata("design:type", String)
], LicenseDeviceDto.prototype, "status", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], LicenseDeviceDto.prototype, "bindingGeneration", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true }),
    __metadata("design:type", Object)
], LicenseDeviceDto.prototype, "activatedAt", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true }),
    __metadata("design:type", Object)
], LicenseDeviceDto.prototype, "revokedAt", void 0);
export class PublicLicenseVerificationDto {
    blockNumber;
    confirmationCount;
    expiresAt;
    finality;
    licenseId;
    plan;
    productName;
    provider;
    state;
    status;
    transactionHash;
}
__decorate([
    ApiPropertyOptional({ nullable: true, type: Number }),
    __metadata("design:type", Object)
], PublicLicenseVerificationDto.prototype, "blockNumber", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", Number)
], PublicLicenseVerificationDto.prototype, "confirmationCount", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", String)
], PublicLicenseVerificationDto.prototype, "expiresAt", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", String)
], PublicLicenseVerificationDto.prototype, "finality", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", String)
], PublicLicenseVerificationDto.prototype, "licenseId", void 0);
__decorate([
    ApiPropertyOptional({ type: LicensePlanDto }),
    __metadata("design:type", LicensePlanDto)
], PublicLicenseVerificationDto.prototype, "plan", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", String)
], PublicLicenseVerificationDto.prototype, "productName", void 0);
__decorate([
    ApiPropertyOptional({ type: LicenseProviderDto }),
    __metadata("design:type", LicenseProviderDto)
], PublicLicenseVerificationDto.prototype, "provider", void 0);
__decorate([
    ApiProperty({
        enum: [
            'CHAIN_CONFIRMED',
            'PENDING_ONCHAIN',
            'PROJECTION_STALE',
            'REORGED',
            'NOT_FOUND',
        ],
    }),
    __metadata("design:type", String)
], PublicLicenseVerificationDto.prototype, "state", void 0);
__decorate([
    ApiPropertyOptional(),
    __metadata("design:type", String)
], PublicLicenseVerificationDto.prototype, "status", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true, type: String }),
    __metadata("design:type", Object)
], PublicLicenseVerificationDto.prototype, "transactionHash", void 0);
//# sourceMappingURL=license.dto.js.map