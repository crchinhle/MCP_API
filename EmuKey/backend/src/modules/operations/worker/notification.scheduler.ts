import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { NOTIFICATION_QUEUE } from './notification.processor.js';
import { NotificationRepository } from '../infrastructure/notification.repository.js';

@Injectable()
export class NotificationScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private readonly logger = new Logger(NotificationScheduler.name);
  private readonly recoverPoller = () => {
    this.remindExpiry();
    void this.registerPoller()
      .then(() => this.logger.log({ event: 'notification.poller.ready' }))
      .catch(() => this.logger.error({ event: 'notification.poller.restore.failed' }));
  };
  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue,
    private readonly repository: NotificationRepository,
    private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    this.redis.on('ready', this.recoverPoller);
    this.remindExpiry();
    this.timer = setInterval(() => this.remindExpiry(), 3_600_000);
    this.timer.unref();
    await this.registerPoller();
  }

  private remindExpiry(): void {
    void this.repository
      .createExpiryReminders()
      .then(() => this.redis.set('emukey:worker:expiry', new Date().toISOString(), 'EX', 7200))
      .catch(() => this.logger.error({ event: 'notification.expiry.poll.failed' }));
  }

  private async registerPoller(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'durable-notification-poller',
      { every: 1_000 },
      {
        name: 'poll-postgres',
        data: {},
        opts: { removeOnComplete: 100, removeOnFail: 100 },
      },
    );
  }
  onModuleDestroy() {
    this.redis.off('ready', this.recoverPoller);
    if (this.timer) clearInterval(this.timer);
  }
}
