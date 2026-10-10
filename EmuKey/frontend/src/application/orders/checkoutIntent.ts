/**
 * Durable checkout intent for the buyer purchase flow.
 *
 * PAY-04 requires that mounting checkout never creates an order and that the
 * buyer's intent survives a reload. Only non-secret identifiers are persisted
 * (order id, plan id, product slug); activation keys, passwords, action tokens
 * and entitlements must never be stored here or in the URL.
 */

export interface CheckoutIntent {
  readonly orderId: string;
  readonly planId: string;
  readonly productSlug: string;
}

const STORAGE_PREFIX = 'emukey:checkout-intent:';
const IDEMPOTENCY_PREFIX = 'emukey:order-idempotency:';

interface PersistedIdempotencyKey {
  readonly operation: string;
  readonly key: string;
}

function operationPayload(operation: unknown): string {
  return JSON.stringify(operation);
}

function readIdempotencyPayload(accountId: string | null | undefined): PersistedIdempotencyKey | null {
  if (!accountId) return null;
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(`${IDEMPOTENCY_PREFIX}${accountId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedIdempotencyKey> | null;
    if (typeof parsed?.operation !== 'string' || typeof parsed.key !== 'string') return null;
    return { operation: parsed.operation, key: parsed.key };
  } catch {
    return null;
  }
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    // Storage can throw in privacy modes; the flow still works without it.
    return null;
  }
}

function keyFor(accountId: string): string {
  return `${STORAGE_PREFIX}${accountId}`;
}

export function readCheckoutIntent(accountId: string | null | undefined): CheckoutIntent | null {
  if (!accountId) return null;
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(keyFor(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckoutIntent> | null;
    if (!parsed || typeof parsed.orderId !== 'string' || typeof parsed.planId !== 'string') return null;
    return {
      orderId: parsed.orderId,
      planId: parsed.planId,
      productSlug: typeof parsed.productSlug === 'string' ? parsed.productSlug : '',
    };
  } catch {
    return null;
  }
}

export function writeCheckoutIntent(accountId: string | null | undefined, intent: CheckoutIntent): void {
  if (!accountId) return;
  const store = storage();
  if (!store) return;
  try {
    store.setItem(keyFor(accountId), JSON.stringify(intent));
  } catch {
    // A full or unavailable store must not block the purchase.
  }
}

export function clearCheckoutIntent(accountId: string | null | undefined, expectedOrderId?: string): void {
  if (!accountId) return;
  const store = storage();
  if (!store) return;
  try {
    if (expectedOrderId && readCheckoutIntent(accountId)?.orderId !== expectedOrderId) return;
    store.removeItem(keyFor(accountId));
  } catch {
    // Ignore storage failures; the intent is only a resume convenience.
  }
}

export function readOrderIdempotencyKey(accountId: string | null | undefined, operation: unknown): string | null {
  const persisted = readIdempotencyPayload(accountId);
  return persisted?.operation === operationPayload(operation) ? persisted.key : null;
}

export function createOrderIdempotencyKey(accountId: string | null | undefined, operation: unknown): string {
  const existing = readOrderIdempotencyKey(accountId, operation);
  if (existing) return existing;

  const key = crypto.randomUUID();
  const store = storage();
  if (accountId && store) {
    try {
      store.setItem(`${IDEMPOTENCY_PREFIX}${accountId}`, JSON.stringify({
        operation: operationPayload(operation),
        key,
      } satisfies PersistedIdempotencyKey));
    } catch {
      // The request remains safe for in-session retries when storage is unavailable.
    }
  }
  return key;
}

export function clearOrderIdempotencyKey(accountId: string | null | undefined): void {
  if (!accountId) return;
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(`${IDEMPOTENCY_PREFIX}${accountId}`);
  } catch {
    // Ignore storage failures; the idempotency key is only a retry convenience.
  }
}