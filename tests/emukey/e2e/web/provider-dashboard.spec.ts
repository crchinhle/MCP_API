import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const products = ['PUBLISHED', 'DRAFT', 'PUBLISHED', 'DRAFT', 'ARCHIVED'].map((status, index) => ({
  id: `product-${index}`, code: `product-${index}`, name: `Product ${index}`, description: '', imageUrl: null, status,
}));
const licenses = [
  ['ACTIVE', 'CONFIRMED', 5], ['ACTIVE', 'PENDING', 1], ['PENDING_ONCHAIN', 'PENDING', 6],
  ['SUSPENDED', 'CONFIRMED', 2], ['REVOKED', 'CONFIRMED', 7], ['ACTIVE', 'CONFIRMED', 3],
  ['PENDING_ONCHAIN', 'PENDING', 8], ['EXPIRED', 'CONFIRMED', 4],
].map(([status, finality, day], index) => ({
  id: `license-${index}`, publicLicenseId: `EMU-DASHBOARD-${index}-${'AB12CD34'.repeat(5)}`, productName: `Software ${index}`,
  plan: { name: 'Business', version: 1, commitment: '0x' + 'ab'.repeat(32) },
  provider: { displayName: 'Provider', organizationName: null }, originOrderId: `order-${index}`,
  status, finality, activeDeviceCount: 0, maxActiveDevices: 10, deviceStateVersion: 1, confirmationCount: finality === 'CONFIRMED' ? 2 : 0,
  keyVersion: 1, entitlementVersion: 1, activationKeyTrustStatus: finality === 'CONFIRMED' ? 'TRUSTED' : 'PENDING_FINALITY',
  transactionHash: null, blockNumber: null, createdAt: `2026-10-${String(day).padStart(2, '0')}T00:00:00Z`,
  updatedAt: '2026-10-09T00:00:00Z', periodStart: '2026-10-01T00:00:00Z', expiresAt: '2030-10-01T00:00:00Z',
}));
const payments = [
  ['MATCHED', null], ['DUPLICATE', null], ['AMOUNT_MISMATCH', 'OPEN'],
  ['INVALID', 'OPEN'], ['UNMATCHED', 'CLOSED_NO_ACTION'], ['MATCHED', 'OPEN'],
].map(([classification, reviewStatus], index) => ({
  transactionId: `transaction-${index}`, providerEventId: `event-${index}`, providerTransactionReference: `ref-${index}`,
  classification, reviewStatus, orderId: `order-${index}`, orderNumber: `ORDER-${index}`,
  orderType: 'NEW_PURCHASE', productNameSnapshot: 'Software', planNameSnapshot: 'Business', amountVnd: 100000,
  receivedAt: '2026-10-01T00:00:00Z', providerOccurredAt: '2026-10-01T00:00:00Z',
}));

async function mockProvider(page: Page) {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/auth/refresh') ? { accessToken: 'dashboard-test', user: { id: 'provider', displayName: 'Provider', email: 'provider@example.test', role: 'PROVIDER_ADMIN', status: 'ACTIVE' } }
      : path.endsWith('/products/admin') ? products : path.endsWith('/licenses') ? licenses
        : path.endsWith('/payments/history') ? payments : [];
    return route.fulfill({ json });
  });
}

