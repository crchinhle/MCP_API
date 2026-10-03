import {
  PAYMENT_IPN_PROTOCOL_VERSION,
  type PaymentGatewayPort,
  type CheckoutSession,
  type CreateCheckoutInput,
} from '../application/ports/payment-gateway.port.js';

export class FakePaymentGateway implements PaymentGatewayPort {
  constructor(private readonly webhookSecret = 'local-fake-payment-secret') {}

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    return Promise.resolve({
      checkoutFields: {},
      checkoutMethod: 'POST',
      checkoutReference: input.checkoutReference,
      checkoutUrl: `http://localhost:3000/fake-checkout/${input.attemptId}`,
    });
  }

  verifyIpn(input: import('../application/ports/payment-gateway.port.js').PaymentIpnInput): Promise<import('../application/ports/payment-gateway.port.js').VerifiedPaymentEvent> {
    if (input.signature !== this.webhookSecret) {
      return Promise.reject(new Error('INVALID_PAYMENT_SIGNATURE'));
    }
    const payload = input.payload as Record<string, unknown>;
    if (
      typeof payload.eventId !== 'string' ||
      typeof payload.providerReference !== 'string' ||
      !Number.isSafeInteger(payload.amountVnd) ||
      Number(payload.amountVnd) <= 0 ||
      typeof payload.occurredAt !== 'string'
    ) {
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
