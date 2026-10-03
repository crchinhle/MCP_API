import { type CheckoutSession, type CreateCheckoutInput, type PaymentGatewayPort, type PaymentIpnInput, type VerifiedPaymentEvent } from '../application/ports/payment-gateway.port.js';
export interface SePayPaymentGatewayOptions {
    environment: 'production' | 'sandbox';
    merchantId: string;
    secretKey: string;
    webAppUrl: string;
    sandboxClockOffsetSeconds?: number;
    sandboxReceiptTiming?: boolean;
}
export declare class SePayPaymentGateway implements PaymentGatewayPort {
    private readonly options;
    private readonly client;
    readonly sandboxReceiptTiming: boolean;
    constructor(options: SePayPaymentGatewayOptions);
    createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
    verifyIpn(input: PaymentIpnInput): Promise<VerifiedPaymentEvent>;
}
