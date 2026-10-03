import { type PaymentGatewayPort, type CheckoutSession, type CreateCheckoutInput } from '../application/ports/payment-gateway.port.js';
export declare class FakePaymentGateway implements PaymentGatewayPort {
    private readonly webhookSecret;
    constructor(webhookSecret?: string);
    createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
    verifyIpn(input: import('../application/ports/payment-gateway.port.js').PaymentIpnInput): Promise<import('../application/ports/payment-gateway.port.js').VerifiedPaymentEvent>;
}
