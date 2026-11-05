import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { PROVIDER_DELIVERY_QUEUE } from './provider-delivery.processor.js';

@Injectable()
export class ProviderDeliveryScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProviderDeliveryScheduler.name);
  private readonly restore = () => {
    void this.register().catch(() =>
      this.logger.error({ event: 'provider.delivery.scheduler.failed' }),
    );
  };
  constructor(
    @InjectQueue(PROVIDER_DELIVERY_QUEUE) private readonly queue: Queue,
    private readonly redis: Redis,
  ) {}
  async onModuleInit() {
    this.redis.on('ready', this.restore);
    await this.register();
  }
  private async register() {
    await this.queue.upsertJobScheduler(
      'provider-postgres-poller',
      { every: 2000 },
      {
        name: 'poll-postgres',
        data: {},
        opts: { removeOnComplete: 20, removeOnFail: 20 },
      },
    );
  }
  onModuleDestroy() {
    this.redis.off('ready', this.restore);
  }
}
