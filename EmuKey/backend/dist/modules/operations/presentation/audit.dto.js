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
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
export class AuditQueryDto {
    page = 1;
    action;
    outcome;
}
__decorate([
    ApiPropertyOptional({ default: 1 }),
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(10000),
    __metadata("design:type", Object)
], AuditQueryDto.prototype, "page", void 0);
__decorate([
    ApiPropertyOptional({ maxLength: 120 }),
    IsOptional(),
    IsString(),
    MaxLength(120),
    __metadata("design:type", String)
], AuditQueryDto.prototype, "action", void 0);
__decorate([
    ApiPropertyOptional({ enum: ['SUCCESS', 'DENIED', 'FAILED'] }),
    IsOptional(),
    IsIn(['SUCCESS', 'DENIED', 'FAILED']),
    __metadata("design:type", String)
], AuditQueryDto.prototype, "outcome", void 0);
export class AuditEntryDto {
    id;
    action;
    outcome;
    actorUserId;
    actorRole;
    targetType;
    targetId;
    reason;
    createdAt;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], AuditEntryDto.prototype, "id", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], AuditEntryDto.prototype, "action", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", String)
], AuditEntryDto.prototype, "outcome", void 0);
__decorate([
    ApiProperty({ nullable: true, type: String }),
    __metadata("design:type", Object)
], AuditEntryDto.prototype, "actorUserId", void 0);
__decorate([
    ApiProperty({ nullable: true, type: String }),
    __metadata("design:type", Object)
], AuditEntryDto.prototype, "actorRole", void 0);
__decorate([
    ApiProperty({ nullable: true, type: String }),
    __metadata("design:type", Object)
], AuditEntryDto.prototype, "targetType", void 0);
__decorate([
    ApiProperty({ nullable: true, type: String }),
    __metadata("design:type", Object)
], AuditEntryDto.prototype, "targetId", void 0);
__decorate([
    ApiProperty({ nullable: true, type: String }),
    __metadata("design:type", Object)
], AuditEntryDto.prototype, "reason", void 0);
__decorate([
    ApiProperty({ format: 'date-time' }),
    __metadata("design:type", String)
], AuditEntryDto.prototype, "createdAt", void 0);
export class AuditPageDto {
    items;
    hasMore;
    page;
}
__decorate([
    ApiProperty({ type: AuditEntryDto, isArray: true }),
    __metadata("design:type", Array)
], AuditPageDto.prototype, "items", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Boolean)
], AuditPageDto.prototype, "hasMore", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], AuditPageDto.prototype, "page", void 0);
//# sourceMappingURL=audit.dto.js.map