var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../../identity-access/security.guards.js';
import { NotificationRepository } from '../infrastructure/notification.repository.js';
let OperationsHealthController = class OperationsHealthController {
    notifications;
    constructor(notifications) {
        this.notifications = notifications;
    }
    assistance() {
        return this.notifications.healthSummary();
    }
};
__decorate([
    Get('assistance'),
    ApiOkResponse(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OperationsHealthController.prototype, "assistance", null);
OperationsHealthController = __decorate([
    ApiTags('operations'),
    Controller('operations/health'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('SYSTEM_ADMIN', 'SUPPORT_STAFF'),
    ApiBearerAuth(),
    __metadata("design:paramtypes", [NotificationRepository])
], OperationsHealthController);
export { OperationsHealthController };
//# sourceMappingURL=operations-health.controller.js.map