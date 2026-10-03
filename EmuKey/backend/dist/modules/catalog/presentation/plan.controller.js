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
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../../identity-access/security.guards.js';
import { CatalogAdminService } from '../application/catalog-admin.service.js';
import { AdminPlanDto, CatalogDeleteResultDto, ComparePlansResponseDto, CreatePlanDto, UpdatePlanDto, } from './catalog.dto.js';
import { ComparePlansQuery } from '../application/compare-plans.query.js';
let PlanController = class PlanController {
    service;
    comparePlans;
    constructor(service, comparePlans) {
        this.service = service;
        this.comparePlans = comparePlans;
    }
    compare(ids) {
        return this.comparePlans.execute(ids);
    }
    list(actor, productId) {
        return this.service.listPlans(actor, productId);
    }
    find(actor, id) {
        return this.service.findPlan(actor, id);
    }
    create(actor, dto) {
        return this.service.createPlan(actor, dto);
    }
    update(actor, id, dto) {
        return this.service.updatePlan(actor, id, dto);
    }
    delete(actor, id) {
        return this.service.deletePlan(actor, id);
    }
    publish(actor, id) {
        return this.service.publishPlan(actor, id);
    }
    archive(actor, id) {
        return this.service.archivePlan(actor, id);
    }
};
__decorate([
    Get('compare'),
    ApiOperation({ summary: 'Compare two to four published plans' }),
    ApiOkResponse({ type: ComparePlansResponseDto }),
    ApiQuery({ name: 'ids', required: true }),
    __param(0, Query('ids')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PlanController.prototype, "compare", null);
__decorate([
    Get(),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'List provider catalog plans' }),
    ApiOkResponse({ type: AdminPlanDto, isArray: true }),
    ApiQuery({ name: 'productId', required: false, format: 'uuid' }),
    __param(0, CurrentUser()),
    __param(1, Query('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PlanController.prototype, "list", null);
__decorate([
    Get(':id'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get a provider catalog plan' }),
    ApiOkResponse({ type: AdminPlanDto }),
    ApiNotFoundResponse(),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PlanController.prototype, "find", null);
__decorate([
    Post(),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Create a provider catalog plan' }),
    ApiCreatedResponse({ description: 'Plan created.', type: AdminPlanDto }),
    ApiForbiddenResponse(),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreatePlanDto]),
    __metadata("design:returntype", void 0)
], PlanController.prototype, "create", null);
__decorate([
    Put(':id'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Update a provider catalog plan' }),
    ApiOkResponse({ type: AdminPlanDto }),
    ApiNotFoundResponse(),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdatePlanDto]),
    __metadata("design:returntype", void 0)
], PlanController.prototype, "update", null);
__decorate([
    Delete(':id'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete an unused draft catalog plan' }),
    ApiOkResponse({ type: CatalogDeleteResultDto }),
    ApiConflictResponse({ description: 'Only unused draft plans can be deleted.' }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PlanController.prototype, "delete", null);
__decorate([
    Post(':id/publish'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Publish a provider catalog plan' }),
    ApiCreatedResponse({ type: AdminPlanDto }),
    ApiConflictResponse({ description: 'The catalog state transition is not allowed.' }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PlanController.prototype, "publish", null);
__decorate([
    Post(':id/archive'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Archive a provider catalog plan' }),
    ApiCreatedResponse({ type: AdminPlanDto }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PlanController.prototype, "archive", null);
PlanController = __decorate([
    ApiTags('catalog'),
    Controller('plans'),
    __metadata("design:paramtypes", [CatalogAdminService,
        ComparePlansQuery])
], PlanController);
export { PlanController };
//# sourceMappingURL=plan.controller.js.map