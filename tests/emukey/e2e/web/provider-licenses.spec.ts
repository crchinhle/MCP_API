import { expect, test, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const states = ['PENDING_ONCHAIN', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED'] as const;
const finalities = ['PENDING', 'CONFIRMED', 'PENDING_FINALITY', 'PROJECTION_STALE', 'UNTRUSTED_REORG', 'REORGED'];
const licenses = Array.from({ length: 12 }, (_, index) => ({
  id: `license-${index}`, publicLicenseId: `EMU-TEST-${index}-${'A1B2C3D4'.repeat(6)}`,
  productName: `Sản phẩm ${index}`, plan: { name: index % 2 ? 'Doanh nghiệp' : 'Chuyên nghiệp', version: 1, commitment: '0x' + 'ab'.repeat(32) },
  provider: { displayName: 'Nhà cung cấp', organizationName: null },
  originOrderId: `order-${index}`, status: states[index % states.length], finality: finalities[index % finalities.length],
  activeDeviceCount: 1, maxActiveDevices: 10, deviceStateVersion: 1,
  confirmationCount: index % 3, blockNumber: null, transactionHash: null,
  keyVersion: 1, entitlementVersion: 1, activationKeyTrustStatus: 'PENDING_FINALITY',
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', periodStart: '2026-10-01T00:00:00Z',
  expiresAt: index === 0 ? 'invalid-date' : '2030-10-01T00:00:00Z',
}));

async function mockProvider(page: Page) {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/refresh')) return route.fulfill({ json: { accessToken: 'provider-ui-test', user: { id: 'provider', email: 'provider@example.test', displayName: 'Provider', role: 'PROVIDER_ADMIN', status: 'ACTIVE' } } });
    if (path.endsWith('/licenses')) return route.fulfill({ json: licenses });
    return route.fulfill({ json: [] });
  });
}

