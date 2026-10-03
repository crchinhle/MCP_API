import { defineConfig } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';
const external = process.env.E2E_EXTERNAL === 'true';
const webServer = external
  ? undefined
  : [
      {
        command: 'corepack pnpm --dir ../backend build && corepack pnpm --dir ../backend start:api',
        url: 'http://localhost:3000/api/v1/health/live',
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
      {
        command: 'corepack pnpm dev -- --host 0.0.0.0',
        url: 'http://localhost:5173',
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
    ];

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  ...(webServer ? { webServer } : {}),
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
