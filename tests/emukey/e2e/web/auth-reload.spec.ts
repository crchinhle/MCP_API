import { expect, test } from '@playwright/test';

test('restores the customer session after browser reload', async ({ page }) => {
  const email = process.env.E2E_CUSTOMER_EMAIL ?? 'customer@example.test';
  const password = process.env.E2E_CUSTOMER_PASSWORD ?? process.env.SEED_PASSWORD;
  test.skip(!password, 'BLOCKED_EXTERNAL_TEST_IDENTITY');
  await page.goto('/auth');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password!);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL('**/buyer');
  await page.reload();
  await expect(page).toHaveURL(/\/buyer$/);
  await expect(page.getByText(email)).toBeVisible({ timeout: 20_000 });
  await page.goto('/buyer/orders');
  await page.reload();
  await expect(page).toHaveURL(/\/buyer\/orders$/);
});
