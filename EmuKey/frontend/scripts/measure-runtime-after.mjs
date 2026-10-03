import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'visual-regression', 'runtime-after');
await mkdir(outDir, { recursive: true });
const base = process.env.BASE_URL ?? 'http://localhost:5174';
const viewports = [
  { name: '1920', width: 1920, height: 1080 },
  { name: '1440', width: 1440, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
];
const routes = ['/', '/auth', '/products', '/buyer', '/buyer/orders', '/buyer/licenses', '/buyer/support'];
const selectors = { logo: '.brand-wordmark', header: '.site-header', nav: '.public-nav a', title: 'main h1, .workspace-page-header h1, main h2', body: 'body' };
const customInputs = ['input:not([type="hidden"])', 'button.ant-btn', '.auth-card', '.catalog-content', '.buyer-home-main', '.workspace-screen', '.product-card', '.buyer-home-metric', '.buyer-home-shortcut'];
const browser = await chromium.launch();
const results = [];
for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
  for (const route of routes) {
    const slug = route === '/' ? 'home' : route.slice(1).replaceAll('/', '__');
    const record = { route, viewport: vp.name, ok: false };
    try {
      await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async () => globalThis.document.fonts.ready);
      await page.screenshot({ path: path.join(outDir, `${vp.name}_${slug}.png`) });
      const fonts = await page.evaluate(() => ({ greatVibes: globalThis.document.fonts.check('34px "Great Vibes"'), plex: globalThis.document.fonts.check('16px "IBM Plex Sans"') }));
      const data = await page.evaluate(({ selectors, customInputs }) => {
        const grab = (sel) => { const el = globalThis.document.querySelector(sel); if (!el) return null; const s = globalThis.getComputedStyle(el); const r = el.getBoundingClientRect(); return { fontFamily: s.fontFamily, fontSize: parseFloat(s.fontSize) || null, lineHeight: s.lineHeight, fontWeight: s.fontWeight, padding: s.padding, width: Math.round(r.width), height: Math.round(r.height) }; };
        const out = {};
        for (const [k, v] of Object.entries(selectors)) out[k] = grab(v);
        for (const c of customInputs) out[`custom_${c}`] = grab(c);
        return out;
      }, { selectors, customInputs });
      record.ok = true; record.fonts = fonts; record.metrics = data;
    } catch (error) { record.error = error instanceof Error ? error.message : String(error); }
    results.push(record);
  }
  await context.close();
}
await browser.close();
await writeFile(path.join(outDir, 'runtime-after.json'), JSON.stringify({ generatedAt: new Date().toISOString(), base, results }, null, 2));
console.log('wrote', outDir, 'records', results.length);