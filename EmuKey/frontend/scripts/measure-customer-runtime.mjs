import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'visual-regression', 'runtime-after');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const results = [];
for (const vp of [{ name: '1920', width: 1920, height: 1080 }, { name: '390', width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  const page = await context.newPage();
  await page.route('**/api/v1/auth/refresh', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'runtime-token', user: { id: 'runtime', email: 'minh@example.test', displayName: 'Minh An', role: 'CUSTOMER', status: 'ACTIVE' } }) }));
  await page.route('**/api/v1/orders', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/v1/licenses', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/v1/notifications', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/v1/products', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  for (const route of ['/buyer', '/buyer/orders', '/buyer/licenses', '/buyer/support']) {
    await page.goto(`http://localhost:5174${route}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => globalThis.document.fonts.ready);
    const file = `${vp.name}_${route.slice(1).replaceAll('/', '__')}_auth.png`;
    await page.screenshot({ path: path.join(out, file), fullPage: false });
    const metrics = await page.evaluate(() => {
      const one = (selector) => { const el = globalThis.document.querySelector(selector); if (!el) return null; const s = globalThis.getComputedStyle(el); const r = el.getBoundingClientRect(); return { selector, fontFamily: s.fontFamily, fontSize: parseFloat(s.fontSize), lineHeight: s.lineHeight, width: Math.round(r.width), height: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) }; };
      return { route: globalThis.location.pathname, fonts: { greatVibes: globalThis.document.fonts.check('34px "Great Vibes"') }, header: one('.site-header'), logo: one('.brand-wordmark'), nav: one('.public-nav'), customerNav: one('.customer-navigation'), title: one('main h1') };
    });
    results.push({ viewport: vp.name, ...metrics, screenshot: file });
  }
  await context.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));