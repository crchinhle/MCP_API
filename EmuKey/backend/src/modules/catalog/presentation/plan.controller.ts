import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { CurrentUser, Roles } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../../identity-access/security.guards.js';
import { CatalogAdminService } from '../application/catalog-admin.service.js';
import {
  AdminPlanDto,
  CatalogDeleteResultDto,
  ComparePlansResponseDto,
  CreatePlanDto,
  UpdatePlanDto,
} from './catalog.dto.js';
import { ComparePlansQuery } from '../application/compare-plans.query.js';

@ApiTags('catalog')
@Controller('plans')
export class PlanController {
  constructor(
    private readonly service: CatalogAdminService,
    private readonly comparePlans: ComparePlansQuery,
  ) {}

  @Get('compare')
  @ApiOperation({ summary: 'Compare two to four published plans' })
  @ApiOkResponse({ type: ComparePlansResponseDto })
  @ApiQuery({ name: 'ids', required: true })
  compare(@Query('ids') ids: string | string[]) {
    return this.comparePlans.execute(ids);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List provider catalog plans' })
  @ApiOkResponse({ type: AdminPlanDto, isArray: true })
  @ApiQuery({ name: 'productId', required: false, format: 'uuid' })
  list(@CurrentUser() actor: AuthPrincipal, @Query('productId') productId?: string) {
    return this.service.listPlans(actor, productId);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a provider catalog plan' })
  @ApiOkResponse({ type: AdminPlanDto })
  @ApiNotFoundResponse()
  find(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findPlan(actor, id);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a provider catalog plan' })
  @ApiCreatedResponse({ description: 'Plan created.', type: AdminPlanDto })
  @ApiForbiddenResponse()
  create(@CurrentUser() actor: AuthPrincipal, @Body() dto: CreatePlanDto) {
    return this.service.createPlan(actor, dto);
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a provider catalog plan' })
  @ApiOkResponse({ type: AdminPlanDto })
  @ApiNotFoundResponse()
  update(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.service.updatePlan(actor, id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an unused draft catalog plan' })
  @ApiOkResponse({ type: CatalogDeleteResultDto })
  @ApiConflictResponse({ description: 'Only unused draft plans can be deleted.' })
  delete(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.deletePlan(actor, id);
  }

  @Post(':id/publish')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish a provider catalog plan' })
  @ApiCreatedResponse({ type: AdminPlanDto })
  @ApiConflictResponse({ description: 'The catalog state transition is not allowed.' })
  publish(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.publishPlan(actor, id);
  }

  @Post(':id/archive')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a provider catalog plan' })
  @ApiCreatedResponse({ type: AdminPlanDto })
  archive(@CurrentUser() actor: AuthPrincipal, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.archivePlan(actor, id);
  }
}
