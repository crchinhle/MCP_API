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
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from '../application/catalog.service.js';
import { CatalogAdminService } from '../application/catalog-admin.service.js';
import { CurrentUser, Roles } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../../identity-access/security.guards.js';
import { AdminProductDto, CatalogDeleteResultDto, CreateProductDto, PublicCatalogProductDto, UpdateProductDto, } from './catalog.dto.js';
let CatalogController = class CatalogController {
    service;
    adminService;
    constructor(service, adminService) {
        this.service = service;
        this.adminService = adminService;
    }
    listAdmin(actor) { return this.adminService.listProducts(actor); }
    findAdmin(actor, id) { return this.adminService.findProduct(actor, id); }
    list() { return this.service.list(); }
    find(slug) { return this.service.find(slug); }
    create(actor, dto) {
        return this.adminService.createProduct(actor, dto);
    }
    update(actor, id, dto) {
        return this.adminService.updateProduct(actor, id, dto);
    }
    delete(actor, id) {
        return this.adminService.deleteProduct(actor, id);
    }
    publish(actor, id) {
        return this.adminService.publishProduct(actor, id);
    }
    archive(actor, id) {
        return this.adminService.archiveProduct(actor, id);
    }
};
__decorate([
    Get('admin'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'List provider catalog products' }),
    ApiOkResponse({ type: AdminProductDto, isArray: true }),
    __param(0, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "listAdmin", null);
__decorate([
    Get('admin/:id'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Get a provider catalog product' }),
    ApiOkResponse({ type: AdminProductDto }),
    ApiNotFoundResponse(),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "findAdmin", null);
__decorate([
    Get(),
    ApiOperation({ summary: 'List published products and plans' }),
    ApiOkResponse({ type: PublicCatalogProductDto, isArray: true }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "list", null);
__decorate([
    Get(':slug'),
    ApiOperation({ summary: 'Get a published product by slug' }),
    ApiOkResponse({ type: PublicCatalogProductDto }),
    __param(0, Param('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "find", null);
__decorate([
    Post(),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Create a provider catalog product' }),
    ApiCreatedResponse({ description: 'Product created.', type: AdminProductDto }),
    ApiForbiddenResponse(),
    __param(0, CurrentUser()),
    __param(1, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateProductDto]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "create", null);
__decorate([
    Put(':id'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Update a provider catalog product' }),
    ApiOkResponse({ type: AdminProductDto }),
    ApiNotFoundResponse(),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __param(2, Body()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateProductDto]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "update", null);
__decorate([
    Delete(':id'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Delete an unused draft catalog product' }),
    ApiOkResponse({ type: CatalogDeleteResultDto }),
    ApiConflictResponse({ description: 'Only unused draft products can be deleted.' }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "delete", null);
__decorate([
    Post(':id/publish'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Publish a provider catalog product' }),
    ApiCreatedResponse({ type: AdminProductDto }),
    ApiConflictResponse({ description: 'The catalog state transition is not allowed.' }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "publish", null);
__decorate([
    Post(':id/archive'),
    UseGuards(AuthGuard, RolesGuard),
    Roles('PROVIDER_ADMIN'),
    ApiBearerAuth(),
    ApiOperation({ summary: 'Archive a provider catalog product' }),
    ApiCreatedResponse({ type: AdminProductDto }),
    __param(0, CurrentUser()),
    __param(1, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CatalogController.prototype, "archive", null);
CatalogController = __decorate([
    ApiTags('catalog'),
    Controller('products'),
    __metadata("design:paramtypes", [CatalogService,
        CatalogAdminService])
], CatalogController);
export { CatalogController };
//# sourceMappingURL=catalog.controller.js.map