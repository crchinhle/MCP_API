import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ProviderHandoffModule } from './provider-handoff.module.js';
import {
  ProviderDeliveryProcessor,
  PROVIDER_DELIVERY_QUEUE,
} from './worker/provider-delivery.processor.js';
import { ProviderDeliveryScheduler } from './worker/provider-delivery.scheduler.js';

@Module({
  imports: [
    ProviderHandoffModule,
    BullModule.registerQueue({ name: PROVIDER_DELIVERY_QUEUE }),
  ],
  providers: [ProviderDeliveryProcessor, ProviderDeliveryScheduler],
})
export class LicensingWorkerModule {}
