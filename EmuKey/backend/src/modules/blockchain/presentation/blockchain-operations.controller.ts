import { Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../identity-access/security.decorators.js';
import { CurrentUser } from '../../identity-access/security.decorators.js';
import {
  AuthGuard,
  RolesGuard,
} from '../../identity-access/security.guards.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { BlockchainReconciliationService } from '../application/blockchain-reconciliation.service.js';
import { BlockchainReconciliationDto, DeadLetterRecoveryDto } from './blockchain-reconciliation.dto.js';
import { Phase6CommandDto } from '../../licensing/licensing.dto.js';

@ApiTags('operations')
@Controller('operations/blockchain')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SYSTEM_ADMIN')
@ApiBearerAuth()
export class BlockchainOperationsController {
  constructor(
    private readonly reconciliation: BlockchainReconciliationService,
  ) {}

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: BlockchainReconciliationDto })
  reconcile(@CurrentUser() actor: AuthPrincipal) {
    return this.reconciliation.run(actor);
  }

  @Post('dead-letters/:commandId/recover')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: Phase6CommandDto })
  async recoverDeadLetter(
    @CurrentUser() actor: AuthPrincipal,
    @Param('commandId', ParseUUIDPipe) commandId: string,
    @Body() dto: DeadLetterRecoveryDto,
  ) {
    const command = await this.reconciliation.recoverDeadLetter(actor, commandId, dto);
    return { commandId: command.commandId, licenseId: command.licenseId, status: command.status, deviceId: null };
  }
}
