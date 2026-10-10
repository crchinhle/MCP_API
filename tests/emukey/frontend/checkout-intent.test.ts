import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearCheckoutIntent, readCheckoutIntent, writeCheckoutIntent } from '../../../EmuKey/frontend/src/application/orders/checkoutIntent';
import { createOrderIdempotencyKey, readOrderIdempotencyKey, clearOrderIdempotencyKey } from '../../../EmuKey/frontend/src/application/orders/checkoutIntent';

const account = 'account-1';
const otherAccount = 'account-2';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('checkoutIntent persistence', () => {
  it('round-trips the non-secret checkout intent', () => {
    writeCheckoutIntent(account, { orderId: 'order-1', planId: 'plan-1', productSlug: 'securedesk' });
    expect(readCheckoutIntent(account)).toEqual({ orderId: 'order-1', planId: 'plan-1', productSlug: 'securedesk' });
  });

  it('does not share intent across accounts', () => {
    writeCheckoutIntent(account, { orderId: 'order-1', planId: 'plan-1', productSlug: 'securedesk' });
    expect(readCheckoutIntent(otherAccount)).toBeNull();
  });

  it('clears the stored intent', () => {
    writeCheckoutIntent(account, { orderId: 'order-1', planId: 'plan-1', productSlug: 'securedesk' });
    clearCheckoutIntent(account);
    expect(readCheckoutIntent(account)).toBeNull();
  });

  it('does not clear a different order intent when payment confirmation arrives', () => {
    writeCheckoutIntent(account, { orderId: 'order-new', planId: 'plan-2', productSlug: 'cloudstudio-ai' });
    clearCheckoutIntent(account, 'order-old');
    expect(readCheckoutIntent(account)).toEqual({ orderId: 'order-new', planId: 'plan-2', productSlug: 'cloudstudio-ai' });
  });

  it('ignores invalid persisted payloads', () => {
    sessionStorage.setItem('emukey:checkout-intent:account-1', JSON.stringify({ orderId: 42 }));
    expect(readCheckoutIntent(account)).toBeNull();
  });

  it('retains one non-secret idempotency key for retrying the same exact request', () => {
    const first = createOrderIdempotencyKey(account, { planId: 'plan-1' });
    expect(readOrderIdempotencyKey(account, { planId: 'plan-1' })).toBe(first);
    expect(createOrderIdempotencyKey(account, { planId: 'plan-1' })).toBe(first);
    expect(readOrderIdempotencyKey(account, { planId: 'plan-2' })).toBeNull();
    expect(sessionStorage.getItem('emukey:order-idempotency:account-1')).toContain(first);
  });

  it('can clear the retry key after an acknowledged order creation', () => {
    createOrderIdempotencyKey(account, { planId: 'plan-1' });
    clearOrderIdempotencyKey(account);
    expect(readOrderIdempotencyKey(account, { planId: 'plan-1' })).toBeNull();
  });
});
