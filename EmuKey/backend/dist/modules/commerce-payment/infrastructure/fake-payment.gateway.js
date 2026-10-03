import { PAYMENT_IPN_PROTOCOL_VERSION, } from '../application/ports/payment-gateway.port.js';
export class FakePaymentGateway {
    webhookSecret;
    constructor(webhookSecret = 'local-fake-payment-secret') {
        this.webhookSecret = webhookSecret;
    }
    createCheckout(input) {
        return Promise.resolve({
            checkoutFields: {},
            checkoutMethod: 'POST',
            checkoutReference: input.checkoutReference,
            checkoutUrl: `http://localhost:3000/fake-checkout/${input.attemptId}`,
        });
    }
    verifyIpn(input) {
        if (input.signature !== this.webhookSecret) {
            return Promise.reject(new Error('INVALID_PAYMENT_SIGNATURE'));
        }
        const payload = input.payload;
        if (typeof payload.eventId !== 'string' ||
            typeof payload.providerReference !== 'string' ||
            !Number.isSafeInteger(payload.amountVnd) ||
            Number(payload.amountVnd) <= 0 ||
            typeof payload.occurredAt !== 'string') {
            return Promise.reject(new Error('INVALID_PAYMENT_PAYLOAD'));
        }
        const occurredAt = new Date(payload.occurredAt);
        if (Number.isNaN(occurredAt.getTime())) {
            return Promise.reject(new Error('INVALID_PAYMENT_PAYLOAD'));
        }
        return Promise.resolve({
            amountVnd: Number(payload.amountVnd),
            eventId: payload.eventId,
            occurredAt,
            protocolVersion: PAYMENT_IPN_PROTOCOL_VERSION,
            providerReference: payload.providerReference,
            ...(typeof payload.transactionReference === 'string'
                ? { transactionReference: payload.transactionReference }
                : {}),
        });
    }
}
//# sourceMappingURL=fake-payment.gateway.js.map