import { randomUUID } from 'node:crypto';
import {
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { CatalogAiRepository } from '../infrastructure/catalog-ai.repository.js';

/** Trusted worker only. Publication changes are discovered by content hash; inference never indexes. */
export class AiCatalogIndexer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiCatalogIndexer.name);
  private timer?: ReturnType<typeof setInterval>;
  private inFlight: Promise<void> | undefined;
  private stopped = false;
  constructor(
    private readonly repository: CatalogAiRepository,
    private readonly redis: Redis,
  ) {}
  onModuleInit() {
    void this.poll();
    this.timer = setInterval(() => void this.poll(), 60000);
    this.timer.unref();
  }
  poll(): Promise<void> {
    if (this.stopped || this.inFlight) return Promise.resolve();
    this.inFlight = this.run().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }
  private async run(): Promise<void> {
    const key = 'ai:catalog:indexer:lease';
    const token = randomUUID();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let owned = false;
    try {
      if (!(await this.redis.set(key, token, 'EX', 300, 'NX'))) return;
      owned = true;
      heartbeat = setInterval(() => {
        void this.redis
          .eval(
            "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('expire',KEYS[1],300) else return 0 end",
            1,
            key,
            token,
          )
          .catch(() =>
            this.logger.warn({ event: 'ai.catalog.index_lease_error' }),
          );
      }, 60000);
      heartbeat.unref();
      await this.repository.reindex();
    } catch {
      this.logger.warn({ event: 'ai.catalog.index_retry_pending' });
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (owned)
        await this.redis
          .eval(
            "if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
            1,
            key,
            token,
          )
          .catch(() =>
            this.logger.warn({ event: 'ai.catalog.index_lease_release_error' }),
          );
    }
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }
}
