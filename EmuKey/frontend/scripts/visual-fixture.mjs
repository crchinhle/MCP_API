import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve('D:\\TLHT\\KLTN\\UY\\EmuKey\\frontend');
const artifactRoot = path.join(root, 'visual-regression', 'artifacts');
const fixtureRoot = path.join(root, 'visual-regression', 'fixtures');
const routeMapPath = path.join(root, 'visual-regression', 'route-map.json');

await mkdir(fixtureRoot, { recursive: true });

const routeMapJSON = JSON.parse(await readFile(routeMapPath, 'utf8'));
const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';

const fixtures = [
  // Buyer home fixture data
  {
    name: 'buyer-home',
    route: '/buyer',
    viewport: 'desktop',
    data: {
      licenses: [
        { id: '1', productName: 'SecureDesk Pro', status: 'ACTIVE', maxActiveDevices: 25, activationKeyAvailable: true, expiresAt: '2027-12-31T00:00:00.000Z' },
        { id: '2', productName: 'CloudStudio AI', status: 'ACTIVE', maxActiveDevices: 10, activationKeyAvailable: false, expiresAt: '2027-02-01T00:00:00.000Z' },
        { id: '3', productName: 'DataGuard SDK', status: 'ACTIVE', maxActiveDevices: 5, activationKeyAvailable: false, expiresAt: '2026-10-01T00:00:00.000Z' },
      ],
      orders: [
        { id: 'ORD-001', orderNumber: 'ORD-001', planNameSnapshot: 'Gói Basic', priceVndSnapshot: 5000000, orderStatus: 'PAYMENT_ACCEPTED', productNameSnapshot: 'SecureDesk Pro' },
        { id: 'ORD-002', orderNumber: 'ORD-002', planNameSnapshot: 'Gói Pro', priceVndSnapshot: 8000000, orderStatus: 'WAITING_PAYMENT', productNameSnapshot: 'CloudStudio AI' },
      ],
      devicesByLicense: {
        '1': [
          { id: 'device-a', deviceRef: 'DESKTOP-AN-01', status: 'ACTIVE', bindingGeneration: 1 },
          { id: 'device-b', deviceRef: 'LAPTOP-MKT-04', status: 'ACTIVE', bindingGeneration: 1 },
          { id: 'device-c', deviceRef: 'DESKTOP-DEV-02', status: 'ACTIVE', bindingGeneration: 1 },
        ],
      },
    },
  },
  {
    name: 'buyer-home-mobile',
    route: '/buyer',
    viewport: 'mobile',
    data: {
      licenses: [
        { id: '1', productName: 'SecureDesk Pro', status: 'ACTIVE', maxActiveDevices: 25, activationKeyAvailable: true },
        { id: '2', productName: 'CloudStudio AI', status: 'PENDING', maxActiveDevices: 10, activationKeyAvailable: false },
      ],
      orders: [
        { id: 'ORD-001', orderNumber: 'ORD-001', planNameSnapshot: 'Gói Basic', priceVndSnapshot: 5000000, orderStatus: 'PAYMENT_ACCEPTED', productNameSnapshot: 'SecureDesk Pro' },
        { id: 'ORD-002', orderNumber: 'ORD-002', planNameSnapshot: 'Gói Pro', priceVndSnapshot: 8000000, orderStatus: 'WAITING_PAYMENT', productNameSnapshot: 'CloudStudio AI' },
      ],
    },
  },
  // Buyer orders fixture
  {
    name: 'buyer-orders',
    route: '/buyer/orders',
    viewport: 'desktop',
    data: {
      orders: [
        { id: 'order-0218', orderNumber: 'ORD-2026-0218', planId: 'securedesk-25', planNameSnapshot: '25 thiết bị', maxActiveDevicesSnapshot: 25, priceVndSnapshot: 2450000, productNameSnapshot: 'SecureDesk Pro', orderStatus: 'WAITING_PAYMENT' },
        { id: 'order-0207', orderNumber: 'ORD-2026-0207', planId: 'cloudstudio-10', planNameSnapshot: '10 thiết bị', maxActiveDevicesSnapshot: 10, priceVndSnapshot: 1890000, productNameSnapshot: 'CloudStudio AI', orderStatus: 'PAYMENT_ACCEPTED' },
        { id: 'order-0199', orderNumber: 'ORD-2026-0199', planId: 'dataguard-5', planNameSnapshot: '5 thiết bị', maxActiveDevicesSnapshot: 5, priceVndSnapshot: 990000, productNameSnapshot: 'DataGuard SDK', orderStatus: 'PAYMENT_ACCEPTED' },
        { id: 'order-0184', orderNumber: 'ORD-2026-0184', planId: 'securedesk-15', planNameSnapshot: '15 thiết bị', maxActiveDevicesSnapshot: 15, priceVndSnapshot: 1470000, productNameSnapshot: 'SecureDesk Pro', orderStatus: 'PAYMENT_ACCEPTED' },
      ],
    },
  },
  {
    name: 'buyer-orders-mobile',
    route: '/buyer/orders',
    viewport: 'mobile',
      data: {
        orders: [
          { id: 'order-0218', orderNumber: 'ORD-2026-0218', planId: 'securedesk-25', planNameSnapshot: '25 thiết bị', maxActiveDevicesSnapshot: 25, priceVndSnapshot: 2450000, productNameSnapshot: 'SecureDesk Pro', orderStatus: 'WAITING_PAYMENT' },
          { id: 'order-0207', orderNumber: 'ORD-2026-0207', planId: 'cloudstudio-10', planNameSnapshot: '10 thiết bị', maxActiveDevicesSnapshot: 10, priceVndSnapshot: 1890000, productNameSnapshot: 'CloudStudio AI', orderStatus: 'PAYMENT_ACCEPTED' },
          { id: 'order-0199', orderNumber: 'ORD-2026-0199', planId: 'dataguard-5', planNameSnapshot: '5 thiết bị', maxActiveDevicesSnapshot: 5, priceVndSnapshot: 990000, productNameSnapshot: 'DataGuard SDK', orderStatus: 'PAYMENT_ACCEPTED' },
          { id: 'order-0184', orderNumber: 'ORD-2026-0184', planId: 'securedesk-15', planNameSnapshot: '15 thiết bị', maxActiveDevicesSnapshot: 15, priceVndSnapshot: 1470000, productNameSnapshot: 'SecureDesk Pro', orderStatus: 'PAYMENT_ACCEPTED' },
      ],
    },
  },
  // Buyer licenses fixture
  {
    name: 'buyer-licenses',
    route: '/buyer/licenses',
    viewport: 'desktop',
    data: {
      licenses: [
        { id: '1', productName: 'SecureDesk Pro', plan: { name: 'Business', version: 1 }, maxActiveDevices: 25, status: 'ACTIVE', expiresAt: '2027-08-21', activationKeyAvailable: true, publicLicenseId: 'LIC-8F3A-2026' },
        { id: '2', productName: 'CloudStudio AI', plan: { name: 'Gói Pro', version: 1 }, maxActiveDevices: 10, status: 'PENDING', expiresAt: '2026-06-01', activationKeyAvailable: false, publicLicenseId: 'EMU-LIC-002' },
        { id: '3', productName: 'DataGuard SDK', plan: { name: 'Gói Starter', version: 1 }, maxActiveDevices: 5, status: 'ACTIVE', expiresAt: '2027-11-15', activationKeyAvailable: false, publicLicenseId: 'EMU-LIC-003' },
      ],
      devicesByLicense: {
        '1': [
          ...Array.from({ length: 14 }, (_, index) => ({ id: `device-${index + 1}`, deviceRef: index === 0 ? 'DESKTOP-AN-01' : index === 1 ? 'LAPTOP-MKT-04' : `DEVICE-${String(index + 1).padStart(2, '0')}`, status: 'ACTIVE', finality: 'CONFIRMED' })),
        ],
      },
    },
  },
  {
    name: 'buyer-licenses-mobile',
    route: '/buyer/licenses',
    viewport: 'mobile',
    data: {
      licenses: [
        { id: '1', productName: 'SecureDesk Pro', plan: { name: 'Business', version: 1 }, maxActiveDevices: 25, status: 'ACTIVE', expiresAt: '2027-08-21', activationKeyAvailable: true, publicLicenseId: 'LIC-8F3A-2026' },
        { id: '2', productName: 'CloudStudio AI', plan: { name: 'Gói Pro', version: 1 }, maxActiveDevices: 10, status: 'PENDING', expiresAt: '2026-06-01', activationKeyAvailable: false, publicLicenseId: 'EMU-LIC-002' },
        { id: '3', productName: 'DataGuard SDK', plan: { name: 'Gói Starter', version: 1 }, maxActiveDevices: 5, status: 'ACTIVE', expiresAt: '2027-11-15', activationKeyAvailable: false, publicLicenseId: 'EMU-LIC-003' },
      ],
      devicesByLicense: {
        '1': [
          ...Array.from({ length: 14 }, (_, index) => ({ id: `device-${index + 1}`, deviceRef: index === 0 ? 'DESKTOP-AN-01' : index === 1 ? 'LAPTOP-MKT-04' : `DEVICE-${String(index + 1).padStart(2, '0')}`, status: 'ACTIVE', finality: 'CONFIRMED' })),
        ],
      },
    },
  },
];

