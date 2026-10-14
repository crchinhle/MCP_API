export type PaymentRetryReason =
  | 'READY'
  | 'ATTEMPT_PENDING'
  | 'PAYMENT_REVIEW'
  | 'ORDER_NOT_PAYABLE';

export interface PaymentRetryDecision {
  readonly allowed: boolean;
  readonly canResume: boolean;
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
    return { allowed: false, canResume: false, reason: 'ORDER_NOT_PAYABLE' };
  }
  if (input.hasUncertainTransaction || input.attempts.some((attempt) =>
    !['PENDING', 'FAILED', 'EXPIRED'].includes(attempt.status))) {
    return { allowed: false, canResume: false, reason: 'PAYMENT_REVIEW' };
  }
  const pending = input.attempts.filter((attempt) => attempt.status === 'PENDING');
  if (pending.length) {
    return { allowed: false, canResume: pending.length === 1 && pending[0]!.expiresAt > input.now, reason: 'ATTEMPT_PENDING' };
  }
  return { allowed: true, canResume: false, reason: 'READY' };
}
