var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Body, Controller, Param, ParseUUIDPipe, Post, Get, UseGuards, } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../identity-access/security.decorators.js';
import { AuthGuard, OptionalAuthGuard, RolesGuard } from '../identity-access/security.guards.js';
import { ActivateDeviceDto, ActivationChallengeDto, DeviceChallengeDto, EntitlementDto, EntitlementRefreshDto, EntitlementValidationDto, EntitlementVerifyDto, LicenseLifecycleDto, Phase6CommandDto, Phase6CommandStatusDto, RevokeDeviceDto, RemoteRevokeDeviceDto, ActivationKeyRecoveryDto, RotateActivationKeyDto, LicensingActionVerificationDto, ResolveLicensingActionDto, LicensingActionResolutionDto, } from './licensing.dto.js';
import { LicensingService } from './licensing.service.js';
import { LicenseDeviceDto } from '../blockchain/presentation/license.dto.js';
let LicensingController = class LicensingController {
    service;
    constructor(service) {
        this.service = service;
    }
    challenge(actor, dto) {
        return this.service.challenge(actor ?? null, dto);
    }
    activate(actor, dto) {
        return this.service.activate(actor ?? null, dto);
    }
    requestActionVerification(actor, dto) {
        return this.service.requestActionVerification(actor, dto);
    }
    resolveActionVerification(actor, dto) {
        return this.service.resolveActionVerification(actor, dto.actionToken);
    }
    commandStatus(actor, commandId) {
        return this.service.commandStatus(actor, commandId);
    }
    revokeDevice(actor, licenseId, deviceId, dto) {
        return this.service.revokeDevice(actor, licenseId, deviceId, dto);
    }
    remoteRevokeDevice(actor, licenseId, deviceId, dto) {
        return this.service.remoteRevokeDevice(actor, licenseId, deviceId, dto);
    }
    rotate(actor, licenseId, dto) {
        return this.service.rotate(actor, licenseId, dto);
    }
    recoverActivationKey(actor, licenseId, dto) {
        return this.service.recoverActivationKey(actor, licenseId, dto);
    }
    lifecycle(actor, licenseId, dto) {
        return this.service.lifecycle(actor, licenseId, dto);
    }
    issueEntitlement(actor, dto) {
        return this.service.issueEntitlement(actor ?? null, dto);
    }
    refreshEntitlement(actor, dto) {
        return this.service.refreshEntitlement(actor ?? null, dto);
    }
    verifyEntitlement(actor, dto) {
        return this.service.verifyEntitlement(actor ?? null, dto);
    }
};
__decorate([
    Post('activations/challenge'),
    UseGuards(OptionalAuthGuard),
    ApiOperation({ summary: 'Create a device challenge; activation challenges resolve the license from the bearer activation key and require no purchaser login' }),
    ApiCreatedResponse({ type: DeviceChallengeDto }),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ActivationChallengeDto]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "challenge", null);
__decorate([
    Post('activations'),
    UseGuards(OptionalAuthGuard),
    ApiOperation({ summary: 'Activate a device with a bearer activation key and device proof; no purchaser session is required' }),
    ApiCreatedResponse({ type: LicenseDeviceDto }),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ActivateDeviceDto]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "activate", null);
__decorate([
    Post('licenses/action-verification'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER'),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, LicensingActionVerificationDto]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "requestActionVerification", null);
__decorate([
    Post('licenses/action-verification/resolve'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER'),
    ApiOperation({ summary: 'Resolve the licensing action an email token authorizes without consuming it' }),
    ApiOkResponse({ type: LicensingActionResolutionDto }),
    ApiForbiddenResponse(),
    ApiUnauthorizedResponse(),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ResolveLicensingActionDto]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "resolveActionVerification", null);
__decorate([
    Get('commands/:commandId'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER', 'PROVIDER_ADMIN'),
    ApiOkResponse({ type: Phase6CommandStatusDto }),
    __param(0, CurrentUser()),
    __param(1, Param('commandId', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "commandStatus", null);
__decorate([
    Post('licenses/:licenseId/devices/:deviceId/revoke'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER'),
    ApiCreatedResponse({ type: LicenseDeviceDto }),
    __param(0, CurrentUser()),
    __param(1, Param('licenseId', ParseUUIDPipe)),
    __param(2, Param('deviceId', ParseUUIDPipe)),
    __param(3, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, RevokeDeviceDto]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "revokeDevice", null);
__decorate([
    Post('licenses/:licenseId/devices/:deviceId/remote-revoke'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER'),
    ApiCreatedResponse({ type: LicenseDeviceDto }),
    __param(0, CurrentUser()),
    __param(1, Param('licenseId', ParseUUIDPipe)),
    __param(2, Param('deviceId', ParseUUIDPipe)),
    __param(3, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, RemoteRevokeDeviceDto]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "remoteRevokeDevice", null);
__decorate([
    Post('licenses/:licenseId/activation-key/rotate'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER'),
    ApiCreatedResponse({ type: Phase6CommandDto }),
    __param(0, CurrentUser()),
    __param(1, Param('licenseId', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, RotateActivationKeyDto]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "rotate", null);
__decorate([
    Post('licenses/:licenseId/activation-key/recover'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER'),
    ApiCreatedResponse({ type: Phase6CommandDto }),
    __param(0, CurrentUser()),
    __param(1, Param('licenseId', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ActivationKeyRecoveryDto]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "recoverActivationKey", null);
__decorate([
    Post('licenses/:licenseId/lifecycle'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiCreatedResponse({ type: Phase6CommandDto }),
    __param(0, CurrentUser()),
    __param(1, Param('licenseId', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, LicenseLifecycleDto]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "lifecycle", null);
__decorate([
    Post('entitlements/issue'),
    UseGuards(OptionalAuthGuard),
    ApiCreatedResponse({ type: EntitlementDto }),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, EntitlementRefreshDto]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "issueEntitlement", null);
__decorate([
    Post('entitlements/refresh'),
    UseGuards(OptionalAuthGuard),
    ApiCreatedResponse({ type: EntitlementDto }),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, EntitlementRefreshDto]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "refreshEntitlement", null);
__decorate([
    Post('entitlements/verify'),
    UseGuards(OptionalAuthGuard),
    ApiOkResponse({ type: EntitlementValidationDto }),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, EntitlementVerifyDto]),
    __metadata("design:returntype", void 0)
], LicensingController.prototype, "verifyEntitlement", null);
LicensingController = __decorate([
    ApiTags('licensing'),
    Controller(),
    ApiBearerAuth(),
    __metadata("design:paramtypes", [LicensingService])
], LicensingController);
export { LicensingController };
//# sourceMappingURL=licensing.controller.js.map