import type {
  DeliveryReceipt,
  EmailDeliveryInput,
  EmailDeliveryPort,
} from '../application/ports/email-delivery.port.js';

export class FakeEmailDelivery implements EmailDeliveryPort {
  deliver(input: EmailDeliveryInput): Promise<DeliveryReceipt> {
    return Promise.resolve({
      providerMessageId: `fake-email-${input.eventKey}`,
    });
  }
}
