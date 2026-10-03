import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommerceModule } from './modules/commerce-payment/commerce.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';
import { ORDER_TIMEOUT_QUEUE, OrderTimeoutProcessor } from './modules/commerce-payment/worker/order-timeout.processor.js';

import { PlatformCoreModule } from './platform/platform-core.module.js';
import { BlockchainModule } from './modules/blockchain/blockchain.module.js';
import { BlockchainWorkerModule } from './modules/blockchain/blockchain-worker.module.js';

const workerImports =
  process.env.NODE_ENV === 'test'
    ? [BlockchainModule]
    : [BlockchainWorkerModule, CommerceModule, OperationsModule, BullModule.registerQueue({ name: ORDER_TIMEOUT_QUEUE })];

@Module({
  imports: [PlatformCoreModule, ...workerImports],
  providers: process.env.NODE_ENV === 'test' ? [] : [OrderTimeoutProcessor],
})
export class WorkerModule {}
