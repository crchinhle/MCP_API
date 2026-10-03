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

export function clearCheckoutIntent(accountId: string | null | undefined): void {
  if (!accountId) return;
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(keyFor(accountId));
  } catch {
    // Ignore storage failures; the intent is only a resume convenience.
  }
}