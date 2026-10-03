import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { NOTIFICATION_QUEUE } from './notification.processor.js';

@Injectable()
export class NotificationScheduler implements OnModuleInit {
  constructor(@InjectQueue(NOTIFICATION_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'durable-notification-poller',
      { every: 1_000 },
      { name: 'poll-postgres', data: {}, opts: { removeOnComplete: 100, removeOnFail: 100 } },
    );
  }
}
