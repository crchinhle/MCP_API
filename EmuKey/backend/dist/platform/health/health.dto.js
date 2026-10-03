var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ApiProperty } from '@nestjs/swagger';
export class LivenessDto {
    status;
    service;
}
__decorate([
    ApiProperty({ enum: ['ok'], example: 'ok' }),
    __metadata("design:type", String)
], LivenessDto.prototype, "status", void 0);
__decorate([
    ApiProperty({ example: 'emukey-api' }),
    __metadata("design:type", String)
], LivenessDto.prototype, "service", void 0);
export class ReadinessDto {
    status;
    dependencies;
}
__decorate([
    ApiProperty({ enum: ['ok', 'degraded'] }),
    __metadata("design:type", String)
], ReadinessDto.prototype, "status", void 0);
__decorate([
    ApiProperty({
        additionalProperties: { enum: ['up', 'down'], type: 'string' },
        example: { blockchain: 'up', postgres: 'up', redis: 'up' },
        type: 'object',
    }),
    __metadata("design:type", Object)
], ReadinessDto.prototype, "dependencies", void 0);
//# sourceMappingURL=health.dto.js.map