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
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerControllerService } from './customer-controller.service.js';
import { CurrentUser, Roles } from './security.decorators.js';
import { AuthGuard, RolesGuard } from './security.guards.js';
let CustomerControllerController = class CustomerControllerController {
    service;
    constructor(service) {
        this.service = service;
    }
    get(actor) {
        return this.service.provision(actor.sub);
    }
    provision(actor) {
        return this.service.provision(actor.sub);
    }
};
__decorate([
    Get(),
    ApiOperation({ summary: 'Get or provision the immutable Customer Controller' }),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CustomerControllerController.prototype, "get", null);
__decorate([
    Post('provision'),
    ApiOperation({ summary: 'Idempotently provision the Customer Controller' }),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CustomerControllerController.prototype, "provision", null);
CustomerControllerController = __decorate([
    ApiTags('identity'),
    ApiBearerAuth(),
    UseGuards(AuthGuard, RolesGuard),
    Roles('CUSTOMER'),
    Controller('auth/controller'),
    __metadata("design:paramtypes", [CustomerControllerService])
], CustomerControllerController);
export { CustomerControllerController };
//# sourceMappingURL=customer-controller.controller.js.map