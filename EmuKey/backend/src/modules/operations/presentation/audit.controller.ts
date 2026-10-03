import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../../identity-access/security.guards.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { AuditService } from '../application/audit.service.js';
import { AuditPageDto, AuditQueryDto } from './audit.dto.js';

@ApiTags('operations')
@Controller('operations/audit-logs')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SYSTEM_ADMIN')
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get()
  @ApiOkResponse({ type: AuditPageDto })
  list(@CurrentUser() actor: AuthPrincipal, @Query() query: AuditQueryDto) {
    return this.service.list(actor, query);
  }
}
