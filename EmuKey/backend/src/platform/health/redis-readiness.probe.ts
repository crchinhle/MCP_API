import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

import type { ReadinessProbe } from './platform-readiness.service.js';

@Injectable()
export class RedisReadinessProbe
  implements ReadinessProbe
{
  readonly name = 'redis';

  constructor(private readonly client: Redis) {}

  async check(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
    await this.client.ping();
  }
}
