import { describe, expect, it } from 'vitest';

import { SePayPaymentGateway } from '../../../../EmuKey/backend/src/modules/commerce-payment/infrastructure/sepay-payment.gateway.js';

const gateway = new SePayPaymentGateway({
  environment: 'sandbox',
  merchantId: 'SP-TEST-EMUKEY',
  secretKey: 'sandbox-merchant-secret',
  webAppUrl: 'https://demo.emukey.test',
});
const sandboxOffsetGateway = new SePayPaymentGateway({
  environment: 'sandbox',
  merchantId: 'SP-TEST-EMUKEY',
  secretKey: 'sandbox-merchant-secret',
  webAppUrl: 'https://demo.emukey.test',
  sandboxClockOffsetSeconds: 143,
});

describe('SePayPaymentGateway', () => {
  it('selects database receipt timing only for explicitly enabled sandbox, retaining provider evidence', async () => {
    const receiptGateway = new SePayPaymentGateway({ environment: 'sandbox', merchantId: 'SP-TEST-EMUKEY', secretKey: 'sandbox-merchant-secret', webAppUrl: 'https://demo.emukey.test', sandboxReceiptTiming: true });
    const result = await receiptGateway.verifyIpn({ signature: 'sandbox-merchant-secret', payload: {
      notification_type: 'ORDER_PAID',
      order: { order_amount: '199000', order_currency: 'VND', order_invoice_number: 'attempt-1', order_status: 'CAPTURED' },
      transaction: { id: 'event-1', transaction_amount: '199000', transaction_currency: 'VND', transaction_id: 'bank-1', transaction_status: 'APPROVED', transaction_type: 'PAYMENT', transaction_date: '2026-09-28 16:30:34' },
    } });
    expect(result).toMatchObject({ timingBasis: 'SANDBOX_RECEIPT', occurredAt: new Date('2026-09-28T09:30:34Z') });
    expect(() => new SePayPaymentGateway({ environment: 'production', merchantId: 'merchant', secretKey: 'secret', webAppUrl: 'https://demo.emukey.test', sandboxReceiptTiming: true })).toThrow('SANDBOX_RECEIPT_TIMING_NOT_ALLOWED');
  });
  it('creates a signed Sandbox checkout form without exposing the secret key', async () => {
    const checkout = await gateway.createCheckout({
      amountVnd: 199_000,
      attemptId: '959ded01-53f4-4b64-ae49-7f193c939b95',
      checkoutReference: '959ded01-53f4-4b64-ae49-7f193c939b95',
      orderId: '7f3ce9a4-7216-48ff-9b27-0ea22ec49c50',
    });

    expect(checkout).toMatchObject({
      checkoutMethod: 'POST',
      checkoutReference: '959ded01-53f4-4b64-ae49-7f193c939b95',
      checkoutUrl: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
      checkoutFields: {
        currency: 'VND',
        merchant: 'SP-TEST-EMUKEY',
        operation: 'PURCHASE',
        order_amount: '199000',
        order_invoice_number: '959ded01-53f4-4b64-ae49-7f193c939b95',
        payment_method: 'BANK_TRANSFER',
      },
    });
    expect(checkout.checkoutFields.signature).toBeTruthy();
    expect(JSON.stringify(checkout)).not.toContain('sandbox-merchant-secret');
    expect(checkout.checkoutFields.success_url).toBe(
      'https://demo.emukey.test/buyer/orders/7f3ce9a4-7216-48ff-9b27-0ea22ec49c50/payment?sepay=success',
    );
  });

  it('verifies and normalizes a successful SePay IPN', async () => {
    await expect(
      gateway.verifyIpn({
        signature: 'sandbox-merchant-secret',
        payload: {
          notification_type: 'ORDER_PAID',
          order: {
            id: 'sepay-order-id',
            order_amount: '199000.00',
            order_currency: 'VND',
            order_invoice_number: '959ded01-53f4-4b64-ae49-7f193c939b95',
            order_status: 'CAPTURED',
          },
           timestamp: 1_757_058_220,
           transaction: {
            id: 'sepay-event-id',
            transaction_amount: '199000',
            transaction_currency: 'VND',
            transaction_id: 'BANK-REFERENCE-001',
            transaction_status: 'APPROVED',
            transaction_type: 'PAYMENT',
            transaction_date: '2025-09-01 00:00:15',
          },
        },
      }),
    ).resolves.toEqual({
      amountVnd: 199_000,
      eventId: 'sepay-event-id',
       occurredAt: new Date('2025-08-31T17:00:15.000Z'),
      protocolVersion: 1,
      providerReference: '959ded01-53f4-4b64-ae49-7f193c939b95',
      transactionReference: 'BANK-REFERENCE-001',
    });
  });

  it('rejects an invalid IPN secret or a non-final payment payload', async () => {
    await expect(
      gateway.verifyIpn({ payload: {}, signature: 'wrong-secret' }),
    ).rejects.toThrow('INVALID_PAYMENT_SIGNATURE');

    await expect(
      gateway.verifyIpn({
        signature: 'sandbox-merchant-secret',
        payload: {
          notification_type: 'TRANSACTION_VOID',
          order: {},
          timestamp: 1_757_058_220,
          transaction: {},
        },
      }),
    ).rejects.toThrow('INVALID_PAYMENT_PAYLOAD');
  });

  it.each([
    ['2025-09-01 00:00:15', '2025-08-31T17:00:15.000Z'],
    ['2025-12-31 23:59:59', '2025-12-31T16:59:59.000Z'],
  ])('normalizes SePay Asia/Ho_Chi_Minh transaction time %s', async (transactionDate, expected) => {
    await expect(gateway.verifyIpn({
      signature: 'sandbox-merchant-secret',
      payload: {
        notification_type: 'ORDER_PAID',
        order: { order_amount: '199000', order_currency: 'VND', order_invoice_number: '959ded01-53f4-4b64-ae49-7f193c939b95', order_status: 'CAPTURED' },
        timestamp: 1_757_058_220,
        transaction: {
          id: 'sepay-event-time-vector', transaction_amount: '199000', transaction_currency: 'VND',
          transaction_id: 'BANK-REFERENCE-TIME', transaction_status: 'APPROVED', transaction_type: 'PAYMENT', transaction_date: transactionDate,
        },
      },
    })).resolves.toMatchObject({ occurredAt: new Date(expected) });
  });

  it('applies the explicitly configured sandbox-only clock correction at the adapter boundary', async () => {
    const result = await sandboxOffsetGateway.verifyIpn({
      signature: 'sandbox-merchant-secret',
      payload: {
        notification_type: 'ORDER_PAID',
        order: { order_amount: '199000', order_currency: 'VND', order_invoice_number: '959ded01-53f4-4b64-ae49-7f193c939b95', order_status: 'CAPTURED' },
        timestamp: 1_757_058_220,
        transaction: { id: 'sepay-event-offset', transaction_amount: '199000', transaction_currency: 'VND', transaction_id: 'BANK-REFERENCE-OFFSET', transaction_status: 'APPROVED', transaction_type: 'PAYMENT', transaction_date: '2025-09-01 00:00:15' },
      },
    });
    expect(result.occurredAt).toEqual(new Date('2025-08-31T17:02:38.000Z'));
  });

  it('rejects malformed transaction-local timestamps instead of using callback delivery time', async () => {
    await expect(gateway.verifyIpn({
      signature: 'sandbox-merchant-secret',
      payload: {
        notification_type: 'ORDER_PAID',
        order: { order_amount: '199000', order_currency: 'VND', order_invoice_number: '959ded01-53f4-4b64-ae49-7f193c939b95', order_status: 'CAPTURED' },
        timestamp: 1_757_058_220,
        transaction: { id: 'sepay-event-invalid-time', transaction_amount: '199000', transaction_currency: 'VND', transaction_id: 'BANK-REFERENCE-INVALID', transaction_status: 'APPROVED', transaction_type: 'PAYMENT', transaction_date: '2025-09-01T00:00:15Z' },
      },
    })).rejects.toThrow('INVALID_PAYMENT_PAYLOAD');
  });
});
