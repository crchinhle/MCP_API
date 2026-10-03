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
import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { NotificationDto } from './notification.dto.js';
import { CurrentUser, Roles } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../../identity-access/security.guards.js';
import { NotificationService } from '../application/notification.service.js';
import { Body } from '@nestjs/common';
import { RegisterPushTokenDto } from './push-token.dto.js';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
class NotificationListQueryDto {
    cursor;
    limit = 20;
}
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], NotificationListQueryDto.prototype, "cursor", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    Max(50),
    __metadata("design:type", Object)
], NotificationListQueryDto.prototype, "limit", void 0);
let NotificationController = class NotificationController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(actor, query) {
        return this.service.list(actor, query.cursor, query.limit);
    }
    markRead(actor, notificationId) { return this.service.markRead(actor, notificationId); }
    registerPushToken(actor, dto) { return this.service.registerPushToken(actor, dto.token, dto.provider); }
    unregisterPushToken(actor, dto) { return this.service.unregisterPushToken(actor, dto.token); }
};
__decorate([
    Get(),
    ApiOkResponse({ schema: { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/NotificationDto' } }, nextCursor: { type: 'string', nullable: true } } } }),
    __param(0, CurrentUser()),
    __param(1, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, NotificationListQueryDto]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "list", null);
__decorate([
    Post(':notificationId/read'),
    ApiOkResponse({ type: NotificationDto }),
    __param(0, CurrentUser()),
    __param(1, Param('notificationId', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "markRead", null);
__decorate([
    Post('push-tokens'),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, RegisterPushTokenDto]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "registerPushToken", null);
__decorate([
    Post('push-tokens/remove'),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], NotificationController.prototype, "unregisterPushToken", null);
NotificationController = __decorate([
    ApiTags('notifications'),
    Controller('notifications'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER', 'SUPPORT_STAFF', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN'),
    ApiBearerAuth(),
    __metadata("design:paramtypes", [NotificationService])
], NotificationController);
export { NotificationController };
//# sourceMappingURL=notification.controller.js.map