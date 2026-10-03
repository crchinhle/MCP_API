import { timingSafeEqual } from 'node:crypto';

import { SePayPgClient } from 'sepay-pg-node';

import {
  PAYMENT_IPN_PROTOCOL_VERSION,
  type CheckoutSession,
  type CreateCheckoutInput,
  type PaymentGatewayPort,
  type PaymentIpnInput,
  type VerifiedPaymentEvent,
} from '../application/ports/payment-gateway.port.js';

export interface SePayPaymentGatewayOptions {
  environment: 'production' | 'sandbox';
  merchantId: string;
  secretKey: string;
  webAppUrl: string;
  sandboxClockOffsetSeconds?: number;
  sandboxReceiptTiming?: boolean;
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_PAYMENT_PAYLOAD');
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('INVALID_PAYMENT_PAYLOAD');
  }
  return value.trim();
}

function positiveVnd(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('INVALID_PAYMENT_PAYLOAD');
  }
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('INVALID_PAYMENT_PAYLOAD');
  }
  return amount;
}

function parseTransactionDate(value: unknown): Date {
  const match = typeof value === 'string'
    ? value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
    : null;
  if (!match) {
    throw new Error('INVALID_PAYMENT_PAYLOAD');
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  // SePay transaction_date is Vietnam local time, not a JavaScript host-local
  // timestamp. Convert explicitly to UTC for timestamptz/window comparisons.
  const occurredAt = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
  if (Number.isNaN(occurredAt.getTime())) throw new Error('INVALID_PAYMENT_PAYLOAD');
  return occurredAt;
}

function equalSecret(provided: string | undefined, expected: string): boolean {
  if (provided === undefined) return false;
  const actualBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function resultUrl(
  webAppUrl: string,
  orderId: string,
  result: 'cancel' | 'error' | 'success',
): string {
  const url = new URL(
    `/buyer/orders/${encodeURIComponent(orderId)}/payment`,
    webAppUrl,
  );
  url.searchParams.set('sepay', result);
  return url.toString();
}

export class SePayPaymentGateway implements PaymentGatewayPort {
  private readonly client: SePayPgClient;
  readonly sandboxReceiptTiming: boolean;

  constructor(private readonly options: SePayPaymentGatewayOptions) {
    this.sandboxReceiptTiming = options.sandboxReceiptTiming === true;
    if (this.sandboxReceiptTiming && (options.environment !== 'sandbox' || process.env.NODE_ENV === 'production')) {
      throw new Error('SANDBOX_RECEIPT_TIMING_NOT_ALLOWED');
    }
    if (this.sandboxReceiptTiming && options.sandboxClockOffsetSeconds) {
      throw new Error('Sandbox receipt timing cannot be combined with a clock offset');
    }
    this.client = new SePayPgClient({
      env: options.environment,
      merchant_id: options.merchantId,
      secret_key: options.secretKey,
    });
  }

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const checkoutFields = this.client.checkout.initOneTimePaymentFields({
      operation: 'PURCHASE',
      payment_method: 'BANK_TRANSFER',
      order_invoice_number: input.checkoutReference,
      order_amount: input.amountVnd,
      currency: 'VND',
      order_description: `Emukey order ${input.orderId}`,
      success_url: resultUrl(this.options.webAppUrl, input.orderId, 'success'),
      error_url: resultUrl(this.options.webAppUrl, input.orderId, 'error'),
      cancel_url: resultUrl(this.options.webAppUrl, input.orderId, 'cancel'),
    });

    return Promise.resolve({
      checkoutFields: Object.fromEntries(
        Object.entries(checkoutFields).map(([name, value]) => [
          name,
          String(value),
        ]),
      ),
      checkoutMethod: 'POST',
      checkoutReference: input.checkoutReference,
      checkoutUrl: this.client.checkout.initCheckoutUrl(),
    });
  }

  verifyIpn(input: PaymentIpnInput): Promise<VerifiedPaymentEvent> {
    try {
      if (!equalSecret(input.signature, this.options.secretKey)) {
        throw new Error('INVALID_PAYMENT_SIGNATURE');
      }

      const payload = record(input.payload);
      const order = record(payload.order);
      const transaction = record(payload.transaction);
      if (
        payload.notification_type !== 'ORDER_PAID' ||
        order.order_status !== 'CAPTURED' ||
        order.order_currency !== 'VND' ||
        transaction.transaction_status !== 'APPROVED' ||
        transaction.transaction_type !== 'PAYMENT' ||
        transaction.transaction_currency !== 'VND'
      ) {
        throw new Error('INVALID_PAYMENT_PAYLOAD');
      }

      const amountVnd = positiveVnd(order.order_amount);
      if (positiveVnd(transaction.transaction_amount) !== amountVnd) {
        throw new Error('INVALID_PAYMENT_PAYLOAD');
      }
       const occurredAt = parseTransactionDate(transaction.transaction_date);
       if (this.options.environment === 'sandbox' && this.options.sandboxClockOffsetSeconds) {
         occurredAt.setTime(occurredAt.getTime() + this.options.sandboxClockOffsetSeconds * 1_000);
       }

       return Promise.resolve({
        ...(this.sandboxReceiptTiming ? { timingBasis: 'SANDBOX_RECEIPT' as const } : {}),
        amountVnd,
        eventId: nonEmptyString(transaction.id),
         occurredAt,
        protocolVersion: PAYMENT_IPN_PROTOCOL_VERSION,
        providerReference: nonEmptyString(order.order_invoice_number),
        transactionReference: nonEmptyString(transaction.transaction_id),
      });
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('INVALID_PAYMENT_PAYLOAD'));
    }
  }
}
