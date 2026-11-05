export type PaymentRetryReason =
  | 'READY'
  | 'ATTEMPT_PENDING'
  | 'PAYMENT_REVIEW'
  | 'ORDER_NOT_PAYABLE';

export interface PaymentRetryDecision {
  readonly customerNextAction: 'WAIT' | 'VIEW_LICENSE' | 'CONTACT_SUPPORT' | 'CREATE_NEW_ORDER';
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
  readonly hasOpenReview?: boolean;
}

export function evaluatePaymentRetry(input: PaymentRetryInput): PaymentRetryDecision {
  if (input.orderStatus !== 'WAITING_PAYMENT' || input.paymentDueAt <= input.now) {
    return { allowed: false, canResume: false, reason: 'ORDER_NOT_PAYABLE', customerNextAction: input.orderStatus === 'PAYMENT_ACCEPTED' ? 'VIEW_LICENSE' : input.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' ? 'WAIT' : 'CREATE_NEW_ORDER' };
  }
  if (input.hasUncertainTransaction || input.attempts.some((attempt) =>
    !['PENDING', 'FAILED', 'EXPIRED'].includes(attempt.status))) {
    return { allowed: false, canResume: false, reason: 'PAYMENT_REVIEW', customerNextAction: input.hasOpenReview ? 'WAIT' : 'CONTACT_SUPPORT' };
  }
  const pending = input.attempts.filter((attempt) => attempt.status === 'PENDING');
  if (pending.length) {
    return { allowed: false, canResume: pending.length === 1 && pending[0]!.expiresAt > input.now, reason: 'ATTEMPT_PENDING', customerNextAction: 'WAIT' };
  }
  return { allowed: true, canResume: false, reason: 'READY', customerNextAction: 'WAIT' };
}
