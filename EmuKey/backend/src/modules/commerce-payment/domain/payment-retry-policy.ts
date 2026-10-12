export type PaymentRetryReason =
  | 'READY'
  | 'ATTEMPT_PENDING'
  | 'PAYMENT_REVIEW'
  | 'ORDER_NOT_PAYABLE';

export interface PaymentRetryDecision {
  readonly allowed: boolean;
  readonly reason: PaymentRetryReason;
}

export interface PaymentRetryInput {
  readonly orderStatus: string;
  readonly paymentDueAt: Date;
  readonly now: Date;
  readonly attempts: readonly {
    readonly status: string;
    readonly expiresAt: Date;
  }[];
  readonly hasUncertainTransaction: boolean;
}

export function evaluatePaymentRetry(input: PaymentRetryInput): PaymentRetryDecision {
  if (input.orderStatus !== 'WAITING_PAYMENT' || input.paymentDueAt <= input.now) {
    return { allowed: false, reason: 'ORDER_NOT_PAYABLE' };
  }
  if (input.hasUncertainTransaction || input.attempts.some((attempt) =>
    !['PENDING', 'FAILED', 'EXPIRED'].includes(attempt.status))) {
    return { allowed: false, reason: 'PAYMENT_REVIEW' };
  }
  if (input.attempts.some((attempt) =>
    attempt.status === 'PENDING')) {
    return { allowed: false, reason: 'ATTEMPT_PENDING' };
  }
  return { allowed: true, reason: 'READY' };
}
