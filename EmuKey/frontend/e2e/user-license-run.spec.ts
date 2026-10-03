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
  // The latest timing run is the last canonical license returned by the UI.
  const latestLicenseMarker = page.getByText('EMU-D767CD7315A46AA9AD6');
  if (await latestLicenseMarker.count()) await latestLicenseMarker.click();
  await expect(page.getByText('ACTIVE').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Nhận activation key' }).first().click();
  await expect(page.getByText('Đã nhận activation key')).toBeVisible({ timeout: 30_000 });
  const keyInput = page.getByLabel('Activation key sử dụng trên thiết bị');
  await expect(keyInput).toHaveValue(/.+/);
  // Do not print or persist the secret value.
  await expect(keyInput).toHaveValue(/^[A-Za-z0-9_-]{20,}$/);
});
