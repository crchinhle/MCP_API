import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const email = process.env.E2E_CUSTOMER_EMAIL ?? 'customer@example.test';
const password = process.env.E2E_CUSTOMER_PASSWORD ?? process.env.SEED_PASSWORD;
const runId = process.env.E2E_RUN_ID ?? `sepay-timing-${new Date().toISOString().replace(/[-:.TZ]/g, '')}`;
const waits = [0, 30, 90, 180, 0];

test.describe.serial('SePay Sandbox timing experiment', () => {
  test.skip(!password, 'BLOCKED_EXTERNAL_TEST_IDENTITY');

  test('runs five independent real browser payments and records timing anchors', async ({ browser }) => {
    test.setTimeout(15 * 60_000);
    const runs: Array<Record<string, string | number>> = [];

    for (const [index, waitSeconds] of waits.entries()) {
      const context = await browser.newContext();
      const page = await context.newPage();
      // Re-authenticate through the real login UI for every independent run.
      await page.goto('/auth');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Mật khẩu').fill(password!);
      await page.getByRole('button', { name: 'Đăng nhập' }).click();
      await page.waitForURL('**/buyer');
      await page.getByRole('link', { name: 'Emukey - Trang sản phẩm' }).click();
      await page.waitForURL('**/products');
      await expect(page.getByRole('heading', { name: 'Bản quyền phần mềm được xác lập on-chain' })).toBeVisible();
      await page.getByRole('link', { name: 'Chọn gói' }).first().click();
      await expect(page.getByRole('heading', { name: /Emukey Desktop|Sản phẩm/ })).toBeVisible();
      await page.getByRole('button', { name: 'Mua ngay' }).click();
      await page.waitForURL('**/buyer/checkout**');

      await page.getByRole('button', { name: 'Tạo đơn hàng' }).click();
      await expect(page.getByRole('heading', { name: 'Điều khoản cấp phép' })).toBeVisible({ timeout: 15_000 });
      const accept = page.getByRole('button', { name: 'Đồng ý và tiếp tục thanh toán' });
      await expect(accept).toBeDisabled();
      await page.getByText('Tôi đã đọc và đồng ý với điều khoản cấp phép').click();
      await accept.click();
      await page.waitForURL('**/buyer/orders/*/payment');
      const orderId = new URL(page.url()).pathname.split('/')[3];
      await expect(page.getByRole('heading', { name: 'Thanh toán đơn hàng' })).toBeVisible();
      await page.getByRole('button', { name: 'Tạo yêu cầu thanh toán' }).click();
      const form = page.getByTestId('sepay-checkout-form');
      await expect(form).toBeVisible();
      const paymentButton = page.getByRole('button', { name: /Thanh toán trên SePay Sandbox|Thanh toán trên SePay/ });
      await paymentButton.click();
      await page.waitForURL(/sepay/i, { timeout: 30_000 });
      if (waitSeconds > 0) await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1_000));
      const userPaymentClickAt = new Date().toISOString();
      await page.getByRole('button', { name: 'Giả lập thanh toán' }).click();
      await page.waitForURL(/localhost:5173\/buyer\/orders\/.*\/payment/, { timeout: 30_000 });
      runs.push({ runId: `${runId}-${index + 1}`, orderId: orderId ?? 'unknown', waitSeconds, userPaymentClickAt, returnedAt: new Date().toISOString() });
      await context.close();
    }

    const output = 'test-results/sepay-timing-runs.json';
    await mkdir('test-results', { recursive: true });
    await writeFile(output, `${JSON.stringify({ runId, runs }, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ phase8: 'SEPAY_TIMING_EXPERIMENT', runId, runs }, null, 2));
  });
});
