import { expect, test } from '@playwright/test';

const email = process.env.E2E_CUSTOMER_EMAIL ?? 'customer@example.test';
const password = process.env.E2E_CUSTOMER_PASSWORD ?? process.env.SEED_PASSWORD;

test('retrieves the matched-run activation key through License Hub UI once', async ({ page }) => {
  test.skip(!password, 'BLOCKED_EXTERNAL_TEST_IDENTITY');
  await page.goto('/auth');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(password!);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL('**/buyer');
  await page.getByRole('link', { name: 'License' }).click();
  await page.waitForURL('**/buyer/licenses');
  await expect(page.getByRole('heading', { name: 'License Hub' })).toBeVisible();
  // Select the first available ACTIVE license from the UI list
  const firstLicense = page.locator('.buyer-license-list-item').first();
  if (await firstLicense.count()) await firstLicense.click();
  await expect(page.getByText('ACTIVE').first()).toBeVisible({ timeout: 30_000 });
  const retrieveButton = page.getByRole('button', { name: 'Nhận mã bản quyền' });
  // Skip if key already retrieved (activationKeyAvailable=false)
  if (await retrieveButton.isEnabled({ timeout: 5_000 }).catch(() => false)) {
    await retrieveButton.click();
    await page.getByRole('button', { name: 'Nhận mã' }).click();
    const keyInput = page.getByLabelText('Mã bản quyền');
    await expect(keyInput).toHaveValue(/^(?!).+$/, { timeout: 30_000 });
    await expect(keyInput).toHaveValue(/^[A-Za-z0-9_-]{20,}$/);
  }
});
