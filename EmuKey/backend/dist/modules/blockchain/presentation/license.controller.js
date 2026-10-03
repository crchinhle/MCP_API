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
import { Controller, Get, Ip, Param, ParseUUIDPipe, Post, UseGuards, } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags, } from '@nestjs/swagger';
import { CurrentUser, Roles, } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard, } from '../../identity-access/security.guards.js';
import { LicenseQueryService } from '../application/license-query.service.js';
import { ActivationKeyDto, LicenseProjectionDto, LicenseDeviceDto, PublicLicenseVerificationDto, } from './license.dto.js';
let LicenseController = class LicenseController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(actor) {
        return this.service.list(actor);
    }
    find(actor, id) {
        return this.service.find(actor, id);
    }
    listDevices(actor, id) {
        return this.service.listDevices(actor, id);
    }
    retrieve(actor, id) {
        return this.service.retrieveActivation(actor, id);
    }
};
__decorate([
    Get(),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER', 'PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOkResponse({ type: LicenseProjectionDto, isArray: true }),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LicenseController.prototype, "list", null);
__decorate([
    Get(':id'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER', 'PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOkResponse({ type: LicenseProjectionDto }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LicenseController.prototype, "find", null);
__decorate([
    Get(':id/devices'),
    UseGuards(AuthGuard, RolesGuard),
    ApiBearerAuth(),
    Roles('CUSTOMER'),
    ApiOkResponse({ type: LicenseDeviceDto, isArray: true }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LicenseController.prototype, "listDevices", null);
__decorate([
    Post(':id/activation-key/retrieve'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Retrieve a confirmed activation key exactly once' }),
    ApiCreatedResponse({ type: ActivationKeyDto }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LicenseController.prototype, "retrieve", null);
LicenseController = __decorate([
    ApiTags('licenses'),
    Controller('licenses'),
    __metadata("design:paramtypes", [LicenseQueryService])
], LicenseController);
export { LicenseController };
let PublicLicenseController = class PublicLicenseController {
    service;
    constructor(service) {
        this.service = service;
    }
    verify(publicId, requester) {
        return this.service.verify(publicId, requester);
    }
};
__decorate([
    Get(':publicId/verify'),
    ApiOperation({ summary: 'Verify an allowlisted public license projection' }),
    ApiOkResponse({ type: PublicLicenseVerificationDto }),
    __param(0, Param('publicId')),
    __param(1, Ip()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PublicLicenseController.prototype, "verify", null);
PublicLicenseController = __decorate([
    ApiTags('public'),
    Controller('public/licenses'),
    __metadata("design:paramtypes", [LicenseQueryService])
], PublicLicenseController);
export { PublicLicenseController };
//# sourceMappingURL=license.controller.js.map