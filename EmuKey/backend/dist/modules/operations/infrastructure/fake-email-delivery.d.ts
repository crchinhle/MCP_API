import type { DeliveryReceipt, EmailDeliveryInput, EmailDeliveryPort } from '../application/ports/email-delivery.port.js';
export declare class FakeEmailDelivery implements EmailDeliveryPort {
    deliver(input: EmailDeliveryInput): Promise<DeliveryReceipt>;
}
