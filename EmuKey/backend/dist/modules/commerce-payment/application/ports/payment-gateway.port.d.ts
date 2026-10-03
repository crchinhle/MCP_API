export declare const PAYMENT_GATEWAY: unique symbol;
export declare const PAYMENT_IPN_PROTOCOL_VERSION: 1;
export interface CreateCheckoutInput {
    amountVnd: number;
    attemptId: string;
    checkoutReference: string;
    orderId: string;
}
export interface CheckoutSession {
    checkoutFields: Record<string, string>;
    checkoutMethod: 'POST';
    checkoutReference: string;
    checkoutUrl: string;
}
export interface PaymentGatewayPort {
    readonly sandboxReceiptTiming?: boolean;
    createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
    verifyIpn(input: PaymentIpnInput): Promise<VerifiedPaymentEvent>;
}
export interface PaymentIpnInput {
    payload: unknown;
    signature?: string;
}
export interface VerifiedPaymentEvent {
    timingBasis?: 'SANDBOX_RECEIPT';
    amountVnd: number;
    eventId: string;
    occurredAt: Date;
    protocolVersion: typeof PAYMENT_IPN_PROTOCOL_VERSION;
    providerReference: string;
    transactionReference?: string;
}
