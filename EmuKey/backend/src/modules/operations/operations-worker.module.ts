import { AssistanceSupportModule } from '../assistance-support/assistance-support.module.js';
import { SupportLeaseScheduler } from '../assistance-support/worker/support-lease.scheduler.js';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OperationsModule } from './operations.module.js';
import { NotificationProcessor, NOTIFICATION_QUEUE } from './worker/notification.processor.js';
import { NotificationScheduler } from './worker/notification.scheduler.js';

@Module({
  imports: [OperationsModule, AssistanceSupportModule, BullModule.registerQueue({ name: NOTIFICATION_QUEUE })],
  providers: [NotificationProcessor, NotificationScheduler, SupportLeaseScheduler],
})
export class OperationsWorkerModule {}
