import { expect, test } from '@playwright/test';

const customer = {
  accessToken: 'purchase-modal-e2e',
  user: { id: 'purchase-customer', role: 'CUSTOMER', displayName: 'Buyer', email: 'buyer@example.test', status: 'ACTIVE' },
};

const product = {
  slug: 'securedesk',
  name: 'SecureDesk Pro',
  summary: 'Bảo vệ phần mềm desktop.',
  plans: [
    { id: 'plan-monthly', name: 'Gói tháng', priceVnd: 120000, maxActiveDevices: 2, durationMonths: 1, entitlements: { desktop: true } },
    { id: 'plan-yearly', name: 'Gói năm', priceVnd: 1200000, maxActiveDevices: 5, durationMonths: 12, entitlements: { desktop: true, prioritySupport: true } },
  ],
};

const order = {
  id: 'purchase-order',
  orderNumber: 'EMU-PURCHASE-TEST',
  orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE',
  orderType: 'NEW_PURCHASE',
  planId: 'plan-yearly',
  planNameSnapshot: 'Gói năm',
  productNameSnapshot: 'SecureDesk Pro',
  priceVndSnapshot: 1200000,
  billingCycleSnapshot: 'YEARLY',
  durationMonthsSnapshot: 12,
  maxActiveDevicesSnapshot: 5,
  entitlementsSnapshot: { desktop: true, prioritySupport: true },
  paymentDueAt: '2027-10-10T00:00:00.000Z',
  createdAt: '2026-10-10T00:00:00.000Z',
  currency: 'VND',
  customerUserId: customer.user.id,
  planCommitmentSnapshot: `0x${'ab'.repeat(32)}`,
  planVersionSnapshot: 1,
  productId: 'securedesk-product',
  providerNameSnapshot: 'EmuKey Provider',
  providerUserId: 'provider-user',
  serviceTermsVersionSnapshot: 'terms-v3',
  serviceTermsHashSnapshot: `0x${'cd'.repeat(32)}`,
};

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`purchase modal keeps selection and actions usable at ${width}px`, async ({ page }) => {
    let creates = 0;
    let termsAcceptances = 0;
    let checkoutPreparations = 0;
    let capturedCheckout: { method: string; body: string } | undefined;
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/v1', '');
      if (path === '/auth/refresh') return route.fulfill({ json: customer });
      if (path === '/products') return route.fulfill({ json: [product] });
      if (path === '/products/securedesk') return route.fulfill({ json: product });
      if (path === '/orders' && request.method() === 'POST') {
        creates++;
        expect(request.postDataJSON()).toEqual({ planId: 'plan-yearly' });
        return route.fulfill({ status: 201, json: order });
      }
      if (path === '/orders/purchase-order/service-terms') return route.fulfill({ json: {
        version: 'terms-v3', hash: order.serviceTermsHashSnapshot, content: 'Điều khoản của đơn hàng thử nghiệm.',
      } });
      if (path === '/orders/purchase-order/accept-service-terms' && request.method() === 'POST') {
        termsAcceptances++;
        expect(request.postDataJSON()).toEqual({ accepted: true, version: 'terms-v3', hash: order.serviceTermsHashSnapshot });
        return route.fulfill({ json: {
          ...order, orderStatus: 'WAITING_PAYMENT', serviceTermsAcceptedAt: '2026-10-10T00:01:00.000Z',
        } });
      }
      if (path === '/orders/purchase-order/checkout' && request.method() === 'POST') {
        checkoutPreparations++;
        return route.fulfill({ json: {
        amountVnd: order.priceVndSnapshot,
        attemptId: 'attempt-purchase-test',
        checkoutFields: { merchant: 'EM-TEST', order_amount: '1200000', signature: 'signed-test-fields' },
        checkoutMethod: 'POST',
        checkoutReference: 'EMU-CHECKOUT-TEST',
        checkoutUrl: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
        expiresAt: order.paymentDueAt,
        expiresWithOrder: true,
        } });
      }
      if (path === '/payments/history' || path === '/orders') return route.fulfill({ json: [] });
      return route.fulfill({ json: [] });
    });
    await page.route('https://pay-sandbox.sepay.vn/**', async (route) => {
      capturedCheckout = { method: route.request().method(), body: route.request().postData() ?? '' };
      await route.fulfill({ contentType: 'text/html', body: '<title>SePay test endpoint</title><h1>SePay POST received</h1>' });
    });

    await page.goto('/buyer/products/securedesk');
    await page.getByRole('button', { name: 'Mua ngay' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled();
    expect(creates).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const initialDialogBounds = await dialog.boundingBox();
    expect(initialDialogBounds).not.toBeNull();
    expect(initialDialogBounds!.width).toBeLessThanOrEqual(width);
    expect(initialDialogBounds!.x).toBeGreaterThanOrEqual(0);

    await dialog.getByRole('radio', { name: /Gói năm/ }).check();
    await dialog.getByRole('button', { name: 'Tiếp tục' }).click();
    await expect(dialog.getByRole('region', { name: 'Điều khoản dịch vụ' })).toBeVisible();
    expect(creates).toBe(1);
    await expect(dialog.getByText('1.200.000 ₫')).toBeVisible();
    const payment = dialog.getByRole('button', { name: 'Thanh toán qua SePay' });
    await expect(payment).toBeDisabled();
    const termsScroll = dialog.locator('.purchase-flow-modal__terms-scroll');
    await termsScroll.focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('checkbox', { name: /đồng ý với đúng phiên bản điều khoản/i })).toBeFocused();
    await dialog.getByRole('checkbox', { name: /đồng ý với đúng phiên bản điều khoản/i }).check();
    await expect(payment).toBeEnabled();
    const termsDialogBounds = await dialog.boundingBox();
    expect(termsDialogBounds).not.toBeNull();
    expect(termsDialogBounds!.width).toBeLessThanOrEqual(width);
    expect(termsDialogBounds!.x).toBeGreaterThanOrEqual(0);
    await payment.click();
    await page.waitForURL(/pay-sandbox\.sepay\.vn/);
    expect(capturedCheckout?.method).toBe('POST');
    expect(capturedCheckout?.body).toContain('signature=signed-test-fields');
    expect(capturedCheckout?.body).toContain('order_amount=1200000');
    expect(creates).toBe(1);
    expect(termsAcceptances).toBe(1);
    expect(checkoutPreparations).toBe(1);
  });
}
