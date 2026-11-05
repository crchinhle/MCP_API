import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiProperty,
} from '@nestjs/swagger';
import { Redis } from 'ioredis';
import { Roles } from '../../identity-access/security.decorators.js';
import {
  AuthGuard,
  RolesGuard,
} from '../../identity-access/security.guards.js';
import { NotificationRepository } from '../infrastructure/notification.repository.js';

class WorkerLivenessDto {
  @ApiProperty({ enum: ['UP', 'DOWN', 'UNKNOWN'] }) notifications!: string;
  @ApiProperty({ enum: ['UP', 'DOWN', 'UNKNOWN'] }) supportLeases!: string;
  @ApiProperty({ enum: ['UP', 'DOWN', 'UNKNOWN'] }) expiry!: string;
}
class AssistanceBacklogDto {
  @ApiProperty() supportActive!: number;
  @ApiProperty() waitingSupport!: number;
}
class NotificationBacklogDto {
  @ApiProperty() deadLetter!: number;
  @ApiProperty() pending!: number;
  @ApiProperty() retryableFailed!: number;
}
export class OperationsHealthDto {
  @ApiProperty({ type: WorkerLivenessDto }) workers!: WorkerLivenessDto;
  @ApiProperty({ type: AssistanceBacklogDto })
  conversations!: AssistanceBacklogDto;
  @ApiProperty({ type: NotificationBacklogDto })
  notifications!: NotificationBacklogDto;
}

@ApiTags('operations')
@Controller('operations/health')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SYSTEM_ADMIN', 'SUPPORT_STAFF')
@ApiBearerAuth()
export class OperationsHealthController {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly redis: Redis,
  ) {}

  @Get('assistance')
  @ApiOkResponse({ type: OperationsHealthDto })
  async assistance() {
    const backlog = await this.notifications.healthSummary();
    const heartbeat = await this.redis
      .mget(
        'emukey:worker:notifications',
        'emukey:worker:support-leases',
        'emukey:worker:expiry',
      )
      .catch(() => null);
    const now = Date.now();
    // A restored Redis key can outlive the worker heartbeat it contains.
    const maxAgeMs = [30_000, 90_000, 7_200_000];
    const state = (index: number): 'UP' | 'DOWN' | 'UNKNOWN' => {
      if (heartbeat === null) return 'UNKNOWN';
      const value = heartbeat[index];
      if (!value) return 'DOWN';
      const timestamp = Date.parse(value);
      if (!Number.isFinite(timestamp) || timestamp > now + 5_000) return 'UNKNOWN';
      return now - timestamp < maxAgeMs[index]! ? 'UP' : 'DOWN';
    };
    return {
      ...backlog,
      workers: {
        notifications: state(0),
        supportLeases: state(1),
        expiry: state(2),
      },
    };
  }
}
