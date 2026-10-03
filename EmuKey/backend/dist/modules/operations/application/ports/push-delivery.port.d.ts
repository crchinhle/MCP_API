import type { DeliveryReceipt } from './email-delivery.port.js';
export declare const PUSH_DELIVERY: unique symbol;
export interface PushDeliveryInput {
    body: string;
    data: Record<string, unknown>;
    eventKey: string;
    title: string;
    token: string;
}
export interface PushDeliveryPort {
    deliver(input: PushDeliveryInput): Promise<DeliveryReceipt>;
}
