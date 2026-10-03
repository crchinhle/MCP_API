import type { DeliveryReceipt } from '../application/ports/email-delivery.port.js';
import type { PushDeliveryInput, PushDeliveryPort } from '../application/ports/push-delivery.port.js';
export declare class FakePushDelivery implements PushDeliveryPort {
    deliver(input: PushDeliveryInput): Promise<DeliveryReceipt>;
}
