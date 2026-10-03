export declare const EMAIL_DELIVERY: unique symbol;
export interface EmailDeliveryInput {
    data: Record<string, unknown>;
    eventKey: string;
    template: string;
    to: string;
}
export interface DeliveryReceipt {
    providerMessageId: string;
}
export interface EmailDeliveryPort {
    deliver(input: EmailDeliveryInput): Promise<DeliveryReceipt>;
}