for (const [width, height] of [[320, 800], [768, 1024], [1024, 768], [1440, 1024], [1440, 900]]) {
  test(`dashboard layout at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mockProvider(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/provider');
    const metrics = page.getByRole('region', { name: 'Chỉ số hoạt động' });
    await expect(metrics.locator('article > strong')).toHaveText(['2', '2', '2', '3']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const cards = await metrics.getByRole('article').all();
    const boxes = await Promise.all(cards.map((card) => card.boundingBox()));
    if (width >= 1280) {
      expect(new Set(boxes.map((box) => Math.round(box!.y))).size).toBe(1);
      expect(boxes.every((box) => box!.height >= 136 && box!.height <= 148)).toBe(true);
      const work = await page.getByRole('region', { name: 'Công việc cần hoàn thiện' }).boundingBox();
      const progress = await page.getByRole('region', { name: 'Tiến trình hệ thống đang xử lý' }).boundingBox();
      expect(work!.height).toBeLessThan(160);
      expect(progress!.height).toBeLessThan(110);
      expect(work!.y).toBeLessThan(progress!.y);
      const firstRow = await page.getByRole('row').nth(1).boundingBox();
      expect(firstRow!.y + firstRow!.height).toBeLessThan(900);
    } else if (width >= 768) expect(new Set(boxes.map((box) => Math.round(box!.y))).size).toBe(2);
    else expect(new Set(boxes.map((box) => Math.round(box!.x))).size).toBe(1);
    await expect(page.getByRole('columnheader')).toHaveCount(5);
    await expect(page.getByRole('row')).toHaveCount(6);
    await expect(page.getByRole('link', { name: /Xem chi tiết/ })).toHaveCount(5);
    await expect(page.getByText(/PENDING|CONFIRMED|confirmations|transactionHash|fingerprint|activationKey/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Thông báo', exact: true })).toHaveCount(0);
    await page.screenshot({ path: join(tmpdir(), `emukey-dashboard-${width}x${height}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('KPI and work links apply actual destination filters and survive refresh/history', async ({ page }) => {
  test.setTimeout(90_000);
  await mockProvider(page);
  for (const [label, path, search] of [
    ['Sản phẩm đã công bố', '/provider/catalog', '?status=PUBLISHED'],
    ['Bản quyền có hiệu lực', '/provider/licenses', '?status=ACTIVE&finality=CONFIRMED'],
    ['Đang phát hành', '/provider/licenses', '?status=PENDING_ONCHAIN'],
    ['Giao dịch cần kiểm tra', '/provider/operations', '?classification=exceptions'],
  ]) {
    await page.goto('/provider');
    const card = page.getByRole('article', { name: label, exact: true });
    await card.getByRole('link').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(path.replaceAll('/', '\\/') + search.replaceAll('?', '\\?') + '$'));
    await page.reload();
    if (path.endsWith('/catalog')) {
      await expect(page.getByRole('button', { name: 'Product 0', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Product 1', exact: true })).toHaveCount(0);
    } else if (path.endsWith('/operations')) {
      await expect(page.getByText('ORDER-2', { exact: true })).toBeVisible();
      await expect(page.getByText('ORDER-5', { exact: true })).toBeVisible();
      await expect(page.getByText('ORDER-0', { exact: true })).toHaveCount(0);
      await expect(page.getByText('ORDER-1', { exact: true })).toHaveCount(0);
      await expect(page.getByText('ORDER-4', { exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByRole('button', { name: search.includes('PENDING_ONCHAIN') ? 'Software 2' : 'Software 0', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Software 1', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Xem chi tiết', exact: true })).toHaveCount(2);
    }
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Tổng quan nhà cung cấp' })).toBeVisible();
    await page.goForward();
    expect(new URL(page.url()).pathname).toBe(path);
  }
  await page.goto('/provider');
  await page.getByRole('link', { name: /Xem sản phẩm nháp/ }).click();
  await expect(page).toHaveURL(/status=DRAFT/);
  await expect(page.getByRole('button', { name: 'Product 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Product 0', exact: true })).toHaveCount(0);
});

test('latest licenses sort descending and open the same owned-license Drawer through refresh/history', async ({ page }) => {
  await mockProvider(page);
  await page.goto('/provider');
  const links = page.getByRole('link', { name: /Xem chi tiết/ });
  await expect(links).toHaveCount(5);
  const expected = [6, 4, 2, 0, 7];
  for (let index = 0; index < 5; index++) await expect(links.nth(index)).toHaveAttribute('href', `/provider/licenses?licenseId=license-${expected[index]}`);
  await links.first().click();
  await expect(page).toHaveURL(/licenseId=license-6/);
  const drawer = page.getByRole('dialog', { name: 'Chi tiết bản quyền' });
  await expect(drawer.getByRole('heading', { name: 'Software 6', exact: true })).toBeVisible();
  await page.reload();
  await expect(drawer.getByRole('heading', { name: 'Software 6', exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page).not.toHaveURL(/licenseId=/);
  await page.goBack();
  await expect(drawer).toBeVisible();
  await page.goForward();
  await expect(drawer).toBeHidden();
  await page.goto('/provider/licenses?licenseId=another-provider-license');
  await expect(page.getByText('Không tìm thấy bản quyền trong danh sách của bạn.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/provider');
  await page.getByRole('link', { name: /Xem tất cả/ }).click();
  expect(new URL(page.url()).search).toBe('');
});

test('onboarding opens the existing creation form without a write and closes consistently', async ({ page }) => {
  await mockProvider(page);
  await page.route('**/api/v1/products/admin', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/licenses', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/payments/history', (route) => route.fulfill({ json: [] }));
  const writes: string[] = [];
  page.on('request', (request) => { if (request.method() !== 'GET' && !request.url().endsWith('/auth/refresh')) writes.push(request.url()); });
  await page.goto('/provider');
  await expect(page.getByRole('heading', { name: 'Bạn chưa có sản phẩm nào' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Công việc cần hoàn thiện' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Tiến trình hệ thống đang xử lý' })).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('link', { name: 'Thêm sản phẩm', exact: true }).click();
  await expect(page).toHaveURL(/create=product/);
  const form = page.getByRole('dialog', { name: 'Tạo sản phẩm', exact: true });
  await expect(form).toBeVisible();
  await page.reload();
  await expect(form).toBeVisible();
  await form.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page).not.toHaveURL(/create=product/);
  await expect(form).toBeHidden();
  await page.goBack();
  await expect(form).toBeVisible();
  expect(writes).toEqual([]);
});

test('partial query loading/errors never turn into zero metrics and retry is independent', async ({ page }) => {
  await mockProvider(page);
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/v1/licenses', async (route) => { await pending; return route.fulfill({ json: licenses }); });
  let fail = true;
  await page.route('**/api/v1/payments/history', (route) => route.fulfill(fail ? { status: 500, json: { message: 'Unavailable' } } : { json: payments }));
  await page.goto('/provider');
  await expect(page.getByRole('article', { name: 'Sản phẩm đã công bố' }).locator('strong')).toHaveText('2');
  const active = page.getByRole('article', { name: 'Bản quyền có hiệu lực' });
  await expect(active.getByRole('status')).toBeVisible();
  await expect(active.locator('strong')).toHaveCount(0);
  const exceptions = page.getByRole('article', { name: 'Giao dịch cần kiểm tra' });
  await expect(exceptions.locator('strong')).toHaveText('—');
  fail = false;
  await exceptions.getByRole('button', { name: /Thử lại/ }).click();
  await expect(exceptions.locator('strong')).toHaveText('3');
  release!();
  await expect(active.locator('strong')).toHaveText('2');
  await expect(page.getByRole('link', { name: /Xem chi tiết/ })).toHaveCount(5);
});
