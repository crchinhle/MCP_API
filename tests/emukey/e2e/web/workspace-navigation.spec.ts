import { expect, test } from '@playwright/test';

test('license command Retry stays reachable after lifecycle confirmation closes', async ({ page }) => {
  let failCommand = true;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/refresh')) return route.fulfill({ json: { accessToken: 'ux-fixture', user: { id: 'ux-user', email: 'ux@example.test', displayName: 'UX User', role: 'PROVIDER_ADMIN', status: 'ACTIVE' } } });
    if (path.endsWith('/licenses')) return route.fulfill({ json: [{ id: 'license-1', publicLicenseId: 'LICENSE-PUBLIC-ID', productName: 'UX Product', plan: { name: 'Plan', version: 1 }, status: 'ACTIVE', maxActiveDevices: 1, activeDeviceCount: 0, expiresAt: '2030-01-01T00:00:00Z', finality: 'CONFIRMED', confirmationCount: 2 }] });
    if (path.endsWith('/lifecycle')) {
      // A slow response makes the nested processing overlay appear before close.
      await new Promise((resolve) => setTimeout(resolve, 300));
      return route.fulfill({ json: { commandId: 'ux-command', licenseId: 'license-1', status: 'PENDING' } });
    }
    if (path.endsWith('/commands/ux-command')) return route.fulfill(failCommand ? { status: 500, json: { message: 'Unavailable' } } : { json: { commandId: 'ux-command', licenseId: 'license-1', status: 'CONFIRMED' } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/provider/licenses');
  await page.getByRole('button', { name: 'Tạm ngưng', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Xác nhận tạm ngưng bản quyền', exact: true });
  await confirmation.getByLabel('Lý do thay đổi trạng thái license').fill('UX regression reason');
  await confirmation.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByText('Không thể tải trạng thái yêu cầu')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  failCommand = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByText('Bản quyền đã được cập nhật.')).toBeVisible();
});

// Navigation/empty-state checks with an isolated API; these are not live integration evidence.
const workspaces = [
  { role: 'PROVIDER_ADMIN', routes: [
    ['/provider', 'Tổng quan nhà cung cấp'],
    ['/provider/catalog', 'Danh mục sản phẩm'],
    ['/provider/licenses', 'Bản quyền nhà cung cấp'],
    ['/provider/knowledge', 'Kho tri thức AI'],
    ['/provider/operations', 'Vận hành'],
    ['/provider/profile', 'Hồ sơ tài khoản'],
  ] },
  { role: 'SUPPORT_STAFF', routes: [
    ['/support', 'Hàng đợi hỗ trợ'],
    ['/support?view=resolved', 'Hàng đợi hỗ trợ'],
    ['/support/profile', 'Hồ sơ tài khoản'],
  ] },
  { role: 'SYSTEM_ADMIN', routes: [
    ['/system/console', 'Tổng quan hệ thống'],
    ['/system/console?view=users', 'Quản lý người dùng'],
    ['/system/console?view=payments', 'Lịch sử thanh toán'],
    ['/system/console?view=audit', 'Nhật ký hệ thống'],
    ['/system/console?view=blockchain', 'Đối soát blockchain'],
    ['/system/console/profile', 'Hồ sơ tài khoản'],
  ] },
] as const;

for (const workspace of workspaces) {
  for (const width of [390, 1280]) {
    test(`${workspace.role} routes and notifications at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/api/v1/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith('/notifications')) {
          const next = new URL(route.request().url()).searchParams.has('cursor');
          return route.fulfill({ json: { items: Array.from({ length: next ? 1 : 8 }, (_, i) => ({ id: `notice-${next ? 8 : i}`, title: `Notice ${next ? 8 : i}`, content: `Content ${i}`, isRead: true })), nextCursor: next ? null : 'page-2' } });
        }
        if (path.endsWith('/health/ready')) return route.fulfill({ json: { status: 'ready', dependencies: { postgres: 'up', redis: 'up' } } });
        if (path.endsWith('/operations/health/assistance')) return route.fulfill({ json: { conversations: { supportActive: 0, waitingSupport: 0 }, notifications: { deadLetter: 0, pending: 0, retryableFailed: 0 } } });
        if (path.endsWith('/operations/audit-logs')) return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
        await route.fulfill({ json: path.endsWith('/auth/refresh') ? {
          accessToken: 'workspace-test',
          user: { id: 'workspace-user', email: 'workspace@example.test', displayName: 'Workspace test', role: workspace.role, status: 'ACTIVE' },
        } : [] });
      });
      for (const [path, heading] of workspace.routes) {
        await page.goto(path);
        await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
      if (width === 390) await page.getByRole('button', { name: 'Mở menu vai trò' }).click();
      await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
      await page.getByRole('button', { name: 'Xem thêm thông báo' }).click();
      await expect(page.getByText('Notice 8', { exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}
