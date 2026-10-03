import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { BlockchainModule } from './blockchain.module.js';
import {
  ChainCommandProcessor,
  CHAIN_COMMAND_QUEUE,
} from './worker/chain-command.processor.js';
import { ChainCommandScheduler } from './worker/chain-command.scheduler.js';

@Module({
  imports: [
    BlockchainModule,
    BullModule.registerQueue({ name: CHAIN_COMMAND_QUEUE }),
  ],
  providers: [ChainCommandProcessor, ChainCommandScheduler],
})
export class BlockchainWorkerModule {}
