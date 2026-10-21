import { expect, test, type Page } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Isolated HTTP fixtures exercise real UI boundaries; these are not live backend evidence.
async function systemFixture(page: Page) {
  const user = { id: 'admin', email: 'admin@example.test', displayName: 'System Administrator', role: 'SYSTEM_ADMIN', status: 'ACTIVE', phone: null, address: null };
  const buyer = { id: 'buyer', email: 'buyer@example.test', displayName: 'Buyer Account', role: 'CUSTOMER', status: 'ACTIVE', phone: '0901234567', address: null };
  const state = { lockRequests: 0, reconciliationRequests: 0, profileRequests: 0, failUsers: false, failProfile: false, failReconciliation: false, reviewStatus: 'OPEN', published: false, passwordRequests: 0, logoutRequests: 0, requests: [] as string[] };
  const invitations: { id: string; email: string; status: string; createdAt: string; sentAt: string; expiresAt: string }[] = [];
  const payments = () => Array.from({ length: 12 }, (_, index) => ({
    transactionId: `transaction-${index}`, providerEventId: `event-${index}`, providerTransactionReference: `SEPAY-${index}`,
    classification: index === 0 ? 'AMOUNT_MISMATCH' : 'MATCHED', reviewStatus: index === 0 ? state.reviewStatus : null,
    orderId: `order-${index}`, orderNumber: `ORDER-${index}`, orderType: 'NEW_PURCHASE', productNameSnapshot: 'EmuKey Software', planNameSnapshot: 'Business', amountVnd: 120000,
    receivedAt: '2026-10-21T01:00:00Z', providerOccurredAt: '2026-10-21T00:59:00Z',
  }));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const method = route.request().method();
    state.requests.push(`${method} ${path}`);
    if (path === '/auth/refresh') return route.fulfill({ json: { accessToken: 'isolated-system-test', user } });
    if (path === '/auth/users') return route.fulfill(state.failUsers ? { status: 500, json: {} } : { json: [buyer, user].filter((account) => `${account.displayName} ${account.email}`.toLowerCase().includes((url.searchParams.get('q') ?? '').toLowerCase())) });
    if (path === '/auth/users/buyer') return route.fulfill({ json: buyer });
    if (path === '/auth/users/buyer/lock') { state.lockRequests++; buyer.status = 'LOCKED'; return route.fulfill({ json: buyer }); }
    if (path === '/auth/users/buyer/unlock') { buyer.status = 'ACTIVE'; return route.fulfill({ json: buyer }); }
    if (path === '/auth/provider-invitations') {
      if (method === 'POST') {
        const payload = route.request().postDataJSON() as { email: string };
        expect(Object.keys(payload)).toEqual(['email']);
        const invitation = { id: 'invitation-1', email: payload.email, status: 'PENDING', createdAt: '2026-10-21T00:00:00Z', sentAt: '2026-10-21T00:00:00Z', expiresAt: '2026-10-22T00:00:00Z' };
        invitations.splice(0, invitations.length, invitation);
        return route.fulfill({ json: invitation });
      }
      return route.fulfill({ json: invitations });
    }
    if (path === '/auth/provider-invitations/inspect') return route.fulfill({ json: { email: 'invited@example.test', expiresAt: '2026-10-22T00:00:00Z' } });
    if (path === '/auth/provider-invitations/accept') {
      const payload = route.request().postDataJSON() as Record<string, string>;
      expect(Object.keys(payload).sort()).toEqual(['displayName', 'organizationName', 'password', 'token']);
      expect(payload.displayName).toBe('Provider Owner');
      expect(payload.organizationName).toBe('Provider Organization');
      return route.fulfill({ json: { id: 'new-provider', email: 'invited@example.test', role: 'PROVIDER_ADMIN', status: 'ACTIVE' } });
    }
    if (path === '/auth/profile' && method === 'PUT') {
      state.profileRequests++;
      if (state.failProfile) return route.fulfill({ status: 500, json: {} });
      Object.assign(user, route.request().postDataJSON());
      return route.fulfill({ json: user });
    }
    if (path === '/auth/password') { state.passwordRequests++; return route.fulfill({ status: 204 }); }
    if (path === '/auth/logout') { state.logoutRequests++; return route.fulfill({ status: 204 }); }
    if (path === '/operations/health/assistance') return route.fulfill({ json: { conversations: { supportActive: 1, waitingSupport: 2 }, notifications: { deadLetter: 0, pending: 0, retryableFailed: 0 } } });
    if (path === '/payments/history') return route.fulfill({ json: payments() });
    if (path === '/payments/review') return route.fulfill({ json: [{ ...payments()[0], id: 'review', reviewReason: state.reviewStatus === 'OPEN' ? null : 'Đã kiểm tra chứng từ ngân hàng' }] });
    if (path === '/payments/review/review') {
      expect(route.request().postDataJSON()).toEqual({ status: 'RESOLVED', reason: 'Đã kiểm tra chứng từ ngân hàng' });
      state.reviewStatus = 'RESOLVED';
      return route.fulfill({ json: { id: 'review', reviewStatus: state.reviewStatus } });
    }
    const documents = [
      { id: 'current', providerUserId: 'provider', productId: 'product', title: 'Hướng dẫn đã công bố', logicalDocumentKey: 'guide', version: 3, status: 'READY', isCurrent: !state.published },
      { id: 'next', providerUserId: 'provider', productId: 'product', title: 'Hướng dẫn đang chờ duyệt', logicalDocumentKey: 'guide', version: 4, status: 'READY', isCurrent: state.published },
    ];
    if (path === '/knowledge/documents') return route.fulfill({ json: documents });
    if (path === '/knowledge/documents/next') return route.fulfill({ json: { ...documents[1], chunks: ['Nội dung hướng dẫn sử dụng phần mềm.'] } });
    if (path === '/knowledge/documents/next/publish') {
      expect(route.request().postDataJSON()).toEqual({ expectedCurrentVersion: 3 });
      state.published = true; return route.fulfill({ json: { ...documents[1], isCurrent: true } });
    }
    if (path === '/operations/blockchain/reconcile') {
      state.reconciliationRequests++;
      if (state.failReconciliation) return route.fulfill({ status: 500, json: {} });
      return route.fulfill({ json: { indexedEvents: 2, processed: true, reconciledCommandIds: ['command-1'], projection: { licenseRepairs: 1, commandRepairs: 1, remainingMismatches: 2 }, health: { unknown_commands: 1, pending_events: 0, reorged_events: 0, active_without_finality: 0 } } });
    }
    if (path === '/notifications') return route.fulfill({ json: { items: [], nextCursor: null } });
    return route.fulfill({ status: 404, json: {} });
  });
  return state;
}

