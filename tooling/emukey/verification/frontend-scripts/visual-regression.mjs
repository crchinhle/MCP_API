import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const requireFrontend = createRequire(new URL('../../../../EmuKey/frontend/package.json', import.meta.url));
const { chromium, expect } = requireFrontend('@playwright/test');
const ts = requireFrontend('typescript');

const workspace = path.resolve(import.meta.dirname, '../../../..');

// Discover the actual JSX route tree, including nested/index routes. The old
// Figma mapping is reference metadata, never the authority for audit coverage.
export async function discoverAuditRoutes() {
  const source = await readFile(path.join(workspace, 'EmuKey/frontend/src/presentation/app/App.tsx'), 'utf8');
  const file = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const routes = [];
  function visit(node, prefix = '', inheritedRole = 'GUEST') {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening?.tagName.getText(file) === 'Route') {
      const attributes = opening.attributes.properties;
      const pathAttribute = attributes.find((attribute) => attribute.name?.getText(file) === 'path');
      const segment = pathAttribute?.initializer?.text;
      const element = attributes.find((attribute) => attribute.name?.getText(file) === 'element')?.getText(file) ?? '';
      const role = element.match(/roles=\{\['([^']+)'\]/)?.[1] ?? inheritedRole;
      const resolved = segment?.startsWith('/') ? segment : segment ? `${prefix}/${segment}` : prefix;
      const route = resolved.includes('*') ? '/__ui-audit-not-found__' : resolved;
      const component = element.match(/<([A-Za-z]+Screen|NotFoundPage)\b/)?.[1];
      if (component) routes.push({ routePattern: route || '/', role, component, source: 'App.tsx' });
      if (ts.isJsxElement(node)) node.children.forEach((child) => visit(child, resolved, role));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, prefix, inheritedRole));
  }
  visit(file);
  const shell = await readFile(path.join(workspace, 'EmuKey/frontend/src/presentation/components/RoleShell.tsx'), 'utf8');
  for (const match of shell.matchAll(/to:\s*'(\/[^']*\?[^']+)'/g)) {
    const parent = routes.find((route) => route.routePattern === match[1].split('?')[0]);
    if (parent) routes.push({ ...parent, routePattern: match[1], source: 'RoleShell.tsx' });
  }
  const authSource = await readFile(path.join(workspace, 'EmuKey/frontend/src/presentation/screens/AuthScreen.tsx'), 'utf8');
  const authFile = ts.createSourceFile('AuthScreen.tsx', authSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function authModes(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(authFile) === 'authCopy' && ts.isObjectLiteralExpression(node.initializer)) {
      const parent = routes.find((route) => route.routePattern === '/auth');
      for (const property of node.initializer.properties) {
        const mode = property.name?.getText(authFile).replaceAll(/['"]/g, '');
        if (mode && mode !== 'login') routes.push({ ...parent, routePattern: `/auth?mode=${mode}`, source: 'AuthScreen.tsx' });
      }
    }
    ts.forEachChild(node, authModes);
  }
  authModes(authFile);
  const operations = await readFile(path.join(workspace, 'EmuKey/frontend/src/presentation/screens/ProviderOperationsScreen.tsx'), 'utf8');
  if (/searchParams\.get\('tab'\)\s*===\s*'integration'/.test(operations)) {
    const parent = routes.find((route) => route.routePattern === '/provider/operations');
    routes.push({ ...parent, routePattern: '/provider/operations?tab=integration', source: 'ProviderOperationsScreen.tsx' });
  }
  return [...new Map(routes.map((route) => [`${route.role}:${route.routePattern}`, route])).values()];
}

function auditArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}

