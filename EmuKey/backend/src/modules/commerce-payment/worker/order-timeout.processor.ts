import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { CommerceService } from '../application/commerce.service.js';

export const ORDER_TIMEOUT_QUEUE = 'order-timeout';

@Processor(ORDER_TIMEOUT_QUEUE, { concurrency: 1 })
export class OrderTimeoutProcessor extends WorkerHost implements OnModuleInit {

  constructor(
    @InjectQueue(ORDER_TIMEOUT_QUEUE) private readonly queue: Queue,
    private readonly commerce: CommerceService,
  ) { super(); }

  async onModuleInit(): Promise<void> {
    // https://docs.bullmq.io/guide/job-schedulers
    await this.queue.upsertJobScheduler('overdue-orders', { every: 15_000 }, {
      name: 'cancel-overdue-orders', data: {},
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 100, removeOnFail: 100 },
    });
  }

  async process(): Promise<void> {
    await this.commerce.cancelOverdueOrders();
  }
}
