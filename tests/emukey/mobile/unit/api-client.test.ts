import * as SecureStore from 'expo-secure-store';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { acceptServiceTerms, createOrder, storeActivationKey, loadActivationKey, retrieveActivationKey, registerPushToken, restoreSession, logout, login, listOrders, updateProfile, type MobileOrderDetail } from '../../../../EmuKey/mobile/src/infrastructure/api/client';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '11111111-2222-4333-8444-555555555555') }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device' }));

const values = new Map<string, string>();
function validKey(key: string) {
  if (!/^[\w.-]+$/.test(key)) throw new Error('Invalid SecureStore key');
}
beforeEach(() => {
  values.clear();
  jest.clearAllMocks();
  jest.mocked(SecureStore.getItemAsync).mockImplementation((key) => { validKey(key); return Promise.resolve(values.get(key) ?? null); });
  jest.mocked(SecureStore.setItemAsync).mockImplementation((key, value) => { validKey(key); values.set(key, value); return Promise.resolve(); });
  jest.mocked(SecureStore.deleteItemAsync).mockImplementation((key) => { validKey(key); values.delete(key); return Promise.resolve(); });
});
afterEach(() => jest.restoreAllMocks());

it('embeds the configured API origin in a production Expo bundle without a Node environment', () => {
  const expoRequire = createRequire(require.resolve('expo/package.json'));
  const babel = expoRequire('@babel/core');
  const generate = createRequire(expoRequire.resolve('@babel/core'))('@babel/generator').default;
  const filename = require.resolve('../../../../EmuKey/mobile/src/infrastructure/api/client');
  const saved = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = 'https://manager-fixture.example.test/api/v1';
  try {
    const result = babel.transformSync(readFileSync(filename, 'utf8'), {
      filename, babelrc: false, configFile: false, ast: true,
      presets: [expoRequire.resolve('babel-preset-expo')],
      caller: { name: 'metro', bundler: 'metro', platform: 'android', isDev: false },
    });
    const declaration = result.ast.program.body.flatMap((node: { declarations?: { id: { name: string }; init: unknown }[] }) => node.declarations ?? [])
      .find((node: { id: { name: string } }) => node.id.name === 'API_URL');
    expect(declaration).toBeDefined();
    expect(runInNewContext(`(${generate(declaration.init).code})`, {})).toBe('https://manager-fixture.example.test/api/v1');
  } finally {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = saved;
  }
});

it('unregisters the current push token before clearing the account session', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => String(input).endsWith('/auth/mobile/login')
    ? Response.json({ accessToken: 'access', refreshToken: 'refresh', user: { id: 'buyer', role: 'CUSTOMER' } })
    : Response.json({}));
  await login('buyer@example.test', 'Password@123');
  await registerPushToken('android-device-token', 'FCM');
  await logout();
  const calls = fetchMock.mock.calls.map(([url]) => String(url));
  expect(calls.findIndex((url) => url.endsWith('/notifications/push-tokens/remove'))).toBeGreaterThanOrEqual(0);
  expect(calls.findIndex((url) => url.endsWith('/notifications/push-tokens/remove'))).toBeLessThan(calls.findIndex((url) => url.endsWith('/auth/mobile/logout')));
});

it('persists a valid intent key through network failure and reuses it on retry', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network lost'));
  await expect(createOrder({ planId: 'plan-1' })).rejects.toThrow('network lost');
  expect(values.size).toBe(1);
  const firstHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
  fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ id: 'order-1' }) } as Response);
  await expect(createOrder({ planId: 'plan-1' })).resolves.toEqual({ id: 'order-1' });
  expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('Idempotency-Key')).toBe(firstHeaders.get('Idempotency-Key'));
  expect(values.size).toBe(0);
});

it('stores and retrieves activation keys with a valid native storage key', async () => {
  await storeActivationKey('license-1', 'activation-secret');
  await expect(loadActivationKey('license-1')).resolves.toBe('activation-secret');
});

it('sends the version and hash of the displayed terms with explicit acceptance', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ id: 'order-1' }) } as Response);
  await acceptServiceTerms({ id: 'order-1' } as MobileOrderDetail, { version: 'v2', hash: 'b'.repeat(64) });
  const body = fetchMock.mock.calls[0]?.[1]?.body;
  expect(JSON.parse(typeof body === 'string' ? body : '{}')).toEqual({ accepted: true, version: 'v2', hash: 'b'.repeat(64) });
});

it('refreshes simultaneous expired native requests once and retries with the rotated access token', async () => {
  let refreshCalls = 0;
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/auth/mobile/login')) return Response.json({ accessToken: 'old', refreshToken: 'refresh-old', user: { id: 'buyer', role: 'CUSTOMER' } });
    if (url.endsWith('/auth/mobile/refresh')) {
      refreshCalls += 1;
      return Response.json({ accessToken: 'rotated', refreshToken: 'refresh-new', user: { id: 'buyer', role: 'CUSTOMER' } });
    }
    if (url.endsWith('/orders')) return new Headers(init?.headers).get('authorization') === 'Bearer rotated' ? Response.json([]) : Response.json({}, { status: 401 });
    throw new Error(`Unexpected request ${url}`);
  });
  await login('buyer@example.test', 'Password@123');
  await expect(Promise.all(Array.from({ length: 10 }, () => listOrders()))).resolves.toEqual(Array.from({ length: 10 }, () => []));
  expect(refreshCalls).toBe(1);
  expect(fetchMock).toHaveBeenCalled();
});