async function runAudit() {
  const inventory = await discoverAuditRoutes();
  if (process.argv.includes('--inventory')) {
    console.log(JSON.stringify(inventory, null, 2));
    return;
  }
  const phase = auditArg('--phase', 'before');
  if (!['before', 'after'].includes(phase)) throw new Error('Audit phase must be before or after');
  const state = auditArg('--state', 'normal');
  if (!['normal', 'empty', 'error', 'loading'].includes(state)) throw new Error('Unknown audit state');
  const manifestName = `manifest-${phase}${state === 'normal' ? '' : `-${state}`}.json`;
  const runId = auditArg('--run-id', new Date().toISOString().replaceAll(/[:.]/g, '-'));
  if (!/^[\w-]+$/.test(runId)) throw new Error('Invalid audit run ID');
  const output = path.join(workspace, 'artifacts/ui-audit', runId);
  await mkdir(output, { recursive: true });
  const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
  const accounts = process.env.AUDIT_ACCOUNTS ? JSON.parse(await readFile(process.env.AUDIT_ACCOUNTS, 'utf8')) : [];
  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ].filter((viewport) => auditArg('--viewports', 'desktop,tablet,mobile').split(',').includes(viewport.name));
  const roles = auditArg('--roles', 'GUEST,CUSTOMER,PROVIDER_ADMIN,SUPPORT_STAFF,SYSTEM_ADMIN').split(',');
  const browser = await chromium.launch();
  const records = process.argv.includes('--resume')
    ? JSON.parse(await readFile(path.join(output, manifestName), 'utf8')).records.filter((record) => record.status === 'CAPTURED') : [];
  const save = () => writeFile(path.join(output, manifestName), JSON.stringify({
    runId, phase, state, baseURL, browser: browser.version(), platform: process.platform,
    generatedAt: new Date().toISOString(), inventory, records,
  }, null, 2));
  try {
    for (const role of roles) {
      const context = await browser.newContext({ locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', deviceScaleFactor: 1 });
      try {
        let token;
        if (role !== 'GUEST') {
          const account = accounts.find((candidate) => candidate.role === role);
          if (!account) throw new Error('No local test account supplied for role');
          const response = await context.request.post(`${baseURL}/api/v1/auth/login`, { data: { email: account.email, password: account.password } });
          const session = await response.json();
          if (!response.ok() || session.user?.role !== role) throw new Error(`Login failed for role (${response.status()})`);
          token = session.accessToken;
        }
        const api = async (route) => {
          const response = await context.request.get(`${baseURL}/api/v1${route}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          return response.ok() ? response.json() : null;
        };
        const products = await api('/products') ?? [];
        const orders = role === 'CUSTOMER' ? await api('/orders') ?? [] : [];
        const licenses = role === 'CUSTOMER' ? await api('/licenses') ?? [] : [];
        const values = { productId: products[0]?.id, slug: products[0]?.slug, id: orders[0]?.id, licenseId: licenses[0]?.id };
        const routes = inventory.filter((route) => route.role === role);
        if (role !== 'GUEST') {
          for (const routePattern of ['/', '/catalog', '/verify', '/help']) {
            routes.push({ ...inventory.find((route) => route.routePattern === routePattern), role });
          }
          routes.push({ role, routePattern: role === 'SYSTEM_ADMIN' ? '/provider' : '/system/console', component: 'ForbiddenPage', state: 'forbidden' });
        }
        const dataScreens = /PublicHomeScreen|CatalogScreen|ProductDetailScreen|ComparePlansScreen|BuyerHomeScreen|BuyerOrdersScreen|BuyerLicenseHubScreen|BuyerRenewalScreen|ProviderCatalogScreen|ProviderLicensesScreen|ProviderDashboardScreen|SupportConsoleScreen|SystemConsoleScreen|AiKnowledgeScreen|ProviderOperationsScreen|BuyerAssistanceScreen|PaymentStatusScreen/;
        const emptyScreens = /^(CatalogScreen|BuyerHomeScreen|BuyerOrdersScreen|BuyerLicenseHubScreen|ProviderCatalogScreen|ProviderLicensesScreen|SupportConsoleScreen|AiKnowledgeScreen)$/;
        const selectedRoutes = routes.filter((screen) => (state === 'normal' || (state === 'empty' ? emptyScreens : dataScreens).test(screen.component))
          && (!auditArg('--route', '') || new RegExp(auditArg('--route', '')).test(screen.routePattern)));
        for (const viewport of viewports) {
          const page = await context.newPage();
          await page.setViewportSize(viewport);
          let holdRequests = false;
          let releaseRequests = [];
          await page.route('**/api/v1/**', async (route) => {
            try {
            const request = route.request();
            const pathname = new URL(request.url()).pathname;
            if (request.method() !== 'GET') return route.continue();
            if (state === 'error') return route.fulfill({ status: 503, json: { error: { code: 'AUDIT_UNAVAILABLE', message: 'Dịch vụ kiểm thử tạm thời không khả dụng.' } } });
            if (state === 'loading' && holdRequests) {
              await new Promise((resolve) => releaseRequests.push(resolve));
              return route.continue().catch(() => {});
            }
            if (state !== 'empty' && !/users|accounts|profile|conversations|invitations/.test(pathname)) return route.continue();
            const response = await route.fetch();
            if (!response.ok() || !response.headers()['content-type']?.includes('json')) return route.fulfill({ response });
            const redact = (value) => {
              if (Array.isArray(value)) return value.map(redact);
              if (!value || typeof value !== 'object') return value;
              return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
                /^(email|phone|address|displayName|customerName|senderName)$/i.test(key) && item ? (key === 'email' ? 'audit@demo.test' : 'Dữ liệu đã ẩn') : redact(item)]));
            };
            const data = redact(await response.json());
            await route.fulfill({ response, json: state === 'empty' ? (Array.isArray(data) ? [] : data && typeof data === 'object' && Array.isArray(data.items) ? { ...data, items: [], unreadCount: 0, nextCursor: null } : data) : data });
            } catch {
              // Playwright fetch failures can include Authorization headers in
              // their call log. Never print that exception or leave it unhandled.
              await route.abort('failed').catch(() => {});
            }
          });
          for (const screen of selectedRoutes) {
            const existingIndex = records.findIndex((record) => record.role === role && record.routePattern === screen.routePattern && record.viewportName === viewport.name && record.status === 'CAPTURED');
            if (existingIndex >= 0 && !process.argv.includes('--recapture')) continue;
            if (existingIndex >= 0) records.splice(existingIndex, 1);
            const resolvedPath = screen.routePattern.replace(/:(\w+)/g, (_, key) => values[key] ?? `__missing_${key}__`);
            const record = { role, ...screen, resolvedPath, state: screen.state ?? state, viewport: `${viewport.width}x${viewport.height}`, viewportName: viewport.name,
              dataMode: state === 'normal' ? 'REAL_API' : 'CONTROLLED_FIXTURE', privacyRedacted: true, status: 'PENDING', capturedAt: new Date().toISOString(), errors: [] };
            records.push(record);
            if (resolvedPath.includes('__missing_')) {
              record.status = 'BLOCKED'; record.blocker = 'No owned test fixture for dynamic route';
              await save(); continue;
            }
            let sessionRole;
            const pageError = (error) => record.errors.push({ type: 'pageerror', message: error.message.slice(0, 250) });
            const consoleError = (message) => {
              if (message.type() !== 'error') return;
              record.errors.push({ type: 'console', expected: state === 'error', message: message.text()
                .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]+/g, '[email]')
                .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
                .replace(/https?:\/\/[^\s?]+\?[^\s]+/g, '[URL query redacted]').slice(0, 250) });
            };
            const responseError = async (response) => {
              const url = new URL(response.url());
              if (!url.pathname.startsWith('/api/')) return;
              if (url.pathname.endsWith('/auth/refresh') && response.ok()) {
                try { sessionRole = (await response.json()).user?.role; } catch { /* recorded by screen assertion */ }
              }
              if (response.status() >= 400 && !(role === 'GUEST' && response.status() === 401 && url.pathname.endsWith('/auth/refresh'))) {
                record.errors.push({ type: 'http', status: response.status(), path: url.pathname, expected: state === 'error' && response.status() === 503 });
              }
            };
            page.on('pageerror', pageError);
            page.on('console', consoleError);
            page.on('response', responseError);
            try {
              holdRequests = state === 'loading';
              const refresh = role === 'GUEST' ? null : page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/auth/refresh'), { timeout: 15000 }).catch(() => null);
              await page.goto(`${baseURL}${resolvedPath}`, { waitUntil: 'domcontentloaded' });
              const refreshResponse = await refresh;
              if (refreshResponse?.ok()) sessionRole = (await refreshResponse.json()).user?.role;
              await page.locator('main, h1, .ant-result-title, .ant-alert, [aria-busy="true"], .page-header, .catalog-toolbar').first().waitFor({ timeout: 20000 });
              const loadingIndicators = page.locator('[aria-busy="true"]:visible,.ant-skeleton:visible,[role="status"]:visible:text-matches("Đang tải")');
              if (state === 'loading') await loadingIndicators.first().waitFor({ timeout: 10000 });
              else await expect(loadingIndicators).toHaveCount(0, { timeout: 20000 });
              if (state === 'error') await page.locator('.ant-alert,.ant-result').first().waitFor({ timeout: 10000 });
              await page.evaluate(() => document.fonts.ready);
              if (state !== 'loading') {
                // Full-page evidence includes images outside the viewport. Ask
                // the browser to load lazy images before verifying readiness.
                await page.evaluate(() => { for (const image of document.images) image.loading = 'eager'; });
                await page.waitForFunction(() => [...document.images].every((image) => image.complete), undefined, { timeout: 10000 });
              }
              if (new URL(page.url()).pathname !== new URL(`${baseURL}${resolvedPath}`).pathname) throw new Error('Unexpected redirect; intended screen was not captured');
              if (role !== 'GUEST' && sessionRole !== role) throw new Error('Session role was not verified on intended screen');
              if (screen.component === 'ForbiddenPage' && !await page.getByText('Không có quyền truy cập', { exact: true }).isVisible()) throw new Error('Expected 403 was not rendered');
              // Remove sensitive values from rendered evidence only. API responses
              // and credentials are never persisted by the capture runner.
              await page.evaluate(() => {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                while (walker.nextNode()) {
                  const text = walker.currentNode;
                  if (text.parentElement?.closest('script,style')) continue;
                  text.textContent = text.textContent.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]+/g, 'audit@demo.test');
                }
                document.querySelectorAll('input[type="email"],input[type="tel"],input[type="password"],input[autocomplete="tel"],textarea[autocomplete="street-address"]').forEach((input) => { input.value = ''; });
              });
              await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
              record.layout = await page.evaluate(() => ({
                width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
                heading: document.querySelector('h1')?.textContent ?? document.querySelector('.ant-result-title')?.textContent,
                links: [...document.querySelectorAll('nav a')].map((link) => ({ label: link.textContent, href: link.getAttribute('href') })),
              }));
              if (process.env.AUDIT_AXE_SCRIPT) {
                await page.addScriptTag({ path: process.env.AUDIT_AXE_SCRIPT });
                record.accessibility = await page.evaluate(async () => {
                  const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
                  return { engine: result.testEngine, violations: result.violations.map((violation) => ({
                    id: violation.id, impact: violation.impact, description: violation.description,
                    helpUrl: violation.helpUrl, nodes: violation.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
                  })), incomplete: result.incomplete.map((item) => ({ id: item.id, nodes: item.nodes.length })) };
                });
              }
              const slug = screen.routePattern.replaceAll(/[^\w-]/g, '_') || 'home';
              const filename = path.join(output, phase, role, slug, viewport.name, `${record.state}.png`);
              await mkdir(path.dirname(filename), { recursive: true });
              await page.screenshot({ path: filename, fullPage: true, mask: [page.locator('code,pre,[data-sensitive],input[name="phone"],input[name="address"],input[autocomplete="tel"],textarea[autocomplete="street-address"]')] });
              record.screenshot = path.relative(workspace, filename).replaceAll('\\', '/');
              record.status = 'CAPTURED';
            } catch (error) {
              record.status = 'BLOCKED'; record.blocker = error.message.split('\n')[0].slice(0, 250);
            } finally {
              holdRequests = false;
              releaseRequests.forEach((release) => release()); releaseRequests = [];
              page.off('pageerror', pageError); page.off('response', responseError);
              page.off('console', consoleError);
              await save();
            }
          }
          await page.close();
          console.log(JSON.stringify({ role, viewport: viewport.name, captured: records.filter((record) => record.status === 'CAPTURED').length, blocked: records.filter((record) => record.status === 'BLOCKED').length }));
        }
      } catch (error) {
        records.push({ role, status: 'BLOCKED', blocker: error.message.split('\n')[0] }); await save();
      } finally { await context.close(); }
    }
  } finally { await save(); await browser.close(); }
  console.log(JSON.stringify({ output, captured: records.filter((record) => record.status === 'CAPTURED').length, blocked: records.filter((record) => record.status === 'BLOCKED').length }));
}

if (process.argv.includes('--audit')) {
  await runAudit();
} else {

const root = path.resolve(import.meta.dirname, '../../../../docs/emukey/evidence');
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
}
