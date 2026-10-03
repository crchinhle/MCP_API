import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { createOrLoadDeviceIdentity } from '../../../../EmuKey/mobile/src/infrastructure/device-identity';

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  randomUUID: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

const getItem = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const setItem = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const getRandomBytes = Crypto.getRandomBytesAsync as jest.MockedFunction<typeof Crypto.getRandomBytesAsync>;
const randomUUID = Crypto.randomUUID as jest.MockedFunction<typeof Crypto.randomUUID>;

describe('mobile device identity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores a random per-device reference together with the private key in SecureStore', async () => {
    getItem.mockImplementation((key) => {
      if (!/^[\w.-]+$/.test(key)) throw new Error('Invalid SecureStore key');
      return Promise.resolve(null);
    });
    getRandomBytes.mockResolvedValue(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
    randomUUID.mockReturnValue('11111111-2222-4333-8444-555555555555');

    const identity = await createOrLoadDeviceIdentity('license-1');

    expect(identity.deviceRef).toBe('mobile-11111111-2222-4333-8444-555555555555');
    expect(identity.deviceRef).not.toBe('mobile-license-1');
    expect(setItem).toHaveBeenCalledWith(
      'emukey_device_key_v1_license-1',
      expect.stringContaining('"deviceRef":"mobile-11111111-2222-4333-8444-555555555555"'),
      { keychainAccessible: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
    );
  });
});
