import path from 'node:path';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const out = path.resolve(process.cwd(), 'visual-regression', 'runtime-after');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.route('**/api/v1/auth/refresh', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'x', user: { id: 'u', email: 'e', displayName: 'Minh An', role: 'CUSTOMER', status: 'ACTIVE' } }) }));
await page.route('**/api/v1/licenses', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
await page.route('**/api/v1/orders', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
await page.route('**/api/v1/notifications', async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
const results = [];
for (const route of ['/', '/buyer', '/buyer/orders']) {
  await page.goto(`http://localhost:5174${route}`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => globalThis.document.fonts.ready);
  const file = `${route === '/' ? 'home' : 'buy'}_verify.png`;
  await page.screenshot({ path: path.join(out, file) });
  const data = await page.evaluate(() => {
    const rect = (sel) => { const el = globalThis.document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), y: Math.round(r.y), h: Math.round(r.height) }; };
    return {
      route: globalThis.location.pathname,
      hero: rect('.public-home-hero'),
      content: rect('.public-home-content'),
      featured: rect('.public-home-featured'),
      headerActions: rect('.header-actions'),
      notification: rect('.notification-wrapper'),
      account: rect('.account-pill'),
      nav: rect('.public-nav'),
    };
  });
  results.push({ route, screenshot: file, data });
}
await browser.close();
await writeFile(path.join(out, 'verify.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));