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
import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
export class CreateKnowledgeDocumentDto {
    productId;
    logicalDocumentKey;
    sourceType;
    title;
    chunks;
    version;
}
__decorate([
    ApiProperty({ format: 'uuid' }),
    IsUUID(),
    __metadata("design:type", String)
], CreateKnowledgeDocumentDto.prototype, "productId", void 0);
__decorate([
    ApiProperty({ maxLength: 180, pattern: '^[A-Za-z0-9][A-Za-z0-9/_-]{0,179}$' }),
    IsString(),
    Length(1, 180),
    Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]{0,179}$/u),
    __metadata("design:type", String)
], CreateKnowledgeDocumentDto.prototype, "logicalDocumentKey", void 0);
__decorate([
    ApiProperty({ enum: ['FAQ', 'PDF', 'TXT'] }),
    IsIn(['FAQ', 'PDF', 'TXT']),
    __metadata("design:type", String)
], CreateKnowledgeDocumentDto.prototype, "sourceType", void 0);
__decorate([
    ApiProperty({ maxLength: 255 }),
    IsString(),
    Length(1, 255),
    __metadata("design:type", String)
], CreateKnowledgeDocumentDto.prototype, "title", void 0);
__decorate([
    ApiPropertyOptional({ type: String, isArray: true }),
    IsOptional(),
    IsArray(),
    IsString({ each: true }),
    __metadata("design:type", Array)
], CreateKnowledgeDocumentDto.prototype, "chunks", void 0);
__decorate([
    ApiPropertyOptional({ minimum: 1, maximum: 100 }),
    IsOptional(),
    IsInt(),
    Min(1),
    Max(100),
    __metadata("design:type", Number)
], CreateKnowledgeDocumentDto.prototype, "version", void 0);
export class KnowledgeDocumentDto {
    id;
    title;
    logicalDocumentKey;
    version;
    status;
    isCurrent;
}
__decorate([
    ApiProperty({ format: 'uuid' }),
    __metadata("design:type", String)
], KnowledgeDocumentDto.prototype, "id", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], KnowledgeDocumentDto.prototype, "title", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], KnowledgeDocumentDto.prototype, "logicalDocumentKey", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], KnowledgeDocumentDto.prototype, "version", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], KnowledgeDocumentDto.prototype, "status", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Boolean)
], KnowledgeDocumentDto.prototype, "isCurrent", void 0);
export class PublishKnowledgeDocumentDto {
    expectedCurrentVersion;
}
__decorate([
    ApiPropertyOptional({ minimum: 0, description: 'Observed current version; 0 means no published version.' }),
    IsOptional(),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], PublishKnowledgeDocumentDto.prototype, "expectedCurrentVersion", void 0);
export class KnowledgeDocumentDetailDto extends KnowledgeDocumentDto {
    chunks;
}
__decorate([
    ApiProperty({ type: String, isArray: true }),
    __metadata("design:type", Array)
], KnowledgeDocumentDetailDto.prototype, "chunks", void 0);
export class KnowledgeQueryDto {
    question;
}
__decorate([
    ApiProperty({ minLength: 1, maxLength: 4_000 }),
    IsString(),
    Length(1, 4_000),
    __metadata("design:type", String)
], KnowledgeQueryDto.prototype, "question", void 0);
export class KnowledgeSourceDto {
    id;
    content;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], KnowledgeSourceDto.prototype, "id", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], KnowledgeSourceDto.prototype, "content", void 0);
//# sourceMappingURL=knowledge.dto.js.map