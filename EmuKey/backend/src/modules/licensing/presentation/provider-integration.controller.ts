import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
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
import { ProviderIntegrationService } from '../application/provider-integration.service.js';
import { ProviderHandoffService } from '../application/provider-handoff.service.js';
import {
  ProviderIntegrationStateDto,
  RetryProviderDeliveryDto,
  SaveProviderIntegrationDto,
  ProviderIntegrationViewDto,
  ProviderDeliveryViewDto,
} from './provider-integration.dto.js';

function pageOffset(value?: string) {
  const page = Number(value ?? 0);
  return Number.isSafeInteger(page) && page >= 0 && page <= 10000
    ? page * 50
    : 0;
}

@ApiTags('provider-integration')
@ApiBearerAuth()
@Controller('provider')
@UseGuards(AuthGuard, RolesGuard)
@Roles('PROVIDER_ADMIN')
export class ProviderIntegrationController {
  constructor(
    private readonly service: ProviderIntegrationService,
    private readonly handoff: ProviderHandoffService,
  ) {}
  @Get('integration')
  @ApiOkResponse({
    type: ProviderIntegrationViewDto,
    description: 'Masked integration; configVersion is zero until configured',
  })
  get(@CurrentUser() actor: AuthPrincipal) {
    return this.service.get(actor.sub);
  }
  @Put('integration') @ApiOkResponse({ type: ProviderIntegrationViewDto }) save(
    @CurrentUser() actor: AuthPrincipal,
    @Body() body: SaveProviderIntegrationDto,
  ) {
    return this.service.save(actor.sub, body);
  }
  @Post('integration/test')
  @ApiCreatedResponse({ type: ProviderIntegrationViewDto })
  test(@CurrentUser() actor: AuthPrincipal) {
    return this.service.test(actor.sub);
  }
  @Post('integration/state')
  @ApiCreatedResponse({ type: ProviderIntegrationViewDto })
  state(
    @CurrentUser() actor: AuthPrincipal,
    @Body() body: ProviderIntegrationStateDto,
  ) {
    return this.service.state(
      actor.sub,
      body.configVersion,
      body.action === 'ENABLE',
    );
  }
  @Get('license-deliveries')
  @ApiOkResponse({ type: ProviderDeliveryViewDto, isArray: true })
  list(
    @CurrentUser() actor: AuthPrincipal,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ) {
    return this.handoff.listDeliveries(actor, status, pageOffset(page));
  }
  @Post('license-deliveries/:id/retry') retry(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RetryProviderDeliveryDto,
  ) {
    return this.handoff.retryDelivery(actor, id, body.reason);
  }
}

@ApiTags('provider-integration')
@ApiBearerAuth()
@Controller('operations/license-deliveries')
@UseGuards(AuthGuard, RolesGuard)
export class ProviderDeliveryOperationsController {
  constructor(private readonly handoff: ProviderHandoffService) {}
  @Get()
  @Roles('SYSTEM_ADMIN', 'SUPPORT_STAFF')
  @ApiOkResponse({ type: ProviderDeliveryViewDto, isArray: true })
  list(
    @CurrentUser() actor: AuthPrincipal,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ) {
    return this.handoff.listDeliveries(actor, status, pageOffset(page));
  }
  @Post(':id/retry') @Roles('SYSTEM_ADMIN') retry(
    @CurrentUser() actor: AuthPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RetryProviderDeliveryDto,
  ) {
    return this.handoff.retryDelivery(actor, id, body.reason);
  }
}
