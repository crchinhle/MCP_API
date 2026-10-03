import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import { ChainCommandService } from '../application/chain-command.service.js';
import { BlockchainReconciliationService } from '../application/blockchain-reconciliation.service.js';

export const CHAIN_COMMAND_QUEUE = 'chain-command-trigger';

@Processor(CHAIN_COMMAND_QUEUE, { concurrency: 1 })
export class ChainCommandProcessor extends WorkerHost {
  constructor(
    private readonly commands: ChainCommandService,
    private readonly reconciliation: BlockchainReconciliationService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const workerId = `bullmq:${job.id ?? 'scheduled'}`;
    await this.commands.processNext(workerId);
    await this.reconciliation.runAutomatic(workerId);
  }
}
