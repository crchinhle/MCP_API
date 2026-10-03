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
import { IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator';
export class BlockchainHealthDto {
    active_without_finality;
    pending_events;
    reorged_events;
    unknown_commands;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], BlockchainHealthDto.prototype, "active_without_finality", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], BlockchainHealthDto.prototype, "pending_events", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], BlockchainHealthDto.prototype, "reorged_events", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], BlockchainHealthDto.prototype, "unknown_commands", void 0);
export class BlockchainProjectionRepairDto {
    commandRepairs;
    licenseIds;
    licenseRepairs;
    remainingMismatches;
}
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], BlockchainProjectionRepairDto.prototype, "commandRepairs", void 0);
__decorate([
    ApiProperty({ isArray: true, type: String }),
    __metadata("design:type", Array)
], BlockchainProjectionRepairDto.prototype, "licenseIds", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], BlockchainProjectionRepairDto.prototype, "licenseRepairs", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], BlockchainProjectionRepairDto.prototype, "remainingMismatches", void 0);
export class BlockchainReconciliationDto {
    health;
    indexedEvents;
    processed;
    projection;
    reconciledCommandIds;
}
__decorate([
    ApiProperty({ type: BlockchainHealthDto }),
    __metadata("design:type", BlockchainHealthDto)
], BlockchainReconciliationDto.prototype, "health", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Number)
], BlockchainReconciliationDto.prototype, "indexedEvents", void 0);
__decorate([
    ApiProperty(),
    __metadata("design:type", Boolean)
], BlockchainReconciliationDto.prototype, "processed", void 0);
__decorate([
    ApiProperty({ type: BlockchainProjectionRepairDto }),
    __metadata("design:type", BlockchainProjectionRepairDto)
], BlockchainReconciliationDto.prototype, "projection", void 0);
__decorate([
    ApiProperty({ isArray: true, type: String }),
    __metadata("design:type", Array)
], BlockchainReconciliationDto.prototype, "reconciledCommandIds", void 0);
export class DeadLetterRecoveryDto {
    evidence;
    mode;
    reason;
}
__decorate([
    ApiPropertyOptional({ type: 'object', additionalProperties: true }),
    IsOptional(),
    IsObject(),
    __metadata("design:type", Object)
], DeadLetterRecoveryDto.prototype, "evidence", void 0);
__decorate([
    ApiProperty({ enum: ['REQUEUE_NO_SUBMISSION', 'RECONCILE_SAME_RAW', 'ABANDON_REVERTED', 'ABANDON_NO_EFFECT'] }),
    IsIn(['REQUEUE_NO_SUBMISSION', 'RECONCILE_SAME_RAW', 'ABANDON_REVERTED', 'ABANDON_NO_EFFECT']),
    __metadata("design:type", String)
], DeadLetterRecoveryDto.prototype, "mode", void 0);
__decorate([
    ApiProperty({ minLength: 3, maxLength: 2_000 }),
    IsString(),
    Length(3, 2_000),
    __metadata("design:type", String)
], DeadLetterRecoveryDto.prototype, "reason", void 0);
//# sourceMappingURL=blockchain-reconciliation.dto.js.map