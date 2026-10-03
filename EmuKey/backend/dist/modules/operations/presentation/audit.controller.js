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
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../../identity-access/security.guards.js';
import { AuditService } from '../application/audit.service.js';
import { AuditPageDto, AuditQueryDto } from './audit.dto.js';
let AuditController = class AuditController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(actor, query) {
        return this.service.list(actor, query);
    }
};
__decorate([
    Get(),
    ApiOkResponse({ type: AuditPageDto }),
    __param(0, CurrentUser()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, AuditQueryDto]),
    __metadata("design:returntype", void 0)
], AuditController.prototype, "list", null);
AuditController = __decorate([
    ApiTags('operations'),
    Controller('operations/audit-logs'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('SYSTEM_ADMIN'),
    ApiBearerAuth(),
    __metadata("design:paramtypes", [AuditService])
], AuditController);
export { AuditController };
//# sourceMappingURL=audit.controller.js.map