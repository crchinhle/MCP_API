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
import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
export class CreateConversationDto {
    contextId;
    contextType;
    title;
}
__decorate([
    ApiPropertyOptional({ format: 'uuid' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "contextId", void 0);
__decorate([
    ApiPropertyOptional({ enum: ['GENERAL', 'PRODUCT', 'PLAN', 'ORDER', 'LICENSE'] }),
    IsOptional(),
    IsIn(['GENERAL', 'PRODUCT', 'PLAN', 'ORDER', 'LICENSE']),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "contextType", void 0);
__decorate([
    ApiPropertyOptional({ maxLength: 255 }),
    IsOptional(),
    IsString(),
    MaxLength(255),
    __metadata("design:type", String)
], CreateConversationDto.prototype, "title", void 0);
export class AppendMessageDto {
    clientMessageId;
    content;
}
__decorate([
    ApiProperty({ format: 'uuid' }),
    IsUUID(),
    __metadata("design:type", String)
], AppendMessageDto.prototype, "clientMessageId", void 0);
__decorate([
    ApiProperty({ minLength: 1, maxLength: 8_000 }),
    IsString(),
    Length(1, 8_000),
    __metadata("design:type", String)
], AppendMessageDto.prototype, "content", void 0);
export class AiAskDto {
    clientMessageId;
    question;
}
__decorate([
    ApiProperty({ format: 'uuid' }),
    IsUUID(),
    __metadata("design:type", String)
], AiAskDto.prototype, "clientMessageId", void 0);
__decorate([
    ApiProperty({ minLength: 1, maxLength: 4_000 }),
    IsString(),
    Length(1, 4_000),
    __metadata("design:type", String)
], AiAskDto.prototype, "question", void 0);
export class RequestSupportDto {
    reason;
}
__decorate([
    ApiProperty({ minLength: 1, maxLength: 1_000 }),
    IsString(),
    Length(1, 1_000),
    __metadata("design:type", String)
], RequestSupportDto.prototype, "reason", void 0);
export class AiAnswerDto {
    answer;
    citedSourceIds;
    grounded;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], AiAnswerDto.prototype, "answer", void 0);
__decorate([
    ApiProperty({ isArray: true, type: String }),
    __metadata("design:type", Array)
], AiAnswerDto.prototype, "citedSourceIds", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Boolean)
], AiAnswerDto.prototype, "grounded", void 0);
export class ConversationDto {
    id;
    customerUserId;
    assignedSupportUserId;
    status;
    contextType;
    contextId;
    title;
}
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], ConversationDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], ConversationDto.prototype, "customerUserId", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid', nullable: true, type: String }),
    __metadata("design:type", Object)
], ConversationDto.prototype, "assignedSupportUserId", void 0);
__decorate([
    ApiProperty({ enum: ['AI_ACTIVE', 'WAITING_SUPPORT', 'SUPPORT_ACTIVE', 'CLOSED'] }),
    __metadata("design:type", String)
], ConversationDto.prototype, "status", void 0);
__decorate([
    ApiProperty({ enum: ['GENERAL', 'PRODUCT', 'PLAN', 'ORDER', 'LICENSE'] }),
    __metadata("design:type", String)
], ConversationDto.prototype, "contextType", void 0);
__decorate([
    ApiPropertyOptional({ format: 'uuid', nullable: true, type: String }),
    __metadata("design:type", Object)
], ConversationDto.prototype, "contextId", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true }),
    __metadata("design:type", Object)
], ConversationDto.prototype, "title", void 0);
export class MessageDto {
    id;
    conversationId;
    clientMessageId;
    serverSequence;
    senderType;
    content;
    grounded;
    sources;
}
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], MessageDto.prototype, "id", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], MessageDto.prototype, "conversationId", void 0);
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], MessageDto.prototype, "clientMessageId", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], MessageDto.prototype, "serverSequence", void 0);
__decorate([
    ApiProperty({ enum: ['CUSTOMER', 'SUPPORT', 'AI', 'SYSTEM'] }),
    __metadata("design:type", String)
], MessageDto.prototype, "senderType", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], MessageDto.prototype, "content", void 0);
__decorate([
    ApiPropertyOptional({ nullable: true }),
    __metadata("design:type", Object)
], MessageDto.prototype, "grounded", void 0);
__decorate([
    ApiPropertyOptional({ type: String, isArray: true }),
    __metadata("design:type", Array)
], MessageDto.prototype, "sources", void 0);
//# sourceMappingURL=assistance-support.dto.js.map