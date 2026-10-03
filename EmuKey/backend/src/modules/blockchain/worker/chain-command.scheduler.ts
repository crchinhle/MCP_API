import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { CHAIN_COMMAND_QUEUE } from './chain-command.processor.js';

@Injectable()
export class ChainCommandScheduler implements OnModuleInit {
  constructor(
    @InjectQueue(CHAIN_COMMAND_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'durable-chain-command-poller',
      { every: 1_000 },
      {
        name: 'poll-postgres',
        data: {},
        opts: { removeOnComplete: 100, removeOnFail: 100 },
      },
    );
  }
}