const routes = [
  ['/system/console', 'Tổng quan hệ thống'], ['/system/console?view=users', 'Quản lý người dùng'],
  ['/system/console?view=payments', 'Thanh toán & đối soát'], ['/system/console?view=blockchain', 'Đối soát blockchain'],
  ['/system/console/knowledge', 'Duyệt tài liệu'], ['/system/console/profile', 'Hồ sơ tài khoản'],
];

for (const [width, height] of [[320, 800], [768, 1024], [1024, 768], [1440, 1024], [1440, 900]]) {
  test(`all system routes fit ${width}x${height}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height });
    const state = await systemFixture(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [path, title] of routes) {
      state.requests.length = 0;
      await page.goto(path!);
      await expect(page.getByRole('heading', { name: title!, level: 1 })).toBeVisible();
      await expect(page.locator('.role-desktop-nav a.active')).toHaveCount(path === '/system/console/profile' ? 0 : 1);
      await expect(page.locator('.role-desktop-nav').getByRole('link', { name: 'Hồ sơ', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Thông báo', exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('.system-tabs')).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Sức khỏe hệ thống' })).toHaveCount(0);
      expect(state.requests.some((request) => request.includes('/health/ready'))).toBe(false);
      if (path !== '/system/console') {
        expect(state.requests.some((request) => request.includes('/health/'))).toBe(false);
      }
      if (width === 320 && path?.includes('view=users')) {
        await page.getByRole('row', { name: /buyer@example.test/ }).getByRole('button', { name: 'Xem chi tiết' }).click();
        const drawer = page.getByRole('dialog', { name: 'Chi tiết tài khoản' });
        await expect(drawer.getByText('0901234567')).toBeVisible();
        const box = await drawer.boundingBox();
        expect(Math.round(box!.width)).toBeLessThanOrEqual(320);
        await page.keyboard.press('Escape');
        await expect(drawer).toBeHidden();
      }
      if (width === 1440 && height === 900 && path?.includes('payments')) {
        const box = await page.getByRole('row', { name: /ORDER-0/ }).first().boundingBox();
        expect(box!.y + box!.height).toBeLessThan(900);
      }
      await page.screenshot({ path: join(tmpdir(), `emukey-admin-${routes.findIndex(([route]) => route === path)}-${width}x${height}.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test('sidebar supports history, deep links, refresh and extra filters', async ({ page }) => {
  await systemFixture(page);
  await page.goto('/system/console');
  const nav = page.locator('.role-desktop-nav');
  await nav.getByRole('link', { name: 'Người dùng', exact: true }).click();
  await nav.getByRole('link', { name: 'Thanh toán', exact: true }).click();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Quản lý người dùng', exact: true })).toBeVisible();
  await page.goForward();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Thanh toán & đối soát', exact: true })).toBeVisible();
  await page.goto('/system/console?view=payments&classification=AMOUNT_MISMATCH');
  await expect(nav.locator('a.active')).toHaveText('Thanh toán');
});

test('email-only invitations validate, confirm delivery and refresh the targeted invitation section', async ({ page }) => {
  const state = await systemFixture(page);
  await page.goto('/system/console');
  await page.getByRole('link', { name: 'Quản lý lời mời', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Lời mời nhà cung cấp' })).toBeFocused();
  await page.getByRole('button', { name: 'Mời nhà cung cấp', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Mời nhà cung cấp' });
  await expect(modal.getByRole('textbox')).toHaveCount(1);
  await expect(modal.getByRole('button', { name: 'Hủy', exact: true })).toBeVisible();
  for (const [width, height] of [[320, 800], [768, 1024], [1024, 768], [1440, 1024]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect(modal.getByRole('button', { name: 'Gửi lời mời', exact: true })).toBeVisible();
    expect((await modal.boundingBox())!.width).toBeLessThanOrEqual(width!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: join(tmpdir(), `emukey-provider-invitation-${width}x${height}.png`), fullPage: true });
  }
  await modal.getByLabel('Email nhà cung cấp', { exact: true }).fill('invalid-email');
  await modal.getByRole('button', { name: 'Gửi lời mời', exact: true }).click();
  await expect(modal.getByText('Email chưa đúng định dạng.')).toBeVisible();
  expect(state.requests.filter((request) => request === 'POST /auth/provider-invitations')).toHaveLength(0);
  await modal.getByLabel('Email nhà cung cấp', { exact: true }).fill(' Invited@Example.test ');
  await modal.getByRole('button', { name: 'Gửi lời mời', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByText('Đã gửi email mời nhà cung cấp.')).toBeVisible();
  const row = page.getByRole('row', { name: /invited@example.test/ });
  await expect(row.getByText('Đang chờ chấp nhận')).toBeVisible();
  await row.getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect(page.getByRole('dialog', { name: 'Chi tiết lời mời' }).getByText('invited@example.test')).toBeVisible();
  await page.keyboard.press('Escape');
  await row.getByRole('button', { name: 'Gửi lại lời mời' }).click();
  await expect.poll(() => state.requests.filter((request) => request === 'POST /auth/provider-invitations').length).toBe(2);
});

for (const [width, height] of [[320, 800], [768, 1024], [1024, 768], [1440, 1024]]) {
  test(`recipient onboarding verifies email and completes the profile at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: width!, height: height! });
    await systemFixture(page);
    await page.goto(`/auth?mode=provider-invite&token=${'a'.repeat(43)}`);
    await expect(page.getByRole('heading', { name: 'Thiết lập tài khoản nhà cung cấp', exact: true })).toBeVisible();
    const form = page.locator('form');
    await expect(form.getByLabel('Email', { exact: true })).toHaveValue('invited@example.test');
    await expect(form.getByLabel('Email', { exact: true })).toHaveAttribute('readonly', '');
    await expect(form.getByText(/EVM|MetaMask|Namespace/)).toHaveCount(0);
    await form.getByLabel('Tên người đại diện', { exact: true }).fill('Provider Owner');
    await form.getByLabel('Tên tổ chức', { exact: true }).fill('Provider Organization');
    await form.getByLabel('Mật khẩu', { exact: true }).fill('Provider-test@123');
    await form.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('Different-test@123');
    await form.getByRole('button', { name: 'Hoàn tất đăng ký' }).click();
    await expect(form.getByText('Mật khẩu xác nhận không khớp.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: join(tmpdir(), `emukey-provider-onboarding-${width}x${height}.png`), fullPage: true });
    await form.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('Provider-test@123');
    await form.getByRole('button', { name: 'Hoàn tất đăng ký' }).click();
    await expect(page.getByText('Tài khoản nhà cung cấp đã được tạo. Bạn có thể đăng nhập.')).toBeVisible();
    await expect(page).not.toHaveURL(/token=/);
  });
}

test('user actions require confirmation, preserve details and allow unlock', async ({ page }) => {
  const state = await systemFixture(page);
  await page.goto('/system/console?view=users');
  const row = page.getByRole('row', { name: /buyer@example.test/ });
  await row.getByRole('button', { name: 'Xem chi tiết' }).click();
  const drawer = page.getByRole('dialog', { name: 'Chi tiết tài khoản' });
  await expect(drawer.getByText('0901234567')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await row.getByRole('button', { name: /Thao tác tài khoản/ }).click();
  await page.getByRole('menuitem', { name: 'Khóa', exact: true }).click();
  expect(state.lockRequests).toBe(0);
  await page.getByRole('dialog', { name: 'Khóa tài khoản?' }).getByRole('button', { name: 'Khóa', exact: true }).click();
  await expect(row.getByText('Đã khóa')).toBeVisible();
  expect(state.lockRequests).toBe(1);
  await row.getByRole('button', { name: /Thao tác tài khoản/ }).click();
  await page.getByRole('menuitem', { name: 'Mở khóa', exact: true }).click();
  await page.getByRole('dialog', { name: 'Mở khóa tài khoản?' }).getByRole('button', { name: 'Mở khóa', exact: true }).click();
  await expect(row.getByText('Đang hoạt động')).toBeVisible();
  await page.getByLabel('Tìm người dùng', { exact: true }).fill('nobody');
  await expect(page.getByText('Không có người dùng phù hợp với bộ lọc.')).toBeVisible();
});

test('payment history, review evidence and pagination remain usable', async ({ page }) => {
  await systemFixture(page);
  await page.goto('/system/console?view=payments');
  await page.getByRole('button', { name: 'Kiểm tra giao dịch' }).click();
  await expect(page.getByRole('dialog', { name: 'Chi tiết rà soát thanh toán' }).getByText('SEPAY-0')).toBeVisible();
  await page.getByRole('button', { name: 'Ghi kết quả kiểm tra' }).click();
  const modal = page.getByRole('dialog', { name: 'Xác nhận kết quả kiểm tra' });
  await expect(modal.getByRole('button', { name: 'Lưu kết quả' })).toBeDisabled();
  await modal.getByLabel('Lý do xử lý thanh toán').fill('Đã kiểm tra chứng từ ngân hàng');
  await modal.getByRole('button', { name: 'Lưu kết quả' }).click();
  await expect(page.getByText('Không có giao dịch cần kiểm tra')).toBeVisible();
  await page.getByRole('button', { name: 'Lịch sử rà soát' }).click();
  await page.getByRole('button', { name: 'Xem chi tiết rà soát' }).click();
  await expect(page.getByRole('dialog', { name: 'Chi tiết rà soát thanh toán' }).getByText('Đã kiểm tra chứng từ ngân hàng')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Lịch sử rà soát' }).click();
  await page.getByTitle('2', { exact: true }).click();
  await expect(page.getByText('ORDER-10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: 'Chi tiết giao dịch' }).getByText('SEPAY-10')).toBeVisible();
});

test('blockchain failure can retry and remaining mismatches stay visible', async ({ page }) => {
  const state = await systemFixture(page);
  state.failReconciliation = true;
  await page.goto('/system/console?view=blockchain');
  await page.getByRole('button', { name: 'Chạy đối soát', exact: true }).click();
  expect(state.reconciliationRequests).toBe(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Chạy đối soát', exact: true }).click();
  await expect(page.getByText('Không thể chạy đối soát blockchain.')).toBeVisible();
  state.failReconciliation = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Chạy đối soát', exact: true }).click();
  await expect(page.getByText('Vẫn còn sai lệch cần kiểm tra.')).toBeVisible();
  expect(state.reconciliationRequests).toBe(2);
});

test('document publication confirms the observed version and refreshes the queue', async ({ page }) => {
  const state = await systemFixture(page);
  await page.goto('/system/console/knowledge');
  await expect(page.getByRole('button', { name: 'Hướng dẫn đã công bố', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Xem chi tiết' }).click();
  await expect(page.getByText('Nội dung hướng dẫn sử dụng phần mềm.')).toBeVisible();
  await page.getByRole('button', { name: 'Công bố tài liệu' }).click();
  expect(state.published).toBe(false);
  await page.getByRole('button', { name: 'Xác nhận công bố' }).click();
  await expect(page.getByText('Đã công bố tài liệu.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Công bố tài liệu' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByText('Không có tài liệu phù hợp với bộ lọc.')).toBeVisible();
});

test('profile dirty state, failed save and password session invalidation', async ({ page }) => {
  const state = await systemFixture(page);
  await page.goto('/system/console/profile');
  const save = page.getByRole('button', { name: 'Lưu thay đổi' });
  await expect(save).toBeDisabled();
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Updated Administrator');
  state.failProfile = true;
  await save.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Tên hiển thị', { exact: true })).toHaveValue('Updated Administrator');
  state.failProfile = false;
  await save.click();
  await expect(page.getByText('Đã cập nhật hồ sơ.')).toBeVisible();
  await expect(save).toBeDisabled();
  expect(state.profileRequests).toBe(2);
  await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Đổi mật khẩu' });
  await modal.getByLabel('Mật khẩu hiện tại', { exact: true }).fill('CurrentPassword@123');
  await modal.getByLabel('Mật khẩu mới', { exact: true }).fill('NewPassword@1234');
  await modal.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('NewPassword@1234');
  await modal.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
  await expect(page).toHaveURL(/\/auth\?/);
  expect(state.passwordRequests).toBe(1);
  expect(state.logoutRequests).toBe(1);
});

test('account menu keyboard, Escape and outside click; mobile focus trap', async ({ page }) => {
  await systemFixture(page);
  await page.goto('/system/console');
  const account = page.getByRole('button', { name: 'Mở menu tài khoản System Administrator' });
  await expect(account.locator('[data-icon="down"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /[←→↑↓↗↘]/ })).toHaveCount(0);
  await account.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: /Hồ sơ tài khoản/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await account.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('menuitem', { name: /Đổi mật khẩu/ })).toBeVisible();
  await page.getByRole('heading', { level: 1 }).click();
  await expect(page.getByRole('menu')).toBeHidden();
  await page.setViewportSize({ width: 320, height: 800 });
  const trigger = page.getByRole('button', { name: 'Mở menu vai trò' });
  await trigger.click();
  const mobile = page.getByRole('dialog', { name: 'Menu điều hướng' });
  await expect(mobile.getByRole('button', { name: 'Đóng menu', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(mobile.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('overview focuses on work and account request failures remain retryable', async ({ page }) => {
  const state = await systemFixture(page);
  await page.goto('/system/console');
  await expect(page.getByLabel('Tài liệu chờ duyệt: 1', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Thanh toán cần kiểm tra: 1', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Tổng tài khoản: 2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Tài liệu đã công bố: 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Yêu cầu hỗ trợ', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Sức khỏe hệ thống' })).toHaveCount(0);
  expect(state.requests.some((request) => request.includes('/health/ready'))).toBe(false);
  state.failUsers = true;
  await page.goto('/system/console?view=users');
  await expect(page.getByText('Không thể tải danh sách người dùng.')).toBeVisible();
  await expect(page.getByText('Chưa có tài khoản người dùng.')).toHaveCount(0);
  state.failUsers = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('row', { name: /buyer@example.test/ })).toBeVisible();
});

test('sidebar account name and role meet AA contrast against the rendered background', async ({ page }) => {
  await systemFixture(page);
  await page.goto('/system/console');
  const ratios = await page.locator('.system-account-trigger').evaluate((trigger) => {
    const luminance = (color: string) => {
      const values = color.match(/[\d.]+/g)!.slice(0, 3).map((value) => {
        const normalized = Number(value) / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
    };
    const background = luminance(getComputedStyle(document.querySelector('.role-sidebar')!).backgroundColor);
    return ['strong', 'small'].map((selector) => {
      const foreground = luminance(getComputedStyle(trigger.querySelector(selector)!).color);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
  });
  expect(ratios.every((ratio) => ratio >= 4.5)).toBe(true);
});
