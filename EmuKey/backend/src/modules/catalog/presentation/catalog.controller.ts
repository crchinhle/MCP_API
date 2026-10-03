import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from '../application/catalog.service.js';
import { CatalogAdminService } from '../application/catalog-admin.service.js';
import { CurrentUser, Roles } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../../identity-access/security.guards.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import {
  AdminProductDto,
  CatalogDeleteResultDto,
  CreateProductDto,
  PublicCatalogProductDto,
  UpdateProductDto,
} from './catalog.dto.js';

@ApiTags('catalog')
@Controller('products')
export class CatalogController {
  constructor(
    private readonly service: CatalogService,
    private readonly adminService: CatalogAdminService,
  ) {}
  @Get('admin')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List provider catalog products' })
  @ApiOkResponse({ type: AdminProductDto, isArray: true })
  listAdmin(@CurrentUser() actor: AuthPrincipal) { return this.adminService.listProducts(actor); }

  @Get('admin/:id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a provider catalog product' })
  @ApiOkResponse({ type: AdminProductDto })
  @ApiNotFoundResponse()
  findAdmin(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) { return this.adminService.findProduct(actor, id); }

  @Get() @ApiOperation({ summary: 'List published products and plans' }) @ApiOkResponse({ type: PublicCatalogProductDto, isArray: true }) list() { return this.service.list(); }
  @Get(':slug') @ApiOperation({ summary: 'Get a published product by slug' }) @ApiOkResponse({ type: PublicCatalogProductDto }) find(@Param('slug') slug: string) { return this.service.find(slug); }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a provider catalog product' })
  @ApiCreatedResponse({ description: 'Product created.', type: AdminProductDto })
  @ApiForbiddenResponse()
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreateProductDto) {
    return this.adminService.createProduct(actor, dto);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a provider catalog product' })
  @ApiOkResponse({ type: AdminProductDto })
  @ApiNotFoundResponse()
  update(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.adminService.updateProduct(actor, id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an unused draft catalog product' })
  @ApiOkResponse({ type: CatalogDeleteResultDto })
  @ApiConflictResponse({ description: 'Only unused draft products can be deleted.' })
  delete(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteProduct(actor, id);
  }

  @Post(':id/publish')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a provider catalog product' })
  @ApiCreatedResponse({ type: AdminProductDto })
  @ApiConflictResponse({ description: 'The catalog state transition is not allowed.' })
  publish(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.publishProduct(actor, id);
  }

  @Post(':id/archive')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a provider catalog product' })
  @ApiCreatedResponse({ type: AdminProductDto })
  archive(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.archiveProduct(actor, id);
  }
}
