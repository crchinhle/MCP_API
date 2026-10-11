import { expect, test } from '@playwright/test';

// Isolated UI regression tests: no requests reach the real API or database.
const activationKey = `0x${'12'.repeat(32)}`;
test('password change sends the authenticated session', async ({ page }) => {
  let authorization: string | undefined;
  await page.route('**/api/v1/auth/password', async (route) => {
    authorization = route.request().headers()['authorization'];
    await route.fulfill({ status: 204 });
  });
  await page.goto('/buyer/profile');
  await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
  await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill('Current123!');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('Changed12345!');
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('Changed12345!');
  await page.locator('button[type="submit"]').filter({ hasText: 'Đổi mật khẩu' }).click();
  await expect.poll(() => authorization).toBe('Bearer ui-test');
});

test('notification overflow stays available in the current workspace', async ({ page }) => {
  await page.route('**/api/v1/notifications?*', (route) => {
    const next = new URL(route.request().url()).searchParams.has('cursor');
    return route.fulfill({ json: {
      items: Array.from({ length: next ? 1 : 8 }, (_, i) => ({ id: `notice-${next ? 8 : i}`, title: `Notice ${next ? 8 : i}`, content: `Content ${i}`, isRead: false })),
      nextCursor: next ? null : 'page-2',
    } });
  });
  await page.goto('/buyer');
  await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
  await page.getByText(/Xem (tất cả|thêm) thông báo/).click();
  await expect(page.getByText('Notice 8', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/buyer$/);
});

test('catalog search follows browser history changes', async ({ page }) => {
  await page.goto('/products?q=first');
  await expect(page.getByRole('textbox', { name: 'Tìm sản phẩm' })).toHaveValue('first');
  await page.evaluate(() => {
    window.history.pushState({}, '', '/products?q=second');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('textbox', { name: 'Tìm sản phẩm' })).toHaveValue('second');
});

test('email recovery resolves the target license before accepting the token', async ({ page }) => {
  await page.route('**/api/v1/licenses/action-verification/resolve', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ actionToken: 'resolved-email-token' });
    await route.fulfill({ json: { action: 'KEY_RECOVERY', licenseId: 'license-two', deviceId: null, expiresAt: '2027-01-01' } });
  });
  await page.goto('/buyer/licenses?actionToken=resolved-email-token');
  await expect(page.getByRole('heading', { name: 'Other product · Business' })).toBeVisible();
  expect(page.url()).not.toContain('resolved-email-token');
  await page.getByRole('button', { name: 'Mã bản quyền', exact: true }).click();
  const recovery = page.getByRole('region', { name: 'Khôi phục mã bản quyền' });
  await expect(recovery.getByLabel('Mã xác nhận khôi phục', { exact: true })).toHaveValue('resolved-email-token');
});

test('email action lookup can retry a network failure without turning device revocation into recovery', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/v1/licenses/action-verification/resolve', async (route) => {
    attempts++;
    await route.fulfill(attempts === 1 ? { status: 503, json: {} } : { json: { action: 'REMOTE_REVOKE_DEVICE', licenseId: 'license-two', deviceId: 'device-two', expiresAt: '2027-01-01' } });
  });
  await page.goto('/buyer/licenses?actionToken=device-email-token');
  await expect(page.getByText('Chưa thể kiểm tra liên kết email. Vui lòng thử lại.')).toBeVisible();
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByText('Liên kết này dành cho thao tác thiết bị hoặc đổi mã.')).toBeVisible();
  await expect(page.getByLabel('Mã xác nhận khôi phục', { exact: true })).toHaveCount(0);
  expect(page.url()).not.toContain('device-email-token');
});

