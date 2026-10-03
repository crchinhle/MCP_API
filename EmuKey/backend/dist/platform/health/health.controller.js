var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, } from '@nestjs/swagger';
import { ApiErrorEnvelopeDto } from '../http/api-error.dto.js';
import { LivenessDto, ReadinessDto } from './health.dto.js';
import { PlatformReadinessService } from './platform-readiness.service.js';
let HealthController = class HealthController {
    readiness;
    constructor(readiness) {
        this.readiness = readiness;
    }
    live() {
        return { status: 'ok', service: 'emukey-api' };
    }
    async ready() {
        const result = await this.readiness.check();
        if (result.status === 'degraded') {
            throw new ServiceUnavailableException();
        }
        return result;
    }
};
__decorate([
    Get('live'),
    ApiOperation({ summary: 'Process liveness' }),
    ApiOkResponse({ type: LivenessDto }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", LivenessDto)
], HealthController.prototype, "live", null);
__decorate([
    Get('ready'),
    ApiOperation({ summary: 'PostgreSQL, Redis and blockchain readiness' }),
    ApiOkResponse({ type: ReadinessDto }),
    ApiServiceUnavailableResponse({ type: ApiErrorEnvelopeDto }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "ready", null);
HealthController = __decorate([
    ApiTags('platform'),
    Controller('health'),
    __metadata("design:paramtypes", [PlatformReadinessService])
], HealthController);
export { HealthController };
//# sourceMappingURL=health.controller.js.map