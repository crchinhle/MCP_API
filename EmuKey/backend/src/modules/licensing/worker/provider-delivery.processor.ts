import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ProviderHandoffService } from '../application/provider-handoff.service.js';

export const PROVIDER_DELIVERY_QUEUE = 'provider-license-delivery';

@Processor(PROVIDER_DELIVERY_QUEUE)
export class ProviderDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(ProviderDeliveryProcessor.name);
  constructor(private readonly service: ProviderHandoffService) {
    super();
  }
  async process() {
    let count = 0;
    while (count < 20 && (await this.service.runOne())) count++;
    if (count) this.logger.log({ event: 'provider.delivery.batch', count });
  }
}
