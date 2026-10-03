import { expect, test } from '@playwright/test';

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
        if (path.endsWith('/health/ready')) return route.fulfill({ json: { status: 'ready', dependencies: { postgres: 'up', redis: 'up' } } });
        if (path.endsWith('/operations/health/assistance')) return route.fulfill({ json: { conversations: { supportActive: 0, waitingSupport: 0 }, notifications: { deadLetter: 0, pending: 0, retryableFailed: 0 } } });
        if (path.endsWith('/operations/audit-logs')) return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
        await route.fulfill({ json: path.endsWith('/auth/refresh') ? {
          accessToken: 'workspace-test',
          user: { id: 'workspace-user', email: 'workspace@example.test', displayName: 'Workspace test', role: workspace.role, status: 'ACTIVE' },
        } : path.endsWith('/notifications') ? Array.from({ length: 9 }, (_, i) => ({ id: `notice-${i}`, title: `Notice ${i}`, content: `Content ${i}`, isRead: true })) : [] });
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
