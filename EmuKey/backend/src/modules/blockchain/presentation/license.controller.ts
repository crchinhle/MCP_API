import {
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  CurrentUser,
  Roles,
} from '../../identity-access/security.decorators.js';
import {
  AuthGuard,
  RolesGuard,
} from '../../identity-access/security.guards.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { LicenseQueryService } from '../application/license-query.service.js';
import {
  ActivationKeyDto,
  LicenseProjectionDto,
  LicenseDeviceDto,
  PublicLicenseVerificationDto,
} from './license.dto.js';

@ApiTags('licenses')
@Controller('licenses')
export class LicenseController {
  constructor(private readonly service: LicenseQueryService) {}

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('CUSTOMER', 'PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOkResponse({ type: LicenseProjectionDto, isArray: true })
  list(@CurrentUser() actor: AuthPrincipal) {
    return this.service.list(actor);
  }

  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('CUSTOMER', 'PROVIDER_ADMIN')
  @ApiBearerAuth()
  @ApiOkResponse({ type: LicenseProjectionDto })
  find(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.find(actor, id);
  }

  @Get(':id/devices')
  @UseGuards(AuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('CUSTOMER')
  @ApiOkResponse({ type: LicenseDeviceDto, isArray: true })
  listDevices(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.listDevices(actor, id);
  }

  @Post(':id/activation-key/retrieve')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve a confirmed activation key exactly once' })
  @ApiCreatedResponse({ type: ActivationKeyDto })
  retrieve(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.retrieveActivation(actor, id);
  }
}

@ApiTags('public')
@Controller('public/licenses')
export class PublicLicenseController {
  constructor(private readonly service: LicenseQueryService) {}

  @Get(':publicId/verify')
  @ApiOperation({ summary: 'Verify an allowlisted public license projection' })
  @ApiOkResponse({ type: PublicLicenseVerificationDto })
  verify(@Param('publicId') publicId: string, @Ip() requester: string) {
    return this.service.verify(publicId, requester);
  }
}
