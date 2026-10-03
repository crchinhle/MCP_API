import { expect, test } from '@playwright/test';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const activationKey = process.env.E2E_ACTIVATION_KEY;

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

test.describe('Phase 6 real customer flow', () => {
  test.skip(
    !activationKey,
    'Set E2E_ACTIVATION_KEY for a disposable active license with available device quota.',
  );

  test('activates with a public bearer key and device proof without purchaser login', async ({ request }) => {
    const account = privateKeyToAccount(generatePrivateKey());
    const deviceRef = `playwright-${Date.now()}`;
    const api = process.env.E2E_API_BASE_URL ?? new URL('/api/v1', process.env.BASE_URL ?? 'http://localhost:5173').toString().replace(/\/$/, '');
    const challengeResponse = await request.post(`${api}/activations/challenge`, { data: { activationKey, deviceRef } });
    expect(challengeResponse.ok()).toBeTruthy();
    const { challenge } = await challengeResponse.json();
    const proof = await account.signMessage({ message: challenge });
    const response = await request.post(`${api}/activations`, { data: {
      activationKey, deviceRef, challenge, proof, devicePublicKey: account.address,
    } });
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toMatchObject({ status: 'ACTIVE', bindingGeneration: 1 });
  });
});
