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
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../identity-access/security.guards.js';
import { AiAnswerDto, AiAskDto, AppendMessageDto, ConversationDto, CreateConversationDto, MessageDto, RequestSupportDto } from './assistance-support.dto.js';
import { AssistanceSupportService } from './assistance-support.service.js';
let AssistanceSupportController = class AssistanceSupportController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(actor) { return this.service.list(actor); }
    queue(actor) { return this.service.queue(actor); }
    create(actor, dto) { return this.service.createConversation(actor, dto); }
    find(actor, conversationId) { return this.service.find(actor, conversationId); }
    append(actor, conversationId, dto) { return this.service.appendMessage(actor, conversationId, dto); }
    messages(actor, conversationId) { return this.service.listMessages(actor, conversationId); }
    askAi(actor, conversationId, dto) { return this.service.askAi(actor, conversationId, dto.question, dto.clientMessageId); }
    requestSupport(actor, conversationId, dto) { return this.service.requestSupport(actor, conversationId, dto.reason); }
    queuePreviewMessages(actor, conversationId) { return this.service.listQueuePreviewMessages(actor, conversationId); }
    claim(actor, conversationId) { return this.service.claim(actor, conversationId); }
    release(actor, conversationId) { return this.service.release(actor, conversationId); }
    close(actor, conversationId) { return this.service.close(actor, conversationId); }
};
__decorate([
    Get(),
    Roles('CUSTOMER', 'SUPPORT_STAFF', 'SYSTEM_ADMIN'),
    ApiOkResponse({ type: ConversationDto, isArray: true }),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AssistanceSupportController.prototype, "list", null);
__decorate([
    Get('queue'),
    Roles('SUPPORT_STAFF', 'SYSTEM_ADMIN'),
    ApiOkResponse({ type: ConversationDto, isArray: true }),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AssistanceSupportController.prototype, "queue", null);
__decorate([
    Post(),
    Roles('CUSTOMER'),
    ApiCreatedResponse({ type: ConversationDto }),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateConversationDto]),
    __metadata("design:returntype", void 0)
], AssistanceSupportController.prototype, "create", null);
__decorate([
    Get(':conversationId'),
    Roles('CUSTOMER', 'SUPPORT_STAFF', 'SYSTEM_ADMIN'),
    ApiOkResponse({ type: ConversationDto }),
    __param(0, CurrentUser()),
    __param(1, Param('conversationId', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssistanceSupportController.prototype, "find", null);
__decorate([
    Post(':conversationId/messages'),
    Roles('CUSTOMER', 'SUPPORT_STAFF'),
    ApiCreatedResponse({ type: MessageDto }),
    __param(0, CurrentUser()),
    __param(1, Param('conversationId', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, AppendMessageDto]),
    __metadata("design:returntype", void 0)
], AssistanceSupportController.prototype, "append", null);
__decorate([
    Get(':conversationId/messages'),
    Roles('CUSTOMER', 'SUPPORT_STAFF', 'SYSTEM_ADMIN'),
    ApiOkResponse({ type: MessageDto, isArray: true }),
    __param(0, CurrentUser()),
    __param(1, Param('conversationId', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssistanceSupportController.prototype, "messages", null);
__decorate([
    Post(':conversationId/ai-ask'),
    Roles('CUSTOMER'),
    ApiOkResponse({ type: AiAnswerDto }),
    __param(0, CurrentUser()),
    __param(1, Param('conversationId', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, AiAskDto]),
    __metadata("design:returntype", void 0)
], AssistanceSupportController.prototype, "askAi", null);
__decorate([
    Post(':conversationId/request-support'),
    Roles('CUSTOMER'),
    ApiOperation({ summary: 'Escalate an AI conversation to the Support queue' }),
    ApiOkResponse({ type: ConversationDto }),
    __param(0, CurrentUser()),
    __param(1, Param('conversationId', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, RequestSupportDto]),
    __metadata("design:returntype", void 0)
], AssistanceSupportController.prototype, "requestSupport", null);
__decorate([
    Get(':conversationId/messages/queue-preview'),
    Roles('SUPPORT_STAFF', 'SYSTEM_ADMIN'),
    ApiOperation({ summary: 'Preview messages for an unclaimed queue item' }),
    ApiOkResponse({ type: MessageDto, isArray: true }),
    __param(0, CurrentUser()),
    __param(1, Param('conversationId', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssistanceSupportController.prototype, "queuePreviewMessages", null);
__decorate([
    Post(':conversationId/claim'),
    Roles('SUPPORT_STAFF'),
    ApiOkResponse({ type: ConversationDto }),
    __param(0, CurrentUser()),
    __param(1, Param('conversationId', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssistanceSupportController.prototype, "claim", null);
__decorate([
    Post(':conversationId/release'),
    Roles('SUPPORT_STAFF'),
    ApiOperation({ summary: 'Release a claimed conversation back to the queue' }),
    ApiOkResponse({ type: ConversationDto }),
    __param(0, CurrentUser()),
    __param(1, Param('conversationId', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssistanceSupportController.prototype, "release", null);
__decorate([
    Post(':conversationId/close'),
    Roles('CUSTOMER', 'SUPPORT_STAFF', 'SYSTEM_ADMIN'),
    ApiOkResponse({ type: ConversationDto }),
    __param(0, CurrentUser()),
    __param(1, Param('conversationId', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssistanceSupportController.prototype, "close", null);
AssistanceSupportController = __decorate([
    ApiTags('assistance'),
    Controller('conversations'),
    UseGuards(AuthGuard, RolesGuard),
    ApiBearerAuth(),
    __metadata("design:paramtypes", [AssistanceSupportService])
], AssistanceSupportController);
export { AssistanceSupportController };
//# sourceMappingURL=assistance-support.controller.js.map