import { expect, test } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

for (const width of [320, 1440]) {
  test(`account renewal needs no secret and resumes after reload at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    let created = false;
    let creates = 0;
    const order = { id: 'renewal-order', orderType: 'RENEWAL', orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE',
      targetLicenseId: 'existing-license', planId: 'plan', planNameSnapshot: 'Business', durationMonthsSnapshot: 12, priceVndSnapshot: 2500000 };
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/api/v1', '');
      let data: unknown = [];
      if (path === '/auth/refresh') data = { accessToken: 'test', user: { id: 'buyer', role: 'CUSTOMER', displayName: 'Buyer', email: 'test@example.com', status: 'ACTIVE' } };
      if (path === '/orders/renewal-preview/existing-license') data = { licenseId: 'existing-license', planId: 'plan', planName: 'Business', productName: 'SecureDesk',
        durationMonths: 12, priceVnd: 2500000, currentExpiresAt: '2027-09-29T00:00:00Z', estimatedExpiresAt: '2028-09-29T00:00:00Z', canRenew: true, pendingOrder: created ? order : null };
      if (path === '/orders' && request.method() === 'POST') {
        expect(request.headers()['x-license-key']).toBeUndefined();
        expect(request.postDataJSON()).toEqual({ planId: 'plan', targetLicenseId: 'existing-license' });
        creates++;
        created = true;
        data = order;
      }
      if (path === '/orders/renewal-order') data = order;
      if (path === '/orders/renewal-order/service-terms') data = { content: 'Điều khoản gia hạn phần mềm.' };
      await route.fulfill({ json: data });
    });
    await page.goto('/buyer/licenses/existing-license/renew');
    await expect(page.getByText('2.500.000 ₫')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tạo đơn gia hạn' }).click();
    await expect(page.getByRole('heading', { name: 'Điều khoản gia hạn' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Điều khoản gia hạn' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đồng ý và thanh toán' })).toBeDisabled();
    await page.getByRole('checkbox', { name: 'Tôi đã đọc và đồng ý với điều khoản gia hạn' }).check();
    await expect(page.getByRole('button', { name: 'Đồng ý và thanh toán' })).toBeEnabled();
    expect(creates).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

for (const review of [false, true]) {
  test(`returned payment shows ${review ? 'review evidence' : 'delayed confirmation and resumes after acceptance'}`, async ({ page }) => {
    await page.clock.install();
    let accepted = false;
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
      if (route.request().method() === 'POST' && path !== '/auth/refresh') throw new Error('Must not create another checkout or retrieve keys');
      let data: unknown = [];
      if (path === '/auth/refresh') data = { accessToken: 'test', user: { id: 'buyer', role: 'CUSTOMER', displayName: 'Buyer', email: 'test@example.com', status: 'ACTIVE' } };
      if (path === '/orders/test-order') data = { id: 'test-order', orderNumber: 'ORD-TEST', orderStatus: accepted ? 'PAYMENT_ACCEPTED' : 'WAITING_PAYMENT', serviceTermsAcceptedAt: '2026-09-28T00:00:00Z' };
      if (path === '/payments/history') data = review ? [{ orderId: 'test-order', classification: 'UNMATCHED', reviewStatus: 'OPEN', transactionId: 'payment' }] : [];
      await route.fulfill({ json: data });
    });
    await page.goto('/buyer/orders/test-order/payment?sepay=success');
    if (review) {
      await expect(page.getByText('Giao dịch đã được ghi nhận nhưng cần kiểm tra')).toBeVisible();
      await expect(page.locator('.payment-card > header .status-chip')).toHaveClass(/status-chip--warning/);
      await expect(page.locator('.progress-list li').filter({ hasText: 'Thanh toán' }).locator('.status-chip')).toHaveClass(/status-chip--warning/);
      await expect(page.getByText('Đang xác nhận thanh toán', { exact: true })).toHaveCount(0);
    } else {
      await expect(page.locator('.payment-card > header .status-chip')).toHaveClass(/status-chip--info/);
      await expect(page.locator('.progress-list li').filter({ hasText: 'Thanh toán' }).locator('.status-chip')).toHaveClass(/status-chip--info/);
      await page.clock.fastForward(31_000);
      await expect(page.getByText('Chưa nhận được xác nhận thanh toán hợp lệ')).toBeVisible();
      accepted = true;
      await page.getByRole('button', { name: 'Kiểm tra lại trạng thái' }).click();
      await expect(page.getByRole('heading', { name: 'Thanh toán đã được xác nhận', exact: true })).toBeVisible();
    }
  });
}

test.describe('Payment status downstream flow', () => {
  test('renewal waits for its own confirmation and updated expiry without issuing another key', async ({ page }) => {
    let confirmed = false;
    let projectionUpdated = false;
    let review = false;
    let licenseReads = 0;
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
      if (route.request().method() === 'POST' && path !== '/auth/refresh') throw new Error('Renewal must not retrieve an activation key or start another checkout');
      let data: unknown = [];
      if (path === '/auth/refresh') data = { accessToken: 'test', user: { id: 'buyer', role: 'CUSTOMER', displayName: 'Buyer', email: 'test@example.com', status: 'ACTIVE' } };
      if (path === '/orders/renewal-order') data = { id: 'renewal-order', orderNumber: 'RENEWAL', orderType: 'RENEWAL', orderStatus: 'PAYMENT_ACCEPTED', targetLicenseId: 'existing-license', licenseId: 'existing-license', renewalStatus: review ? 'DEAD_LETTER' : confirmed ? 'CONFIRMED' : 'SUBMITTED_UNKNOWN', renewalExpiresAt: '2027-10-29T09:00:00.123Z' };
      if (path === '/licenses/existing-license') {
        licenseReads++;
        data = { id: 'existing-license', originOrderId: 'original-order', status: 'ACTIVE', activationKeyTrustStatus: 'TRUSTED', activationKeyAvailable: true, productName: 'SecureDesk', plan: { name: 'Business' }, expiresAt: projectionUpdated ? '2027-10-29T09:00:00Z' : '2027-09-29T09:00:00Z', maxActiveDevices: 3 };
      }
      await route.fulfill({ json: data });
    });
    await page.goto('/buyer/orders/renewal-order/payment');
    await expect(page.getByRole('status', { name: 'Đang xử lý bản quyền' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nhận mã bản quyền' })).toHaveCount(0);
    confirmed = true;
    await page.reload();
    await expect(page.getByRole('status', { name: 'Đang xử lý bản quyền' })).toBeVisible();
    projectionUpdated = true;
    await expect(page.getByRole('heading', { name: 'Gia hạn đã hoàn tất', exact: true })).toBeVisible({ timeout: 7000 });
    await expect(page.getByRole('status', { name: 'Đang xử lý bản quyền' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nhận mã bản quyền' })).toHaveCount(0);
    expect(licenseReads).toBeGreaterThan(2);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Gia hạn đã hoàn tất', exact: true })).toBeVisible();
    confirmed = false;
    await expect(page.getByRole('status', { name: 'Đang xử lý bản quyền' })).toBeVisible({ timeout: 7000 });
    review = true;
    await expect(page.getByText('Thanh toán đã xác nhận. Bản quyền đang cần được kiểm tra thêm.')).toBeVisible({ timeout: 7000 });
    await expect(page.getByRole('status', { name: 'Đang xử lý bản quyền' })).toHaveCount(0);
  });

  for (const state of ['query-error', 'REVOKED', 'UNTRUSTED_REORG']) {
    test(`does not imply active processing when license state is ${state}`, async ({ page }) => {
      await page.route('**/api/v1/**', async (route) => {
        const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
        let data: unknown = [];
        if (path === '/auth/refresh') data = { accessToken: 'test', user: { id: 'buyer', role: 'CUSTOMER', displayName: 'Buyer', email: 'test@example.com', status: 'ACTIVE' } };
        if (path === '/orders/test-order') data = { id: 'test-order', orderNumber: 'ORD-TEST', orderStatus: 'PAYMENT_ACCEPTED', licenseId: 'test-license' };
        if (path === '/licenses/test-license') {
          if (state === 'query-error') {
            await route.fulfill({ status: 503, json: { message: 'Temporarily unavailable' } });
            return;
          }
          data = { id: 'test-license', status: state === 'REVOKED' ? 'REVOKED' : 'PENDING_ONCHAIN', activationKeyTrustStatus: state === 'REVOKED' ? 'TRUSTED' : state };
        }
        await route.fulfill({ json: data });
      });
      await page.goto('/buyer/orders/test-order/payment');
      await expect(page.getByText(state === 'query-error' ? /trạng thái blockchain chưa thể tải/ : 'Thanh toán đã xác nhận. Bản quyền đang cần được kiểm tra thêm.')).toBeVisible();
      await expect(page.getByRole('status', { name: 'Đang xử lý bản quyền' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Nhận mã bản quyền' })).toHaveCount(0);
    });
  }

  test('polls the exact order license, gates retrieval on trust, and never retrieves on reload', async ({ page }) => {
    const orderId = '00000000-0000-4000-8000-000000000502';
    const licenseId = '00000000-0000-4000-8000-000000000401';
    const activationKey = `0x${'aa'.repeat(32)}`;
    let licenseReads = 0;
    let ready = false;
    let retrievals = 0;
    let consumed = false;

    await page.route('**/api/v1/auth/refresh', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'browser-test-token',
          user: {
            displayName: 'Browser Customer',
            email: 'browser@example.com',
            id: '00000000-0000-4000-8000-000000000004',
            role: 'CUSTOMER',
            status: 'ACTIVE',
          },
        }),
      });
    });
    await page.route(`**/api/v1/orders/${orderId}`, async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          billingCycleSnapshot: 'MONTHLY',
          createdAt: '2026-09-30T00:00:00.000Z',
          currency: 'VND',
          customerUserId: '00000000-0000-4000-8000-000000000004',
          durationMonthsSnapshot: 1,
          entitlementsSnapshot: {},
          id: orderId,
          licenseId,
          maxActiveDevicesSnapshot: 3,
          orderNumber: 'ORD-BROWSER-0502',
          orderStatus: 'PAYMENT_ACCEPTED',
          orderType: 'NEW_PURCHASE',
          paymentDueAt: '2026-10-02T00:00:00.000Z',
          planCommitmentSnapshot: `0x${'bb'.repeat(32)}`,
          planId: '00000000-0000-4000-8000-000000000301',
          planNameSnapshot: 'Business',
          planVersionSnapshot: 1,
          priceVndSnapshot: 120000,
          productId: '00000000-0000-4000-8000-000000000201',
          productNameSnapshot: 'SecureDesk Pro',
          providerNameSnapshot: 'Emukey Provider',
          providerUserId: '00000000-0000-4000-8000-000000000005',
          publicLicenseId: 'EMU-BROWSER-LICENSE',
          serviceTermsAcceptedAt: '2026-09-30T00:01:00.000Z',
          targetLicenseId: null,
        }),
      });
    });
    await page.route(`**/api/v1/licenses/${licenseId}`, async (route) => {
      licenseReads += 1;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          activationKeyAvailable: !consumed,
          activationKeyTrustStatus: ready ? 'TRUSTED' : 'PENDING_FINALITY',
          blockNumber: ready ? 42 : null,
          confirmationCount: ready ? 2 : 0,
          createdAt: '2026-09-30T00:01:00.000Z',
          entitlementVersion: 1,
          expiresAt: '2027-09-30T00:01:00.000Z',
          finality: ready ? 'CONFIRMED' : 'PENDING',
          id: licenseId,
          keyVersion: 1,
          maxActiveDevices: 3,
          originOrderId: orderId,
          periodStart: '2026-09-30T00:01:00.000Z',
          plan: { commitment: `0x${'bb'.repeat(32)}`, name: 'Business', version: 1 },
          productName: 'SecureDesk Pro',
          provider: { displayName: 'Emukey Provider', organizationName: 'Emukey Software' },
          publicLicenseId: 'EMU-BROWSER-LICENSE',
          status: ready ? 'ACTIVE' : 'PENDING_ONCHAIN',
          transactionHash: ready ? `0x${'cc'.repeat(32)}` : null,
          updatedAt: '2026-09-30T00:01:00.000Z',
        }),
      });
    });
    await page.route(`**/api/v1/licenses/${licenseId}/activation-key/retrieve`, async (route) => {
      retrievals += 1;
      if (consumed) {
        await route.fulfill({
          contentType: 'application/json',
          status: 404,
          body: JSON.stringify({ error: { code: 'ACTIVATION_KEY_UNAVAILABLE' } }),
        });
        return;
      }
      consumed = true;
      await route.fulfill({
        contentType: 'application/json',
        status: 201,
        body: JSON.stringify({ activationKey, keyVersion: 1 }),
      });
    });

    await page.goto(`/buyer/orders/${orderId}/payment`);
    await expect(page.getByText('Thanh toán đã được xác nhận.').first()).toBeVisible();
    await expect(page.getByText('Đang kích hoạt bản quyền', { exact: true })).toBeVisible();
    const processing = page.getByRole('status', { name: 'Đang xử lý bản quyền' });
    await expect(processing).toBeVisible();
    await expect(processing.locator('.ant-spin-spinning')).toBeVisible();
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(processing).toBeVisible();
      expect(await processing.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    await expect(page.getByRole('button', { name: 'Nhận mã bản quyền' })).toBeHidden();
    ready = true;
    await expect(page.getByRole('heading', { name: 'Bản quyền đã sẵn sàng' })).toBeVisible({ timeout: 5_000 });
    await expect(processing).toHaveCount(0);
    expect(licenseReads).toBeGreaterThan(1);
    await expect(page.getByRole('button', { name: 'Nhận mã bản quyền' })).toBeVisible();
    expect(retrievals).toBe(0);

    await page.getByRole('button', { name: 'Nhận mã bản quyền' }).click();
    await expect(page.getByLabel('Mã bản quyền')).toHaveValue(activationKey);
    expect(retrievals).toBe(1);

    await page.reload();
    await expect(page.getByText('Mã bản quyền đã được nhận')).toBeVisible();
    await expect(page.getByLabel('Mã bản quyền')).toHaveCount(0);
    expect(retrievals).toBe(1);
  });
});