it.each([401, 403])('clears account secrets when the refresh family is definitively rejected with %s', async (status) => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (String(input).endsWith('/auth/mobile/login')) return Response.json({ accessToken: 'old', refreshToken: 'revoked', user: { id: 'buyer', role: 'CUSTOMER' } });
    return Response.json({}, { status: String(input).endsWith('/auth/mobile/refresh') ? status : 401 });
  });
  await login('buyer@example.test', 'Password@123');
  await storeActivationKey('license-1', 'private-key-revocation-sentinel');
  await expect(listOrders()).rejects.toMatchObject({ status: 401 });
  expect([...values.values()].some((value) => value.includes('private-key-revocation-sentinel'))).toBe(false);
  expect(await restoreSession()).toBeNull();
});

it('preserves secure credentials and allows retry after a transient refresh failure', async () => {
  let unavailable = true;
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (String(input).endsWith('/auth/mobile/login')) return Response.json({ accessToken: 'old', refreshToken: 'valid-refresh', user: { id: 'buyer', role: 'CUSTOMER' } });
    if (String(input).endsWith('/auth/mobile/refresh')) return unavailable ? Response.json({}, { status: 503 }) : Response.json({ accessToken: 'new', refreshToken: 'rotated', user: { id: 'buyer', role: 'CUSTOMER' } });
    return new Headers(init?.headers).get('authorization') === 'Bearer new' ? Response.json([]) : Response.json({}, { status: 401 });
  });
  await login('buyer@example.test', 'Password@123');
  await storeActivationKey('license-1', 'private-key-transient-sentinel');
  await expect(listOrders()).rejects.toMatchObject({ status: 503 });
  expect(await restoreSession()).toMatchObject({ refreshToken: 'valid-refresh' });
  expect([...values.values()].some((value) => value.includes('private-key-transient-sentinel'))).toBe(true);
  unavailable = false;
  await expect(listOrders()).resolves.toEqual([]);
});

it('never replays an old account request after a different account logs in', async () => {
  let finishOldRequest!: (response: Response) => void;
  let orderRequests = 0;
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (String(input).endsWith('/auth/mobile/login')) {
      const { email } = JSON.parse(String(init?.body));
      return Response.json({ accessToken: email, refreshToken: 'refresh', user: { id: email.split('@')[0], role: 'CUSTOMER' } });
    }
    if (String(input).endsWith('/orders')) return ++orderRequests === 1 ? new Promise<Response>((resolve) => { finishOldRequest = resolve; }) : Response.json([]);
    return Response.json({});
  });
  await login('first@example.test', 'Password@123');
  const oldRequest = listOrders();
  await login('second@example.test', 'Password@123');
  finishOldRequest(Response.json({}, { status: 401 }));
  await expect(oldRequest).rejects.toMatchObject({ status: 401 });
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/orders'))).toHaveLength(1);
});

it('does not replay a mutation when another request already refreshed the same session', async () => {
  let finishMutation!: (response: Response) => void;
  let mutations = 0;
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/auth/mobile/login')) return Response.json({ accessToken: 'old', refreshToken: 'refresh', user: { id: 'buyer', role: 'CUSTOMER' } });
    if (url.endsWith('/auth/mobile/refresh')) return Response.json({ accessToken: 'new', refreshToken: 'next-refresh', user: { id: 'buyer', role: 'CUSTOMER' } });
    if (url.endsWith('/auth/profile')) return ++mutations === 1 ? new Promise<Response>((resolve) => { finishMutation = resolve; }) : Response.json({ id: 'buyer', role: 'CUSTOMER' });
    return new Headers(init?.headers).get('authorization') === 'Bearer new' ? Response.json([]) : Response.json({}, { status: 401 });
  });
  await login('buyer@example.test', 'Password@123');
  const mutation = updateProfile({ displayName: 'Changed' });
  await listOrders();
  finishMutation(Response.json({}, { status: 401 }));
  await expect(mutation).rejects.toMatchObject({ status: 409 });
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/profile'))).toHaveLength(1);
});

it('retries a lost key ACK from the saved receipt and never presents a previous key version', async () => {
  let ackCalls = 0;
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/auth/mobile/login')) return Response.json({ accessToken: 'access', refreshToken: 'refresh', user: { id: 'buyer', role: 'CUSTOMER' } });
    if (url.endsWith('/retrieve')) return Response.json({ activationKey: 'secret-version-1', keyVersion: 1, deliveryId: JSON.parse(String(init?.body)).deliveryId, retryUntil: '2030-01-01' });
    if (url.endsWith('/ack') && ++ackCalls === 1) throw new Error('ACK response lost');
    return Response.json({ acknowledged: true });
  });
  await login('buyer@example.test', 'Password@123');
  await expect(retrieveActivationKey('license-1', 1)).rejects.toThrow('ACK response lost');
  await expect(loadActivationKey('license-1', 1)).resolves.toBe('secret-version-1');
  expect(ackCalls).toBe(2);
  expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/retrieve'))).toHaveLength(1);
  await expect(loadActivationKey('license-1', 2)).resolves.toBeNull();
  await logout();
  expect([...values.values()].some((value) => value.includes('secret-version-1'))).toBe(false);
});
