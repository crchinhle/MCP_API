import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

import type { ReadinessProbe } from './platform-readiness.service.js';

@Injectable()
export class PostgresReadinessProbe
  implements ReadinessProbe
{
  readonly name = 'postgres';

  constructor(private readonly pool: Pool) {}

  async check(): Promise<void> {
    await this.pool.query('SELECT 1');
  }
}
