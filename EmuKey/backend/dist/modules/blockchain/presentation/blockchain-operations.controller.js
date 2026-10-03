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
import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../identity-access/security.decorators.js';
import { CurrentUser } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard, } from '../../identity-access/security.guards.js';
import { BlockchainReconciliationService } from '../application/blockchain-reconciliation.service.js';
import { BlockchainReconciliationDto, DeadLetterRecoveryDto } from './blockchain-reconciliation.dto.js';
let BlockchainOperationsController = class BlockchainOperationsController {
    reconciliation;
    constructor(reconciliation) {
        this.reconciliation = reconciliation;
    }
    reconcile(actor) {
        return this.reconciliation.run(actor);
    }
    recoverDeadLetter(actor, commandId, dto) {
        return this.reconciliation.recoverDeadLetter(actor, commandId, dto);
    }
};
__decorate([
    Post('reconcile'),
    HttpCode(HttpStatus.OK),
    ApiOkResponse({ type: BlockchainReconciliationDto }),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BlockchainOperationsController.prototype, "reconcile", null);
__decorate([
    Post('dead-letters/:commandId/recover'),
    HttpCode(HttpStatus.OK),
    ApiOkResponse(),
    __param(0, CurrentUser()),
    __param(1, Param('commandId', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, DeadLetterRecoveryDto]),
    __metadata("design:returntype", void 0)
], BlockchainOperationsController.prototype, "recoverDeadLetter", null);
BlockchainOperationsController = __decorate([
    ApiTags('operations'),
    Controller('operations/blockchain'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('SYSTEM_ADMIN'),
    ApiBearerAuth(),
    __metadata("design:paramtypes", [BlockchainReconciliationService])
], BlockchainOperationsController);
export { BlockchainOperationsController };
//# sourceMappingURL=blockchain-operations.controller.js.map