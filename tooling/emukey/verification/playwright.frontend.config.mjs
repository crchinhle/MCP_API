import { createRequire } from 'node:module';
const requireFrontend = createRequire(new URL('../../../EmuKey/frontend/package.json', import.meta.url));
const { defineConfig } = requireFrontend('@playwright/test');
import { resolve } from 'node:path';

const workspace = resolve(import.meta.dirname, '../../..');

const baseURL = process.env.BASE_URL?.trim() || 'http://127.0.0.1:5173';
const external = process.env.E2E_EXTERNAL === 'true';
const frontendHost = new URL(baseURL).hostname;
const webServer = external
  ? undefined
  : [
      {
        command: 'corepack pnpm build && corepack pnpm start:api',
        cwd: resolve(workspace, 'EmuKey/backend'),
        url: 'http://localhost:3000/api/v1/health/live',
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
      {
        command: `corepack pnpm exec vite --host ${frontendHost} --port ${new URL(baseURL).port || 5173} --strictPort`,
        cwd: resolve(workspace, 'EmuKey/frontend'),
        url: baseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
    ].filter((_, index) => process.env.E2E_WEB_ONLY !== 'true' || index === 1);

export default defineConfig({
  testDir: resolve(workspace, 'tests/emukey/e2e/web'),
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: resolve(workspace, 'docs/emukey/evidence/playwright-report'), open: 'never' }]],
  outputDir: resolve(workspace, 'docs/emukey/evidence/test-results'),
  ...(webServer ? { webServer } : {}),
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
