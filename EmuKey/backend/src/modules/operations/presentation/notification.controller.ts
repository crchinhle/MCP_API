import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { NotificationDto } from './notification.dto.js';

import { CurrentUser, Roles } from '../../identity-access/security.decorators.js';
import { AuthGuard, RolesGuard } from '../../identity-access/security.guards.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { NotificationService } from '../application/notification.service.js';
import { Body } from '@nestjs/common';
import { RegisterPushTokenDto } from './push-token.dto.js';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

class NotificationListQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
@Roles('CUSTOMER', 'SUPPORT_STAFF', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN')
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOkResponse({ schema: { type: 'object', properties: { items: { type: 'array', items: { $ref: '#/components/schemas/NotificationDto' } }, nextCursor: { type: 'string', nullable: true } } } })
  list(@CurrentUser() actor: AuthPrincipal, @Query() query: NotificationListQueryDto) {
    return this.service.list(actor, query.cursor, query.limit);
  }

  @Post(':notificationId/read')
  @ApiOkResponse({ type: NotificationDto })
  markRead(@CurrentUser() actor: AuthPrincipal, @Param('notificationId', ParseUUIDPipe) notificationId: string) { return this.service.markRead(actor, notificationId); }

  @Post('push-tokens')
  registerPushToken(@CurrentUser() actor: AuthPrincipal, @Body() dto: RegisterPushTokenDto) { return this.service.registerPushToken(actor, dto.token, dto.provider); }

  @Post('push-tokens/remove')
  unregisterPushToken(@CurrentUser() actor: AuthPrincipal, @Body() dto: Pick<RegisterPushTokenDto, 'token'>) { return this.service.unregisterPushToken(actor, dto.token); }
}
