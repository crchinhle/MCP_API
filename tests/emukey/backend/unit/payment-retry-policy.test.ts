import { describe, expect, it } from 'vitest';
import { evaluatePaymentRetry } from '../../../../EmuKey/backend/src/modules/commerce-payment/domain/payment-retry-policy.js';

const now = new Date('2026-10-12T12:00:00.000Z');

function policyInput(overrides: Partial<Parameters<typeof evaluatePaymentRetry>[0]> = {}) {
  return {
    orderStatus: 'WAITING_PAYMENT',
    paymentDueAt: new Date('2026-10-12T13:00:00.000Z'),
    now,
    attempts: [],
    hasUncertainTransaction: false,
    ...overrides,
  };
}

describe('evaluatePaymentRetry', () => {
  it('allows a new attempt when the previous attempt definitively failed', () => {
    expect(evaluatePaymentRetry(policyInput({
      attempts: [{ status: 'FAILED', expiresAt: new Date('2026-10-12T12:15:00.000Z') }],
    }))).toEqual({ allowed: true, reason: 'READY' });
  });

  it('allows a new attempt when previous attempts expired without transaction evidence', () => {
    expect(evaluatePaymentRetry(policyInput({
      attempts: [{ status: 'EXPIRED', expiresAt: new Date('2026-10-12T11:59:00.000Z') }],
    }))).toEqual({ allowed: true, reason: 'READY' });
  });

  it('blocks while any attempt is still pending and unexpired', () => {
    expect(evaluatePaymentRetry(policyInput({
      attempts: [{ status: 'PENDING', expiresAt: new Date('2026-10-12T12:15:00.000Z') }],
    }))).toEqual({ allowed: false, reason: 'ATTEMPT_PENDING' });
  });

  it('does not infer failure from an elapsed checkout window', () => {
    expect(evaluatePaymentRetry(policyInput({
      attempts: [{ status: 'PENDING', expiresAt: new Date('2026-10-12T11:59:00.000Z') }],
    }))).toEqual({ allowed: false, reason: 'ATTEMPT_PENDING' });
  });

  it.each(['SUPERSEDED', 'UNKNOWN'])('fails closed for unresolved attempt status %s', (status) => {
    expect(evaluatePaymentRetry(policyInput({
      attempts: [{ status, expiresAt: new Date('2026-10-12T11:59:00.000Z') }],
    }))).toEqual({ allowed: false, reason: 'PAYMENT_REVIEW' });
  });

  it('blocks a succeeded attempt while the order projection is stale', () => {
    expect(evaluatePaymentRetry(policyInput({
      attempts: [{ status: 'SUCCEEDED', expiresAt: new Date('2026-10-12T12:15:00.000Z') }],
    }))).toEqual({ allowed: false, reason: 'PAYMENT_REVIEW' });
  });

  it('blocks if transaction evidence is ambiguous despite a failed attempt', () => {
    expect(evaluatePaymentRetry(policyInput({
      attempts: [{ status: 'FAILED', expiresAt: new Date('2026-10-12T12:15:00.000Z') }],
      hasUncertainTransaction: true,
    }))).toEqual({ allowed: false, reason: 'PAYMENT_REVIEW' });
  });

  it.each(['PAYMENT_ACCEPTED', 'CANCELLED', 'EXPIRED'])('blocks order status %s', (orderStatus) => {
    expect(evaluatePaymentRetry(policyInput({ orderStatus }))).toEqual({
      allowed: false,
      reason: 'ORDER_NOT_PAYABLE',
    });
  });

  it('blocks after the payment deadline', () => {
    expect(evaluatePaymentRetry(policyInput({
      now: new Date('2026-10-12T13:00:00.000Z'),
    }))).toEqual({ allowed: false, reason: 'ORDER_NOT_PAYABLE' });
  });
});
