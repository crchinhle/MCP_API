import { expect, test } from '@playwright/test';

test('loads the public catalog and BC-05 verification surface through the real API', async ({ page }) => {
  const apiBaseUrl = process.env.E2E_API_BASE_URL ?? new URL('/api/v1', process.env.BASE_URL ?? 'http://localhost:5173').toString().replace(/\/$/, '');
  const readiness = await page.request.get(`${apiBaseUrl}/health/ready`);
  test.skip(!readiness.ok(), 'BLOCKED_EXTERNAL_STAGING_DATABASE_OR_DEPENDENCY');
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'Bản quyền phần mềm được xác lập on-chain' })).toBeVisible();
  await page.goto('/verify');
  await expect(page.getByRole('heading', { name: 'Xác minh Blockchain' })).toBeVisible();
  await page.getByLabel('Mã xác thực').fill('not-a-real-license-identifier');
  await page.getByRole('button', { name: 'Xác minh' }).click();
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy License');
});

test.describe('Phase 6 public activation API', () => {
  test.skip(true, 'Activation requires a real disposable key; use canonical-license-golden-flow.spec.ts for full purchase-to-activation E2E.');
});
