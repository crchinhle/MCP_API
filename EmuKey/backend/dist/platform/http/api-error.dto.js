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
export class ApiErrorDto {
    code;
    message;
    details;
    traceId;
}
__decorate([
    ApiProperty({ example: 'NOT_FOUND' }),
    __metadata("design:type", String)
], ApiErrorDto.prototype, "code", void 0);
__decorate([
    ApiProperty({ example: 'Not Found' }),
    __metadata("design:type", String)
], ApiErrorDto.prototype, "message", void 0);
__decorate([
    ApiPropertyOptional({ description: 'Safe structured validation details.' }),
    __metadata("design:type", Object)
], ApiErrorDto.prototype, "details", void 0);
__decorate([
    ApiProperty({ example: '01JREQUESTTRACE' }),
    __metadata("design:type", String)
], ApiErrorDto.prototype, "traceId", void 0);
export class ApiErrorEnvelopeDto {
    error;
}
__decorate([
    ApiProperty({ type: ApiErrorDto }),
    __metadata("design:type", ApiErrorDto)
], ApiErrorEnvelopeDto.prototype, "error", void 0);
//# sourceMappingURL=api-error.dto.js.map