for (const fixture of fixtures) {
  const screen = routeMapJSON.screens.find((s) => s.route === fixture.route);
  if (screen) console.log(`Prepared fixture: ${fixture.name} for ${fixture.route} ${fixture.viewport}`);
}

await writeFile(path.join(fixtureRoot, 'fixtures.json'), JSON.stringify({ fixtures, generatedAt: new Date().toISOString() }, null, 2));

const browser = await chromium.launch();
const records = [];
for (const fixture of fixtures) {
  const viewport = fixture.viewport === 'desktop' ? { width: 1440, height: 1024 } : { width: 390, height: 844 };
  const context = await browser.newContext({
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    viewport,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-09-23T00:00:00.000Z') });
  await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
  const interceptionLog = [];
  const intercept = async (route, fixtureName, payload) => {
    const entry = { at: new Date().toISOString(), url: route.request().url(), fixture: fixtureName, status: 200, response: payload };
    interceptionLog.push(entry);
    console.log(`[visual-fixture] ${JSON.stringify(entry)}`);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) });
  };
  await page.route('**/api/v1/auth/refresh', async (route) => intercept(route, fixture.name, {
      accessToken: 'visual-test-token',
      user: { id: 'visual-user', email: 'minhan@example.test', displayName: 'Minh An', role: 'CUSTOMER', status: 'ACTIVE' },
  }));
  await page.route('**/api/v1/licenses', async (route) => intercept(route, fixture.name, fixture.data.licenses ?? []));
  await page.route('**/api/v1/orders', async (route) => intercept(route, fixture.name, fixture.data.orders ?? []));
  await page.route('**/api/v1/notifications', async (route) => intercept(route, fixture.name, []));
  await page.route('**/api/v1/licenses/*/devices', async (route) => {
    const licenseId = new globalThis.URL(route.request().url()).pathname.split('/').at(-2);
    await intercept(route, fixture.name, fixture.data.devicesByLicense?.[licenseId] ?? []);
  });
  const output = fixture.name === 'buyer-home' ? path.join(artifactRoot, 'buyer-home-fixture.png') : path.join(artifactRoot, `${fixture.name}__fixture.png`);
  try {
    await page.goto(`${baseURL}${fixture.route}`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => globalThis.document.fonts?.ready);
    await page.screenshot({ path: output, fullPage: false });
    const selectorLog = { recentOrders: fixture.data.orders?.length ?? 0, activeDevices: Object.values(fixture.data.devicesByLicense ?? {}).flat().filter((device) => device.status === 'ACTIVE').length, licensesExpiringWithin30Days: 1, fixedDate: '2026-09-23T00:00:00.000Z' };
    console.log(`[visual-fixture] selectors ${JSON.stringify(selectorLog)}`);
    records.push({ ...fixture, output, status: interceptionLog.length > 0 ? 'CAPTURED_WITH_INTERCEPT' : 'FAILED_NO_INTERCEPTION', interceptionLog, selectorLog });
  } catch (error) {
    records.push({ ...fixture, output, status: 'FAILED', error: error instanceof Error ? error.message : String(error) });
  }
  await context.close();
}
await browser.close();
await writeFile(path.join(fixtureRoot, 'capture-manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2));
console.log(JSON.stringify({ fixtureRoot, records: records.length }, null, 2));
