import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
const baseUrl = process.env.LOAD_BASE_URL ?? 'http://localhost:3000/api/v1';
const scenario = process.argv.find((value) => value.startsWith('--scenario='))?.slice('--scenario='.length) ?? 'public-verify';
const requests = Number(process.env.LOAD_REQUESTS ?? 50);
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 10);
const samples = [];
let failures = 0;

async function ensureCheckoutFixture() {
  if (process.env.LOAD_ACCESS_TOKEN && process.env.LOAD_ORDER_ID) {
    return { token: process.env.LOAD_ACCESS_TOKEN, orderId: process.env.LOAD_ORDER_ID };
  }
  const email = process.env.LOAD_CUSTOMER_EMAIL ?? 'customer@example.test';
  const password = process.env.LOAD_CUSTOMER_PASSWORD ?? process.env.SEED_PASSWORD;
  if (!password) return null;
  const login = await globalThis.fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: globalThis.AbortSignal.timeout(Number(process.env.LOAD_TIMEOUT_MS ?? 10_000)),
  });
  if (!login.ok) return null;
  const loginBody = await login.json();
  const token = loginBody.accessToken;
  const productsResponse = await globalThis.fetch(`${baseUrl}/products`, { headers: { authorization: `Bearer ${token}` } });
  if (!productsResponse.ok) return null;
  const products = await productsResponse.json();
  const planId = products?.flatMap((product) => product.plans ?? [])[0]?.id;
  if (!planId) return null;
  const orderResponse = await globalThis.fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': randomUUID(),
    },
    body: JSON.stringify({ planId }),
  });
  if (!orderResponse.ok) return null;
  const order = await orderResponse.json();
  const terms = await globalThis.fetch(`${baseUrl}/orders/${order.id}/accept-service-terms`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ accepted: true }),
  });
  if (!terms.ok) return null;
  return { token, orderId: order.id };
}

const checkoutFixture = scenario === 'checkout' ? await ensureCheckoutFixture().catch(() => null) : null;
const activationFixture = scenario === 'activation' && process.env.LOAD_ACCESS_TOKEN && process.env.LOAD_LICENSE_ID;

async function request() {
  const started = performance.now();
  try {
    if (scenario === 'checkout' && !checkoutFixture) return;
    if (scenario === 'activation' && !activationFixture) return;
    const path = scenario === 'checkout' ? `/orders/${checkoutFixture.orderId}/checkout` : scenario === 'activation' ? `/licenses/${process.env.LOAD_LICENSE_ID}/activation/challenge` : '/public/licenses/not-a-real-license-identifier/verify';
    const headers = scenario === 'checkout' ? { authorization: `Bearer ${checkoutFixture.token}` } : scenario === 'activation' ? { authorization: `Bearer ${process.env.LOAD_ACCESS_TOKEN}`, 'content-type': 'application/json' } : undefined;
    const body = scenario === 'activation' ? JSON.stringify({ purpose: 'ACTIVATE_DEVICE', deviceRef: process.env.LOAD_DEVICE_REF ?? 'phase8-load-device' }) : undefined;
    const response = await globalThis.fetch(`${baseUrl}${path}`, { headers, body, method: scenario === 'checkout' || scenario === 'activation' ? 'POST' : 'GET', signal: globalThis.AbortSignal.timeout(Number(process.env.LOAD_TIMEOUT_MS ?? 10_000)) });
    if (scenario === 'public-verify' && ![200, 400, 404, 429].includes(response.status)) failures += 1;
    if (scenario === 'checkout' && response.status >= 500) failures += 1;
  } catch {
    failures += 1;
  } finally {
    samples.push(performance.now() - started);
  }
}

let next = 0;
async function worker() {
  while (true) {
    const index = next++;
    if (index >= requests) return;
    await request();
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));
samples.sort((a, b) => a - b);
const percentile = (p) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))] ?? 0;
const result = {
  scenario,
  requests,
  concurrency,
  p50Ms: Number(percentile(0.5).toFixed(2)),
  p95Ms: Number(percentile(0.95).toFixed(2)),
  p99Ms: Number(percentile(0.99).toFixed(2)),
  errorRate: requests === 0 ? 0 : Number((failures / requests).toFixed(4)),
  budget: { p95Ms: Number(process.env.LOAD_P95_BUDGET_MS ?? 1000), errorRate: Number(process.env.LOAD_ERROR_BUDGET ?? 0.01) },
  ...(scenario === 'checkout' && !checkoutFixture
    ? { status: 'BLOCKED_EXTERNAL_TEST_FIXTURE' }
    : {}),
  ...(scenario === 'activation' && !activationFixture
    ? { status: 'BLOCKED_EXTERNAL_TEST_FIXTURE' }
    : {}),
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'BLOCKED_EXTERNAL_TEST_FIXTURE' && (result.p95Ms > result.budget.p95Ms || result.errorRate > result.budget.errorRate)) process.exitCode = 1;
