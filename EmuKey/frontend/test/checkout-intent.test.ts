import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearCheckoutIntent, readCheckoutIntent, writeCheckoutIntent } from '../src/application/orders/checkoutIntent';

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

  it('ignores invalid persisted payloads', () => {
    sessionStorage.setItem('emukey:checkout-intent:account-1', JSON.stringify({ orderId: 42 }));
    expect(readCheckoutIntent(account)).toBeNull();
  });
});
