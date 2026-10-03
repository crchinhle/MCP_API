import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routeMapPath = path.join(root, 'visual-regression', 'route-map.json');
const artifactRoot = path.join(root, 'visual-regression', 'artifacts');
const routeMap = JSON.parse(await readFile(routeMapPath, 'utf8'));
const viewports = [
  { name: 'desktop', width: 1440, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];
const routes = routeMap.screens.filter((screen) => !screen.route.includes(':'));
const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';

await mkdir(artifactRoot, { recursive: true });
const browser = await chromium.launch();
const manifest = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; caret-color: transparent !important; }' });

  for (const screen of routes) {
    const slug = screen.route === '/' ? 'home' : screen.route.slice(1).replaceAll('/', '__');
    const output = path.join(artifactRoot, `${slug}__${viewport.name}.png`);
    const url = `${baseURL}${screen.route}`;
    const record = {
      route: screen.route,
      component: screen.component,
      figmaNode: screen.figmaNode,
      viewport: `${viewport.width}x${viewport.height}`,
      codeScreenshot: output,
      figmaScreenshot: null,
      overlay: null,
      diff: null,
      status: screen.figmaNode ? 'CODE_CAPTURED_FIGMA_REFERENCE_REQUIRED' : 'CODE_CAPTURED_FIGMA_NODE_REQUIRED',
    };
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(async () => globalThis.document.fonts?.ready);
      await page.screenshot({ path: output, fullPage: false });
    } catch (error) {
      record.status = 'CODE_CAPTURE_FAILED';
      record.error = error instanceof Error ? error.message : String(error);
    }
    manifest.push(record);
  }
  await context.close();
}

await browser.close();
await writeFile(path.join(artifactRoot, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), records: manifest }, null, 2));
console.log(JSON.stringify({ artifactRoot, records: manifest.length }, null, 2));
