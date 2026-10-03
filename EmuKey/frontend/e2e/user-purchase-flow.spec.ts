import { expect, test } from '@playwright/test';

const email = process.env.E2E_CUSTOMER_EMAIL ?? 'customer@example.test';
const password = process.env.E2E_CUSTOMER_PASSWORD ?? process.env.SEED_PASSWORD;

test.describe('real customer purchase journey', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!password, 'BLOCKED_EXTERNAL_TEST_IDENTITY');

  test('catalog → login → order → Service Terms → SePay checkout', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'Bản quyền phần mềm được xác lập on-chain' })).toBeVisible();
    await page.getByRole('link', { name: 'Chọn gói' }).first().click();
    await expect(page.getByRole('heading', { name: /Emukey Desktop|Sản phẩm/ })).toBeVisible();
    const productResponse = await page.request.get(`${process.env.E2E_API_BASE_URL ?? 'http://localhost:3000/api/v1'}/products/EMUKEY_DESKTOP`);
    const product = await productResponse.json() as { plans: Array<{ id: string }> };
    const planId = product.plans[0]?.id;
    if (!planId) throw new Error('PUBLISHED_PLAN_NOT_FOUND');
    await page.getByRole('button', { name: 'Mua ngay' }).click();
    await page.waitForURL('**/auth');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mật khẩu').fill(password!);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL('**/buyer');
    // The current auth redirect lands on the buyer dashboard; continue through
    // the same public purchase entry point rather than bypassing the UI.
    await page.getByRole('link', { name: 'Emukey - Trang sản phẩm' }).click();
    await page.waitForURL('**/products');
    await page.getByRole('link', { name: 'Chọn gói' }).first().click();
    await page.getByRole('button', { name: 'Mua ngay' }).click();
    await page.waitForURL('**/buyer/checkout**');

    await expect(page.getByRole('heading', { name: 'Hoàn tất mua bản quyền' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Điều khoản cấp phép' })).toBeVisible({ timeout: 15_000 });
    const acceptButton = page.getByRole('button', { name: 'Đồng ý và tiếp tục thanh toán' });
    await expect(acceptButton).toBeDisabled();
    await page.getByText('Tôi đã đọc và đồng ý với điều khoản cấp phép').click();
    await acceptButton.click();
    await page.waitForURL(/\/buyer\/orders\/.*\/payment|sepay/i, { timeout: 30_000 });
    if (!/sepay/i.test(page.url())) await page.waitForURL(/sepay/i, { timeout: 30_000 });
    await expect(page).toHaveURL(/sepay/i);
    const providerTitle = await page.title();
    const providerText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600);
    console.log(JSON.stringify({ phase8: 'SEPAY_PROVIDER_UI', urlHost: new URL(page.url()).host, title: providerTitle, textPreview: providerText }));
    const simulatePayment = page.getByRole('button', { name: 'Giả lập thanh toán' });
    await expect(simulatePayment).toBeVisible();
    await simulatePayment.click();
    await page.waitForURL(/localhost:5173\/buyer\/orders\/.*\/payment/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Thanh toán đơn hàng' })).toBeVisible();
    await page.waitForTimeout(5_000);
    await expect(page).not.toHaveURL(/pay-sandbox\.sepay\.vn/i);
    await expect(page.getByRole('heading', { name: 'Thanh toán đơn hàng' })).toBeVisible();
    await expect(page.getByText(/Bản quyền đã sẵn sàng|Đang kích hoạt bản quyền|Đang xác nhận thanh toán/)).toBeVisible({ timeout: 90_000 });
    const keyButton = page.getByRole('button', { name: 'Nhận mã kích hoạt' });
    if (await keyButton.count()) {
      await keyButton.click();
      await expect(page.getByLabel('Mã kích hoạt')).toHaveValue(/.+/, { timeout: 30_000 });
    }
  });
});
