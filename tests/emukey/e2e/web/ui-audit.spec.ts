import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const product = {
  id: 'audit-product', slug: 'audit-product', name: 'Phần mềm kiểm thử',
  summary: 'Sản phẩm dành riêng cho kiểm tra giao diện.', imageUrl: '/audit-unavailable-image.png',
  plans: [{ id: 'audit-plan', name: 'Gói tháng', priceVnd: 149000, maxActiveDevices: 2, durationMonths: 1, entitlements: {} }],
};

async function fixture(page: Page, role: string | null = null) {
  await page.route('**/audit-unavailable-image.png', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    if (path === '/auth/refresh') return route.fulfill(role ? {
      json: { accessToken: 'ui-audit-fixture', user: { id: 'audit-user', role, displayName: 'Tài khoản kiểm thử', email: 'audit@example.test', status: 'ACTIVE' } },
    } : { status: 401, json: { error: { code: 'UNAUTHORIZED' } } });
    if (path === '/products') return route.fulfill({ json: [product] });
    if (path === '/products/audit-product') return route.fulfill({ json: product });
    if (path === '/notifications') return route.fulfill({ json: { items: [], unreadCount: 0, nextCursor: null } });
    return route.fulfill({ json: [] });
  });
}

// Real-browser regressions: computed colors, focus, scroll and layout cannot be
// verified reliably by jsdom. All business requests remain fixture-controlled.
async function contrastRatio(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((element) => {
    const luminance = (color: string) => {
      const [r, g, b] = color.match(/[\d.]+/g)!.slice(0, 3).map((value) => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
    };
    let background: Element | null = element;
    while (background && getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement;
    const foreground = luminance(getComputedStyle(element).color);
    const surface = luminance(getComputedStyle(background!).backgroundColor);
    return (Math.max(foreground, surface) + 0.05) / (Math.min(foreground, surface) + 0.05);
  });
}

async function knowledgeFixture(page: Page) {
  await fixture(page, 'PROVIDER_ADMIN');
  const document = { id: 'audit-doc', title: 'Hướng dẫn kiểm thử', logicalDocumentKey: 'guide', version: 1, status: 'READY', isCurrent: false, productId: product.id };
  await page.route('**/api/v1/products/admin', (route) => route.fulfill({ json: [{ ...product, status: 'DRAFT' }] }));
  await page.route('**/api/v1/knowledge/documents', (route) => route.fulfill({ json: [document] }));
  await page.route('**/api/v1/knowledge/documents/audit-doc', (route) => route.fulfill({ json: { ...document, chunks: ['Nội dung tài liệu dài. '.repeat(150)] } }));
}

test.describe('overlay regressions', () => {
  for (const [role, route] of [['PROVIDER_ADMIN', '/provider'], ['SUPPORT_STAFF', '/support'], ['SYSTEM_ADMIN', '/system/console']] as const) {
    test(`active mobile navigation is readable for ${role}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 900 });
      await fixture(page, role);
      await page.goto(route);
      await page.getByRole('button', { name: 'Mở menu vai trò', exact: true }).click();
      const active = page.getByRole('dialog', { name: 'Menu điều hướng' }).locator('a.active').first();
      await expect(active).toBeVisible();
      expect(await contrastRatio(active)).toBeGreaterThanOrEqual(4.5);
      await active.hover();
      expect(await contrastRatio(active)).toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const width of [320, 768, 1440]) {
    test(`AI citation wraps inside its popup at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await fixture(page, 'CUSTOMER');
      await page.route('**/api/v1/conversations', (route) => route.fulfill({ json: { id: 'audit-conversation' } }));
      await page.route('**/api/v1/conversations/*/ai-ask', (route) => route.fulfill({ json: { answer: 'Câu trả lời kiểm thử.', citationDetails: [{ documentId: 'audit-doc', chunkId: 'chunk', documentTitle: 'Tài liệu hướng dẫn kiểm thử với tiêu đề dài ' + 'abcdefghij'.repeat(8), documentVersion: 1, excerpt: 'Trích dẫn minh họa.' }] } }));
      await page.goto('/buyer');
      await page.getByRole('button', { name: 'Mở chat chăm sóc khách hàng' }).click();
      const panel = page.getByRole('region', { name: 'Trợ lý AI Emukey' });
      await panel.getByLabel('Câu hỏi cho trợ lý AI').fill('Hướng dẫn');
      await panel.getByRole('button', { name: 'Hỏi', exact: true }).click();
      await expect(panel.getByRole('region', { name: 'Nguồn tham khảo' })).toBeVisible();
      expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    });

    test(`delivery retry clearly blocks closing while pending at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await fixture(page, 'PROVIDER_ADMIN');
      await page.route('**/api/v1/provider/integration', (route) => route.fulfill({ json: { status: 'ENABLED', hasCredential: true, configVersion: 1 } }));
      await page.route('**/api/v1/provider/license-deliveries?*', (route) => route.fulfill({ json: [{ id: 'audit-delivery', licenseId: 'license', revision: 1, status: 'FAILED', attemptCount: 1, acceptedAt: null }] }));
      let release!: () => void;
      const pending = new Promise<void>((resolve) => { release = resolve; });
      await page.route('**/api/v1/provider/license-deliveries/audit-delivery/retry', async (route) => { await pending; await route.fulfill({ status: 503, json: {} }); });
      try {
        await page.goto('/provider/operations?tab=integration');
        await page.getByRole('button', { name: 'Gửi lại', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Gửi lại bản quyền', exact: true });
        await dialog.getByRole('textbox').fill('Kiểm thử gửi lại');
        await dialog.getByRole('button', { name: 'Xác nhận gửi lại', exact: true }).click();
        await expect(dialog.getByRole('button', { name: 'Hủy', exact: true })).toBeDisabled();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeVisible();
        release();
        await expect(dialog.getByRole('alert')).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Hủy', exact: true })).toBeEnabled();
        await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
        await expect(dialog).toBeHidden();
      } finally { release(); }
    });
  }

  for (const width of [320, 768]) {
    test(`mobile menu blocks the floating assistant at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await fixture(page, 'CUSTOMER');
      await page.goto('/buyer');
      const assistant = page.getByRole('button', { name: 'Mở chat chăm sóc khách hàng' });
      await assistant.click();
      await expect(page.getByRole('region', { name: 'Trợ lý AI Emukey' })).toBeVisible();
      await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
      await expect(assistant).toBeHidden();
      await expect(page.getByRole('region', { name: 'Trợ lý AI Emukey' })).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(assistant).toBeVisible();
    });

    test(`customer notifications remain reachable at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await fixture(page, 'CUSTOMER');
      await page.route('**/api/v1/notifications', (route) => route.fulfill({ json: { items: [{ id: 'audit-notice', title: 'Thông báo kiểm thử có tiêu đề dài', content: 'Nội dung thông báo. '.repeat(20), isRead: true }], unreadCount: 0, nextCursor: null } }));
      await page.goto('/buyer');
      await page.getByRole('button', { name: 'Thông báo', exact: true }).click();
      await expect(page.getByText('Thông báo kiểm thử có tiêu đề dài', { exact: true })).toBeVisible();
      const popup = page.locator('.ant-popover').filter({ has: page.locator('.notification-popover') });
      await expect(popup).not.toHaveClass(/-appear|-enter/);
      await expect.poll(async () => {
        const box = (await popup.boundingBox())!;
        return box.x >= 0 && box.x + box.width <= width + 1;
      }).toBe(true);
    });
  }

  test('long document content can receive keyboard focus and scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await knowledgeFixture(page);
    await page.goto('/provider/knowledge');
    await page.getByRole('button', { name: 'Hướng dẫn kiểm thử', exact: true }).click();
    const region = page.getByRole('region', { name: 'Nội dung tài liệu', exact: true });
    await expect(region).toHaveAttribute('tabindex', '0');
    const close = page.getByRole('dialog', { name: 'Hướng dẫn kiểm thử' }).getByRole('button', { name: 'Close', exact: true });
    await close.focus();
    await page.keyboard.press('Tab');
    await expect(region).toBeFocused();
    await page.keyboard.press('PageDown');
    await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });

  test('upload product placeholder is readable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await knowledgeFixture(page);
    await page.goto('/provider/knowledge');
    await page.getByRole('button', { name: 'Tải tài liệu lên', exact: true }).click();
    const placeholder = page.getByRole('dialog', { name: 'Tải tài liệu sản phẩm' }).locator('.ant-select-placeholder');
    await expect(placeholder).toBeVisible();
    expect(await contrastRatio(placeholder)).toBeGreaterThanOrEqual(4.5);
  });
});

async function evidence(page: Page, name: string) {
  const folder = resolve(__dirname, '../../../../artifacts/ui-audit/2026-11-06-web', `${process.env.AUDIT_EVIDENCE_PHASE ?? 'after'}-fixture`);
  await mkdir(folder, { recursive: true });
  await page.screenshot({ path: resolve(folder, `${name}.png`), fullPage: true });
}

test('mobile public navigation moves focus into its modal and restores it on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto('/catalog');
  await expect(page.getByRole('heading', { name: 'Sản phẩm', exact: true })).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Mở menu', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Menu chính' });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  const first = dialog.getByRole('button', { name: 'Đóng menu', exact: true });
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Đăng ký', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('customer shopping navigation stays selected on authenticated catalog aliases', async ({ page }) => {
  await fixture(page, 'CUSTOMER');
  await page.goto('/buyer/products');
  await expect(page.getByRole('heading', { name: 'Sản phẩm', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Điều hướng Customer', exact: true }).getByRole('link', { name: 'Mua sắm' })).toHaveAttribute('aria-current', 'page');
});

test('buyer overview has a visible main heading and a working skip destination', async ({ page }) => {
  await fixture(page, 'CUSTOMER');
  await page.goto('/buyer');
  await expect(page.getByRole('heading', { name: 'Tổng quan tài khoản', level: 1 })).toBeVisible();
  await expect(page.locator('#main-content')).toHaveCount(1);
});

for (const [role, route] of [
  [null, '/'], [null, '/help'], [null, '/verify'], [null, '/products/audit-product'],
  ['CUSTOMER', '/buyer/licenses'], ['CUSTOMER', '/buyer/profile'], ['CUSTOMER', '/buyer/checkout'],
] as const) {
  test(`skip navigation reaches the content at ${route}`, async ({ page }) => {
    await fixture(page, role);
    await page.goto(route);
    const skip = page.getByRole('link', { name: 'Bỏ qua đến nội dung chính', exact: true });
    await expect(skip).toHaveCount(1);
    const href = await skip.getAttribute('href');
    const target = page.locator(href!);
    await expect(target).toHaveCount(1);
    await skip.focus();
    await page.keyboard.press('Enter');
    await expect(target).toBeFocused();
  });
}

test('a failed product image uses the local artwork instead of a broken image', async ({ page }) => {
  await fixture(page);
  await page.goto('/catalog');
  const artwork = page.getByRole('img', { name: 'Minh họa Phần mềm kiểm thử' });
  await expect(artwork).toBeVisible();
  await expect(artwork.locator('img')).toHaveAttribute('src', /(?:\.svg|^data:image\/svg\+xml)/);
  await expect.poll(() => artwork.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});

test('tablet comparison starts near the page heading without a large blank gap', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await fixture(page);
  await page.goto('/compare');
  const heading = page.getByRole('heading', { name: 'So sánh gói bản quyền' });
  await expect(heading).toBeVisible();
  expect((await heading.boundingBox())!.y).toBeLessThan(260);
  const selection = page.getByLabel('Chọn gói để so sánh');
  await expect(selection).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('catalog error has a retry and does not retain stale pagination', async ({ page }) => {
  await fixture(page);
  await page.route('**/api/v1/products', (route) => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }));
  await page.goto('/catalog');
  await expect(page.getByRole('alert')).toContainText('Không thể tải danh mục');
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible();
  await expect(page.locator('.ant-pagination')).toHaveCount(0);
});

test('direct access by the wrong role shows 403 without leaking the system workspace', async ({ page }) => {
  await fixture(page, 'CUSTOMER');
  await page.goto('/system/console');
  await expect(page.getByText('Không có quyền truy cập', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Người dùng', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/system\/console$/);
});

test('an empty support queue starts below the mobile header and exposes delivery as a panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, 'SUPPORT_STAFF');
  await page.goto('/support');
  const heading = page.getByRole('heading', { name: 'Hàng đợi hỗ trợ', level: 1 });
  await expect(heading).toBeVisible();
  expect((await heading.boundingBox())!.y).toBeLessThan(220);
  const toggle = page.getByRole('button', { name: 'Theo dõi bàn giao bản quyền' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: 'Bàn giao bản quyền', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/support$/);
});

for (const role of ['CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN']) {
  test(`account control includes its visible label for ${role}`, async ({ page }) => {
    await fixture(page, role);
    await page.goto(role === 'CUSTOMER' ? '/buyer' : role === 'PROVIDER_ADMIN' ? '/provider/catalog' : '/system/console');
    await expect(page.getByRole('button', { name: /Mở menu tài khoản/ })).toBeVisible();
    await evidence(page, `account-label-${role}`);
    const control = page.getByRole('button', { name: /Mở menu tài khoản/ });
    const visibleName = await control.locator('strong,.account-name').innerText();
    const initials = await control.locator('.user-avatar-initials,.provider-account-avatar,.system-account-avatar').innerText();
    const accessibleName = await control.getAttribute('aria-label');
    expect(accessibleName).toContain(visibleName);
    expect(accessibleName).toContain(initials);
  });
}

test('featured page controls have a usable touch target on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.route('**/api/v1/products', (route) => route.fulfill({ json: Array.from({ length: 6 }, (_, index) => ({ ...product, id: `product-${index}`, slug: `product-${index}`, name: `Sản phẩm ${index + 1}` })) }));
  await page.goto('/');
  const dots = page.getByRole('tablist', { name: 'Chọn trang sản phẩm' }).getByRole('tab');
  await expect(dots).toHaveCount(6);
  await dots.first().scrollIntoViewIfNeeded();
  await evidence(page, 'featured-touch-mobile');
  for (const dot of await dots.all()) {
    const box = (await dot.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  }
});

test('support sidebar logout text has readable contrast on its button', async ({ page }) => {
  await fixture(page, 'SUPPORT_STAFF');
  await page.goto('/support');
  const logout = page.getByRole('button', { name: 'Đăng xuất', exact: true });
  await expect(logout).toBeVisible();
  await evidence(page, 'support-logout-contrast');
  const ratio = await logout.evaluate((button) => {
    const luminance = (color: string) => {
      const values = color.match(/[\d.]+/g)!.slice(0, 3).map((value) => {
        const channel = Number(value) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
    };
    const foreground = luminance(getComputedStyle(button.querySelector('span')!).color);
    const background = luminance(getComputedStyle(button).backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('support sidebar actions keep their labels inside each button', async ({ page }) => {
  await fixture(page, 'SUPPORT_STAFF');
  await page.goto('/support');
  const profile = page.getByRole('button', { name: /Hồ sơ/ });
  await expect(profile).toBeVisible();
  const bounds = await profile.evaluate((button) => ({ button: button.getBoundingClientRect().right, label: button.querySelector(':scope > span:last-child')!.getBoundingClientRect().right }));
  expect(bounds.label).toBeLessThanOrEqual(bounds.button);
});

test('mobile role menu includes its visible text in the accessible name', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, 'PROVIDER_ADMIN');
  await page.goto('/provider/catalog');
  const menu = page.getByRole('button', { name: 'Mở menu vai trò', exact: true });
  await expect(menu).toBeVisible();
  const visibleLabel = await menu.locator('span:not([aria-hidden])').innerText();
  expect((await menu.getAttribute('aria-label'))!.toLocaleLowerCase('vi')).toContain(visibleLabel.toLocaleLowerCase('vi'));
});

test('empty provider deliveries do not create a keyboard-inaccessible horizontal table', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await fixture(page, 'PROVIDER_ADMIN');
  await page.goto('/provider/operations?tab=integration');
  const deliveries = page.getByRole('region', { name: 'Bàn giao bản quyền', exact: true });
  await expect(deliveries.getByText('Chưa có bản quyền bàn giao.', { exact: true })).toBeVisible();
  await expect(deliveries.locator('.ant-table-content')).toHaveCount(0);
});

test('a delivery API failure does not claim that there are no deliveries', async ({ page }) => {
  await fixture(page, 'PROVIDER_ADMIN');
  await page.route('**/api/v1/provider/license-deliveries?*', (route) => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }));
  await page.goto('/provider/operations?tab=integration');
  const deliveries = page.getByRole('region', { name: 'Bàn giao bản quyền', exact: true });
  await expect(deliveries.getByRole('alert')).toContainText('Không thể tải lịch sử bàn giao');
  await expect(deliveries.getByText('Chưa có bản quyền bàn giao.', { exact: true })).toHaveCount(0);
  await expect(deliveries.getByRole('button', { name: 'Tải lại bàn giao' })).toBeEnabled();
});
