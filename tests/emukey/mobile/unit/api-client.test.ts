import * as SecureStore from 'expo-secure-store';
import { acceptServiceTerms, createOrder, storeActivationKey, loadActivationKey, type MobileOrderDetail } from '../../../../EmuKey/mobile/src/infrastructure/api/client';

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
