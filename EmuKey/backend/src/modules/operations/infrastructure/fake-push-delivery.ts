import type { DeliveryReceipt } from '../application/ports/email-delivery.port.js';
import type {
  PushDeliveryInput,
  PushDeliveryPort,
} from '../application/ports/push-delivery.port.js';

export class FakePushDelivery implements PushDeliveryPort {
  deliver(input: PushDeliveryInput): Promise<DeliveryReceipt> {
    return Promise.resolve({
      providerMessageId: `fake-push-${input.eventKey}`,
    });
  }
}
