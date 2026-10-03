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
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../identity-access/security.guards.js';
import { CreateKnowledgeDocumentDto, KnowledgeDocumentDetailDto, KnowledgeDocumentDto, KnowledgeQueryDto, KnowledgeSourceDto, PublishKnowledgeDocumentDto } from './knowledge.dto.js';
import { KnowledgeService } from './knowledge.service.js';
let KnowledgeController = class KnowledgeController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(actor) { return this.service.list(actor); }
    create(actor, dto, file) { return this.service.create(actor, { ...dto, ...(file ? { file } : {}) }); }
    detail(actor, id) { return this.service.detail(actor, id); }
    publish(actor, id, dto) { return this.service.publish(actor, id, dto.expectedCurrentVersion); }
    query(actor, dto) { return this.service.search(actor, dto.question); }
};
__decorate([
    Get('documents'),
    Roles('PROVIDER_ADMIN', 'SYSTEM_ADMIN'),
    ApiOkResponse({ type: KnowledgeDocumentDto, isArray: true }),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "list", null);
__decorate([
    Post('documents'),
    Roles('PROVIDER_ADMIN', 'SYSTEM_ADMIN'),
    UseInterceptors(FileInterceptor('file')),
    ApiOkResponse({ type: KnowledgeDocumentDto }),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __param(2, UploadedFile()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateKnowledgeDocumentDto, Object]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "create", null);
__decorate([
    Get('documents/:id'),
    Roles('PROVIDER_ADMIN', 'SYSTEM_ADMIN'),
    ApiOkResponse({ type: KnowledgeDocumentDetailDto }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "detail", null);
__decorate([
    Post('documents/:id/publish'),
    Roles('PROVIDER_ADMIN', 'SYSTEM_ADMIN'),
    ApiOkResponse({ type: KnowledgeDocumentDto }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, PublishKnowledgeDocumentDto]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "publish", null);
__decorate([
    Post('query'),
    Roles('CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN'),
    ApiOkResponse({ type: KnowledgeSourceDto, isArray: true }),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, KnowledgeQueryDto]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "query", null);
KnowledgeController = __decorate([
    ApiTags('knowledge'),
    Controller('knowledge'),
    UseGuards(AuthGuard, RolesGuard),
    ApiBearerAuth(),
    __metadata("design:paramtypes", [KnowledgeService])
], KnowledgeController);
export { KnowledgeController };
//# sourceMappingURL=knowledge.controller.js.map