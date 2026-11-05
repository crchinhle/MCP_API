import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { AssistanceSupportService } from '../assistance-support.service.js';
import { Redis } from 'ioredis';

@Injectable()
export class SupportLeaseScheduler implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(SupportLeaseScheduler.name);
  constructor(
    private readonly service: AssistanceSupportService,
    private readonly redis: Redis,
  ) {}
  onModuleInit() {
    void this.poll();
    this.timer = setInterval(() => {
      void this.poll();
    }, 30_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  private async poll() {
    if (this.running) return;
    this.running = true;
    try {
      const count = await this.service.requeueExpiredClaims();
      await this.redis.set(
        'emukey:worker:support-leases',
        new Date().toISOString(),
        'EX',
        90,
      );
      if (count) this.logger.log({ event: 'support.claims.requeued', count });
    } catch {
      this.logger.error({ event: 'support.lease.poll.failed' });
    } finally {
      this.running = false;
    }
  }
}
