import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiCreatedResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { CurrentUser, Roles } from '../identity-access/security.decorators.js';
import { AuthGuard, OptionalAuthGuard, RolesGuard } from '../identity-access/security.guards.js';
import type { AuthPrincipal } from '../identity-access/identity.types.js';
import {
  ActivateDeviceDto,
  ActivationChallengeDto,
  DeviceChallengeDto,
  EntitlementDto,
  EntitlementRefreshDto,
  EntitlementValidationDto,
  EntitlementVerifyDto,
  LicenseLifecycleDto,
  Phase6CommandDto,
  Phase6CommandStatusDto,
  RevokeDeviceDto,
  RemoteRevokeDeviceDto,
  ActivationKeyRecoveryDto,
  RotateActivationKeyDto,
  LicensingActionVerificationDto,
  ResolveLicensingActionDto,
  LicensingActionResolutionDto,
} from './licensing.dto.js';
import { LicensingService } from './licensing.service.js';
import { LicenseDeviceDto } from '../blockchain/presentation/license.dto.js';

@ApiTags('licensing')
@Controller()
@ApiBearerAuth()
export class LicensingController {
  constructor(private readonly service: LicensingService) {}

  @Post('activations/challenge')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Create a device challenge; activation challenges resolve the license from the bearer activation key and require no purchaser login' })
  @ApiCreatedResponse({ type: DeviceChallengeDto })
  async challenge(@CurrentUser() actor: AuthPrincipal | undefined, @Body() dto: ActivationChallengeDto, @Req() request: Request) {
    // Use the connected peer, not untrusted forwarded headers. A reverse proxy
    // shares this budget and should also apply its own client-IP limit.
    await this.service.limitPublicActivation(request.socket.remoteAddress ?? 'unknown');
    return this.service.challenge(actor ?? null, dto);
  }

  @Post('activations')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Activate a device with a bearer activation key and device proof; no purchaser session is required' })
  @ApiCreatedResponse({ type: LicenseDeviceDto })
  async activate(@CurrentUser() actor: AuthPrincipal | undefined, @Body() dto: ActivateDeviceDto, @Req() request: Request) {
    await this.service.limitPublicActivation(request.socket.remoteAddress ?? 'unknown');
    return this.service.activate(actor ?? null, dto);
  }

  @Post('licenses/action-verification')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  requestActionVerification(@CurrentUser() actor: AuthPrincipal, @Body() dto: LicensingActionVerificationDto) {
    return this.service.requestActionVerification(actor, dto);
  }

  @Post('licenses/action-verification/resolve')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Resolve the licensing action an email token authorizes without consuming it' })
  @ApiOkResponse({ type: LicensingActionResolutionDto })
  @ApiForbiddenResponse()
  @ApiUnauthorizedResponse()
  resolveActionVerification(@CurrentUser() actor: AuthPrincipal, @Body() dto: ResolveLicensingActionDto) {
    return this.service.resolveActionVerification(actor, dto.actionToken);
  }

  @Get('commands/:commandId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('CUSTOMER', 'PROVIDER_ADMIN')
  @ApiOkResponse({ type: Phase6CommandStatusDto })
  commandStatus(@CurrentUser() actor: AuthPrincipal, @Param('commandId', ParseUUIDPipe) commandId: string) {
    return this.service.commandStatus(actor, commandId);
  }

  @Post('licenses/:licenseId/devices/:deviceId/revoke')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiCreatedResponse({ type: LicenseDeviceDto })
  revokeDevice(
    @CurrentUser() actor: AuthPrincipal,
    @Param('licenseId', ParseUUIDPipe) licenseId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() dto: RevokeDeviceDto,
  ) {
    return this.service.revokeDevice(actor, licenseId, deviceId, dto);
  }

  @Post('licenses/:licenseId/devices/:deviceId/remote-revoke')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiCreatedResponse({ type: LicenseDeviceDto })
  remoteRevokeDevice(
    @CurrentUser() actor: AuthPrincipal,
    @Param('licenseId', ParseUUIDPipe) licenseId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() dto: RemoteRevokeDeviceDto,
  ) {
    return this.service.remoteRevokeDevice(actor, licenseId, deviceId, dto);
  }

  @Post('licenses/:licenseId/activation-key/rotate')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiCreatedResponse({ type: Phase6CommandDto })
  rotate(
    @CurrentUser() actor: AuthPrincipal,
    @Param('licenseId', ParseUUIDPipe) licenseId: string,
    @Body() dto: RotateActivationKeyDto,
  ) {
    return this.service.rotate(actor, licenseId, dto);
  }

  @Post('licenses/:licenseId/activation-key/recover')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiCreatedResponse({ type: Phase6CommandDto })
  recoverActivationKey(
    @CurrentUser() actor: AuthPrincipal,
    @Param('licenseId', ParseUUIDPipe) licenseId: string,
    @Body() dto: ActivationKeyRecoveryDto,
  ) {
    return this.service.recoverActivationKey(actor, licenseId, dto);
  }

  @Post('licenses/:licenseId/lifecycle')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PROVIDER_ADMIN')
  @ApiCreatedResponse({ type: Phase6CommandDto })
  lifecycle(
    @CurrentUser() actor: AuthPrincipal,
    @Param('licenseId', ParseUUIDPipe) licenseId: string,
    @Body() dto: LicenseLifecycleDto,
  ) {
    return this.service.lifecycle(actor, licenseId, dto);
  }

  @Post('entitlements/issue')
  @UseGuards(OptionalAuthGuard)
  @ApiCreatedResponse({ type: EntitlementDto })
  issueEntitlement(@CurrentUser() actor: AuthPrincipal | undefined, @Body() dto: EntitlementRefreshDto) {
    return this.service.issueEntitlement(actor ?? null, dto);
  }

  @Post('entitlements/refresh')
  @UseGuards(OptionalAuthGuard)
  @ApiCreatedResponse({ type: EntitlementDto })
  refreshEntitlement(@CurrentUser() actor: AuthPrincipal | undefined, @Body() dto: EntitlementRefreshDto) {
    return this.service.refreshEntitlement(actor ?? null, dto);
  }

  @Post('entitlements/verify')
  @UseGuards(OptionalAuthGuard)
  @ApiOkResponse({ type: EntitlementValidationDto })
  verifyEntitlement(@CurrentUser() actor: AuthPrincipal | undefined, @Body() dto: EntitlementVerifyDto) {
    return this.service.verifyEntitlement(actor ?? null, dto);
  }
}