test('order support failure remains visible and can be retried', async ({ page }) => {
  const order = { id: 'support-order', orderNumber: 'EMU-SUPPORT', productNameSnapshot: 'Product', planNameSnapshot: 'Plan', priceVndSnapshot: 100000, orderStatus: 'PAYMENT_ACCEPTED' };
  await page.route('**/api/v1/orders', (route) => route.fulfill({ json: [order] }));
  await page.route('**/api/v1/orders/support-order', (route) => route.fulfill({ json: order }));
  let attempts = 0;
  await page.route('**/api/v1/conversations', async (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] });
    attempts++;
    await route.fulfill(attempts === 1 ? { status: 503, json: { message: 'Support temporarily unavailable' } } : { json: { id: 'support-created' } });
  });
  await page.goto('/buyer/orders');
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await page.getByRole('button', { name: 'Cần hỗ trợ về đơn này' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Cần hỗ trợ về đơn này' }).click();
  await expect(page).toHaveURL(/conversation=support-created/);
});
test('order drawer shows purchased plan details and retains explicit terms consent', async ({ page }) => {
  const order = { id: 'plan-detail', orderNumber: 'EMU-DETAIL', productNameSnapshot: 'Classroom Hub', planNameSnapshot: 'Chuyên nghiệp', providerNameSnapshot: 'Emu Software', priceVndSnapshot: 1290000, durationMonthsSnapshot: 12, maxActiveDevicesSnapshot: 5, planVersionSnapshot: 2, entitlementsSnapshot: { desktop: true }, orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE' };
  await page.route('**/api/v1/orders', (route) => route.fulfill({ json: [order] }));
  await page.route('**/api/v1/orders/plan-detail', (route) => route.fulfill({ json: order }));
  await page.route('**/api/v1/orders/plan-detail/service-terms', (route) => route.fulfill({ json: { content: 'Service terms test content' } }));
  await page.goto('/buyer/orders');
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('heading', { name: 'Thông tin chi tiết gói' })).toBeVisible();
  await expect(drawer.getByText('12 tháng', { exact: true })).toBeVisible();
  await expect(drawer.getByText('5 thiết bị', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Ứng dụng máy tính', { exact: true })).toBeVisible();
  await expect(drawer.getByText('Service terms test content')).toBeHidden();
  await expect(drawer.getByRole('button', { name: 'Xác nhận điều khoản' })).toBeDisabled();
  await drawer.getByText('Xem điều khoản dịch vụ', { exact: true }).click();
  await expect(drawer.getByText('Service terms test content')).toBeVisible();
  await drawer.getByRole('checkbox').check();
  await expect(drawer.getByRole('button', { name: 'Xác nhận điều khoản' })).toBeEnabled();
});
for (const width of [320, 768, 1024, 1440]) {
  test(`orders keep amount aligned and actions reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/v1/orders', (route) => route.fulfill({ json: [
      { id: 'order-terms', orderNumber: 'EMU-F5CE806AF45-LONG-ORDER', productNameSnapshot: 'Classroom Hub Professional', planNameSnapshot: 'Gói doanh nghiệp', priceVndSnapshot: 1290000, orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE' },
      { id: 'order-payment', orderNumber: 'EMU-PAYMENT', productNameSnapshot: 'SecureDesk', planNameSnapshot: 'Business', priceVndSnapshot: 2682000, orderStatus: 'WAITING_PAYMENT' },
    ] }));
    await page.goto('/buyer/orders');
    const table = page.getByRole('table');
    await expect(table.getByRole('button', { name: 'Xem chi tiết' })).toBeVisible();
    expect(await table.getByRole('columnheader', { name: 'Thành tiền' }).evaluate((el) => getComputedStyle(el).textAlign)).toBe('right');
    const cells = await table.locator('tbody tr').first().locator('td').evaluateAll((items) => items.map((el) => ({ x: el.getBoundingClientRect().x, width: el.getBoundingClientRect().width })));
    const heads = await table.locator('th').evaluateAll((items) => items.map((el) => ({ x: el.getBoundingClientRect().x, width: el.getBoundingClientRect().width })));
    for (let i = 0; i < 5; i++) {
      expect(Math.abs(cells[i]!.x - heads[i]!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(cells[i]!.width - heads[i]!.width)).toBeLessThanOrEqual(1);
    }
    for (const [name, rowIndex] of [['Xem chi tiết', 0], ['Hủy đơn', 0], ['Thanh toán', 1]] as const) {
      const row = table.locator('tbody tr').nth(rowIndex);
      const action = row.getByRole(name === 'Thanh toán' ? 'link' : 'button', { name, exact: true });
      await action.scrollIntoViewIfNeeded();
      expect(await action.evaluate((el) => {
        const cell = el.closest('td')!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return box.left >= cell.left && box.right <= cell.right && el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
    }
  });
}
test('login email and password controls have matching dimensions', async ({ page }) => {
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 401, json: {} }));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/auth');
    const email = page.getByLabel('Email', { exact: true });
    const password = page.getByLabel('Mật khẩu', { exact: true });
    await expect(email).toBeVisible();
    const emailBox = await email.boundingBox();
    const passwordBox = await password.locator('..').boundingBox();
    expect(Math.abs(emailBox!.width - passwordBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(emailBox!.height - passwordBox!.height)).toBeLessThanOrEqual(1);
    await expect(page.getByText('Bảo mật phiên đăng nhập và giới hạn thử sai được bật.')).toHaveCount(0);
  }
});
const license = {
  id: 'license-one', productName: 'SecureDesk Pro', status: 'ACTIVE',
  plan: { name: 'Business', version: 1 }, publicLicenseId: 'EMU-TEST',
  maxActiveDevices: 3, expiresAt: '2027-09-08', activationKeyAvailable: true,
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let body: unknown = [];
    if (path === '/auth/refresh') body = {
      accessToken: 'ui-test',
      user: { id: 'customer', email: 'test@example.com', displayName: 'Test', role: 'CUSTOMER', status: 'ACTIVE' },
    };
    if (path === '/licenses') body = [license, { ...license, id: 'license-two', productName: 'Other product', activationKeyAvailable: false }];
    if (path.endsWith('/activation-key/retrieve')) body = { activationKey, keyVersion: 1 };
    await route.fulfill({ json: body });
  });
});

test('recovers only after final confirmation and resumes polling after reload', async ({ page }) => {
  let confirmed = false;
  let retrieved = 0;
  await page.route('**/api/v1/licenses/action-verification', (route) => route.fulfill({ json: { accepted: true } }));
  await page.route('**/api/v1/licenses/license-one/activation-key/recover', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ actionToken: 'email-token', currentPassword: 'current-password' });
    await route.fulfill({ json: { commandId: 'recovery-command', licenseId: 'license-one', status: 'PENDING' } });
  });
  await page.route('**/api/v1/commands/recovery-command', (route) => route.fulfill({ json: { commandId: 'recovery-command', licenseId: 'license-one', status: confirmed ? 'CONFIRMED' : 'PENDING' } }));
  await page.route('**/api/v1/licenses/license-one/activation-key/retrieve', async (route) => {
    retrieved++;
    await route.fulfill({ json: { activationKey, keyVersion: 2 } });
  });
  await page.goto('/buyer/licenses?licenseId=license-one&recover=1');
  await page.getByRole('button', { name: 'Gửi email khôi phục', exact: true }).click();
  await expect(page.getByText('Đã gửi email. Dán mã xác nhận trong email vào ô bên dưới.')).toBeVisible();
  await page.getByLabel('Mã xác nhận khôi phục', { exact: true }).fill('email-token');
  await page.getByLabel('Mật khẩu xác nhận khôi phục').fill('current-password');
  await page.getByRole('button', { name: 'Xác nhận khôi phục', exact: true }).click();
  await page.getByRole('button', { name: 'Khôi phục', exact: true }).click();
  await expect(page).toHaveURL(/recoveryCommand=recovery-command/);
  expect(page.url()).not.toContain('email-token');
  await expect(page.getByRole('button', { name: 'Nhận mã khôi phục' })).toHaveCount(0);
  expect(retrieved).toBe(0);
  await page.reload();
  const recoveryStatus = page.getByRole('region', { name: 'Khôi phục mã bản quyền' });
  await expect(recoveryStatus.getByText('Trạng thái khôi phục: Đang xử lý')).toBeVisible();
  confirmed = true;
  await expect(recoveryStatus.getByText('Trạng thái khôi phục: Đã xác nhận')).toBeVisible({ timeout: 7000 });
  await page.getByRole('button', { name: 'Nhận mã khôi phục' }).click();
  const keyDialog = page.getByRole('dialog', { name: 'Mã bản quyền của bạn' });
  await expect(keyDialog.getByLabel('Mã bản quyền đã cấp')).toHaveValue(activationKey);
  expect(retrieved).toBe(1);
});

for (const width of [320, 390, 1440]) {
  test(`keeps the one-time key scoped to its license without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/buyer/licenses');
    await page.getByRole('button', { name: 'Chi tiết' }).first().click();
    const licenseDialog = page.getByRole('dialog', { name: 'Chi tiết bản quyền' });
    await licenseDialog.getByRole('button', { name: 'Mã bản quyền', exact: true }).click();
    await licenseDialog.getByRole('button', { name: 'Nhận mã bản quyền một lần', exact: true }).click();
    const keyDialog = page.getByRole('dialog', { name: 'Mã bản quyền của bạn' });
    await expect(keyDialog.getByLabel('Mã bản quyền đã cấp')).toHaveValue(activationKey);
    const dialogBox = await keyDialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(width);
    expect(dialogBox!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const table = await page.locator('.buyer-license-table .ant-table-wrapper').boundingBox();
    const tableSection = await page.locator('.buyer-license-table').boundingBox();
    expect(table).not.toBeNull();
    expect(tableSection).not.toBeNull();
    expect(table!.x).toBeGreaterThanOrEqual(tableSection!.x);
    expect(table!.x + table!.width).toBeLessThanOrEqual(tableSection!.x + tableSection!.width);
    await keyDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(licenseDialog).toBeVisible();
    const detailDialog = page.getByRole('dialog');
    await detailDialog.getByRole('button', { name: 'Tổng quan', exact: true }).click();
    await detailDialog.getByRole('button', { name: 'Mã bản quyền', exact: true }).click();
    await detailDialog.getByRole('button', { name: 'Xem mã bản quyền', exact: true }).click();
    const reopenedKeyDialog = page.getByRole('dialog', { name: 'Mã bản quyền của bạn' });
    await expect(reopenedKeyDialog.getByLabel('Mã bản quyền đã cấp')).toHaveValue(activationKey);
    await reopenedKeyDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    const keyTabs = detailDialog.getByRole('button', { name: 'Mã bản quyền', exact: true });
    await expect(keyTabs).toHaveClass(/active/);
    await detailDialog.getByRole('button', { name: 'Thiết bị', exact: true }).click();
    await expect(detailDialog.getByRole('button', { name: 'Thiết bị', exact: true })).toHaveClass(/active/);
    await expect(detailDialog.getByText('Đang sử dụng 0/3 thiết bị.')).toBeVisible();
    await detailDialog.getByRole('button', { name: 'Tổng quan', exact: true }).click();
    await detailDialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Chi tiết' }).nth(1).click();
    const otherLicenseDialog = page.getByRole('dialog', { name: 'Chi tiết bản quyền' });
    await otherLicenseDialog.getByRole('button', { name: 'Mã bản quyền', exact: true }).click();
    await expect(otherLicenseDialog.getByText('Mã bản quyền không còn sẵn sàng để nhận')).toBeVisible();
    await expect(otherLicenseDialog.getByLabel('Mã bản quyền đã cấp')).toHaveCount(0);
    await expect(page.locator('code')).toHaveCount(0);
  });
}
