import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../../identity-access/security.guards.js';
import { NotificationRepository } from '../infrastructure/notification.repository.js';

@ApiTags('operations')
@Controller('operations/health')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SYSTEM_ADMIN', 'SUPPORT_STAFF')
@ApiBearerAuth()
export class OperationsHealthController {
  constructor(private readonly notifications: NotificationRepository) {}

  @Get('assistance')
  @ApiOkResponse()
  assistance() {
    return this.notifications.healthSummary();
  }
}