for (const [width, height] of [[320, 800], [768, 1024], [1024, 768], [1440, 1024]]) {
  test(`license layout and keyboard Drawer at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mockProvider(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/provider/licenses');
    await expect(page.getByRole('button', { name: 'Sản phẩm 0', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width < 768) await expect(page.getByRole('table')).toHaveCount(0);
    else await expect(page.getByRole('columnheader')).toHaveCount(5);
    await page.screenshot({ path: join(tmpdir(), `emukey-licenses-${width}.png`), fullPage: true });
    const trigger = page.getByRole('button', { name: 'Xem chi tiết', exact: true }).first();
    await trigger.focus();
    await page.keyboard.press('Enter');
    const drawer = page.getByRole('dialog', { name: 'Chi tiết bản quyền' });
    await expect(drawer.getByText('Đang hoàn tất phát hành bản quyền')).toBeVisible();
    await expect(drawer.getByText('1 / 10 thiết bị')).toBeVisible();
    await expect(drawer.getByText('Invalid Date')).toHaveCount(0);
    expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (width < 768) expect(Math.round((await drawer.boundingBox())!.width)).toBe(width);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    await page.screenshot({ path: join(tmpdir(), `emukey-license-drawer-${width}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test('search, plan names, filters, pagination and Back/Forward survive URL navigation', async ({ page }) => {
  await mockProvider(page);
  await page.goto('/provider/licenses?status=ACTIVE');
  await expect(page.getByRole('button', { name: 'Sản phẩm 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sản phẩm 0', exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Lọc trạng thái bản quyền' }).click();
  await page.locator('.ant-select-item-option').filter({ hasText: 'Tất cả trạng thái' }).click();
  await expect(page).not.toHaveURL(/status=/);
  await page.locator('.ant-pagination-item-2').click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('button', { name: 'Sản phẩm 10', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Sản phẩm 0', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/status=ACTIVE/);
  await page.goForward();
  await page.getByRole('textbox', { name: 'Tìm bản quyền' }).fill('Doanh nghiệp');
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByText(/^6 bản quyền/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Tìm bản quyền' })).toHaveValue('Doanh nghiệp');
  await page.getByRole('textbox', { name: 'Tìm bản quyền' }).fill('missing');
  await expect(page.getByText('Không tìm thấy bản quyền phù hợp')).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(page.getByRole('button', { name: 'Sản phẩm 0', exact: true })).toBeVisible();
  await page.goto('/provider/licenses?status=PENDING_ONCHAIN&finality=PENDING');
  await expect(page.getByText('1 bản quyền · 1 đang phát hành', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sản phẩm 0', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Thao tác bản quyền/ })).toHaveCount(0);
});

test('loading, API error, retry and genuinely empty list stay distinct', async ({ page }) => {
  await mockProvider(page);
  let fail = true;
  let release: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/v1/licenses', async (route) => {
    await waiting;
    return route.fulfill(fail ? { status: 500, json: { message: 'Unavailable' } } : { json: [] });
  });
  await page.goto('/provider/licenses');
  await expect(page.getByRole('status', { name: 'Đang tải danh sách bản quyền' })).toBeVisible();
  await expect(page.getByText(/^0 bản quyền/)).toHaveCount(0);
  release!();
  await expect(page.getByText('Không thể tải danh sách bản quyền')).toBeVisible();
  await expect(page.getByText('Chưa có bản quyền nào được phát hành')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByText('Chưa có bản quyền nào được phát hành')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tạo bản quyền' })).toHaveCount(0);
});

for (const [status, action, command] of [
  ['SUSPENDED', 'Tiếp tục', 'RESUME_LICENSE'],
  ['ACTIVE', 'Thu hồi', 'REVOKE_LICENSE'],
  ['SUSPENDED', 'Thu hồi', 'REVOKE_LICENSE'],
]) {
  test(`${status} allows ${command} only after explicit confirmation`, async ({ page }) => {
    await mockProvider(page);
    let payload: unknown;
    await page.route('**/api/v1/licenses', (route) => route.fulfill({ json: [{ ...licenses[1], status }] }));
    await page.route('**/api/v1/licenses/*/lifecycle', (route) => {
      payload = route.request().postDataJSON();
      return route.fulfill({ json: { commandId: 'action-command', licenseId: 'license-1', status: 'PENDING' } });
    });
    await page.route('**/api/v1/commands/action-command', (route) => route.fulfill({ json: { commandId: 'action-command', status: 'PENDING' } }));
    await page.goto('/provider/licenses');
    await page.getByRole('button', { name: /Thao tác bản quyền/ }).click();
    await expect(page.getByRole('menuitem', { name: status === 'ACTIVE' ? 'Tiếp tục bản quyền' : 'Tạm ngưng bản quyền', exact: true })).toHaveCount(0);
    await page.getByRole('menuitem', { name: `${action} bản quyền`, exact: true }).click();
    const modal = page.getByRole('dialog', { name: `${action} bản quyền?` });
    expect(payload).toBeUndefined();
    const confirm = modal.getByRole('button', { name: `Xác nhận ${action.toLocaleLowerCase('vi')}` });
    if (command === 'REVOKE_LICENSE') {
      await expect(confirm).toBeDisabled();
      await modal.getByLabel('Lý do thu hồi', { exact: true }).fill('Vi phạm điều khoản');
    } else await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(modal).toBeHidden();
    expect(payload).toEqual({ command, ...(command === 'REVOKE_LICENSE' ? { reason: 'Vi phạm điều khoản' } : {}) });
  });
}

for (const [status, title, description] of [
  ['RETRYABLE_FAILED', 'Yêu cầu chưa hoàn tất', 'Vui lòng kiểm tra trạng thái trước khi thực hiện lại.'],
  ['DEAD_LETTER', 'Yêu cầu cần được kiểm tra thêm', 'Vui lòng liên hệ bộ phận hỗ trợ.'],
  ['ABANDONED', 'Đã dừng theo dõi yêu cầu', 'Vui lòng kiểm tra trạng thái bản quyền mới nhất trước khi thực hiện lại.'],
  ['SUPERSEDED', 'Yêu cầu đã được thay thế', 'Vui lòng kiểm tra trạng thái bản quyền mới nhất.'],
]) {
  test(`explains ${status} without automatically resending a command`, async ({ page }) => {
    await mockProvider(page);
    let posts = 0;
    await page.route('**/api/v1/licenses', (route) => route.fulfill({ json: [licenses[1]] }));
    await page.route('**/api/v1/licenses/*/lifecycle', (route) => {
      posts++;
      return route.fulfill({ json: { commandId: 'terminal-command', licenseId: 'license-1', status: 'PENDING' } });
    });
    await page.route('**/api/v1/commands/terminal-command', (route) => route.fulfill({ json: { commandId: 'terminal-command', status } }));
    await page.goto('/provider/licenses');
    await page.getByRole('button', { name: /Thao tác bản quyền/ }).click();
    await page.getByRole('menuitem', { name: 'Tạm ngưng bản quyền' }).click();
    await page.getByLabel('Lý do tạm ngưng', { exact: true }).fill('Bảo trì');
    await page.getByRole('button', { name: 'Xác nhận tạm ngưng' }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText(description, { exact: true })).toBeVisible();
    await expect(page.getByText('Có hiệu lực', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Thao tác bản quyền/ })).toBeDisabled();
    expect(posts).toBe(1);
  });
}

test('lifecycle menu confirms, preserves reason on failure and waits for projection', async ({ page }) => {
  await mockProvider(page);
  let posts = 0;
  let confirmed = false;
  let projectionUpdated = false;
  await page.route('**/api/v1/licenses/*/lifecycle', async (route) => {
    posts++;
    expect(route.request().postDataJSON()).toEqual({ command: 'SUSPEND_LICENSE', reason: 'Bảo trì hệ thống' });
    return route.fulfill(posts === 1 ? { status: 500, json: { message: 'Temporary failure' } } : { json: { commandId: 'command-1', licenseId: 'license-1', status: 'PENDING' } });
  });
  await page.route('**/api/v1/commands/command-1', (route) => route.fulfill({ json: { commandId: 'command-1', status: confirmed ? 'CONFIRMED' : 'PENDING' } }));
  await page.route('**/api/v1/licenses', (route) => route.fulfill({ json: [{ ...licenses[1], status: projectionUpdated ? 'SUSPENDED' : 'ACTIVE' }] }));
  await page.goto('/provider/licenses');
  await page.getByRole('button', { name: /Thao tác bản quyền/ }).click();
  await page.getByRole('menuitem', { name: 'Tạm ngưng bản quyền' }).click();
  const modal = page.getByRole('dialog', { name: 'Tạm ngưng bản quyền?' });
  await expect(modal.getByRole('button', { name: 'Xác nhận tạm ngưng' })).toBeDisabled();
  await modal.getByLabel('Lý do tạm ngưng').fill('Bảo trì hệ thống');
  await modal.getByRole('button', { name: 'Xác nhận tạm ngưng' }).click();
  await expect(modal.getByRole('alert')).toBeVisible();
  await expect(modal.getByLabel('Lý do tạm ngưng')).toHaveValue('Bảo trì hệ thống');
  await modal.getByRole('button', { name: 'Xác nhận tạm ngưng' }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('button', { name: /Thao tác bản quyền/ })).toBeDisabled();
  await expect(page.getByText('Có hiệu lực', { exact: true })).toBeVisible();
  confirmed = true;
  await expect(page.getByText('Yêu cầu đã được xác nhận. Đang cập nhật trạng thái bản quyền.')).toBeVisible();
  await expect(page.getByText('Có hiệu lực', { exact: true })).toBeVisible();
  projectionUpdated = true;
  await expect(page.getByText('Tạm ngưng', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Thao tác bản quyền/ })).toBeEnabled();
  expect(posts).toBe(2);
});

test('public ID copy and finality details do not invent transaction evidence', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockProvider(page);
  await page.goto('/provider/licenses?status=PENDING_ONCHAIN');
  await expect(page.getByRole('button', { name: 'Thông báo', exact: true })).toHaveCount(0);
  const id = page.getByRole('button', { name: `Sao chép mã bản quyền ${licenses[0].publicLicenseId}`, exact: true });
  await expect(id).toHaveText(licenses[0].publicLicenseId);
  await id.click();
  await expect(page.getByText('Đã sao chép mã bản quyền', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(licenses[0].publicLicenseId);
  await page.evaluate(() => navigator.clipboard.writeText('before-keyboard-copy'));
  await id.focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(licenses[0].publicLicenseId);
  await page.getByRole('button', { name: 'Xem chi tiết', exact: true }).first().click();
  const drawer = page.getByRole('dialog');
  await drawer.getByText('Thông tin kỹ thuật', { exact: true }).click();
  await expect(drawer.getByText('PENDING', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('link')).toHaveCount(0);
  await expect(drawer.getByText(/activationKey|fingerprint|Đã gửi.*Đã ghi nhận/)).toHaveCount(0);
  await drawer.getByRole('button', { name: `Sao chép mã bản quyền ${licenses[0].publicLicenseId}`, exact: true }).last().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(licenses[0].publicLicenseId);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'Mở menu vai trò' }).click();
  await expect(page.getByRole('button', { name: 'Thông báo', exact: true })).toHaveCount(0);
});

test('Drawer actions open a usable confirmation above the panel and cancel without mutation', async ({ page }) => {
  await mockProvider(page);
  let posts = 0;
  page.on('request', (request) => { if (request.url().endsWith('/lifecycle')) posts++; });
  await page.goto('/provider/licenses?status=SUSPENDED');
  await page.getByRole('button', { name: 'Xem chi tiết', exact: true }).first().click();
  const drawer = page.getByRole('dialog', { name: 'Chi tiết bản quyền' });
  await drawer.getByRole('button', { name: 'Thu hồi', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Thu hồi bản quyền?' });
  await expect(confirmation.getByRole('button', { name: 'Xác nhận thu hồi' })).toBeDisabled();
  await confirmation.getByLabel('Lý do thu hồi').fill('Kiểm tra thao tác');
  await expect(confirmation.getByRole('button', { name: 'Xác nhận thu hồi' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(confirmation).toBeHidden();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Thu hồi', exact: true })).toBeFocused();
  expect(posts).toBe(0);
});
