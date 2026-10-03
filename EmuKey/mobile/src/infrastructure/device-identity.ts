import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'emukey_device_key_v1_';

interface StoredDeviceIdentity {
  deviceRef: string;
  privateKey: string;
}

function messageDigest(message: string): Uint8Array {
  const bytes = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${bytes.length}`);
  const combined = new Uint8Array(prefix.length + bytes.length);
  combined.set(prefix);
  combined.set(bytes, prefix.length);
  return keccak_256(combined);
}

export interface DeviceIdentity {
  deviceRef: string;
  address: `0x${string}`;
  signMessage(message: string): string;
}

export async function createOrLoadDeviceIdentity(licenseId: string): Promise<DeviceIdentity> {
  const storageKey = `${KEY_PREFIX}${licenseId}`;
  const stored = await SecureStore.getItemAsync(storageKey);
  let privateKey: string | null = null;
  let deviceRef: string | null = null;
  let needsPersist = !stored;
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<StoredDeviceIdentity>;
      if (typeof parsed.privateKey === 'string' && typeof parsed.deviceRef === 'string') {
        privateKey = parsed.privateKey;
        deviceRef = parsed.deviceRef;
      } else {
        needsPersist = true;
      }
    } catch {
      // Migrate the original private-key-only SecureStore value in place.
      privateKey = stored;
      needsPersist = true;
    }
  }
  if (!privateKey) {
    const entropy = await Crypto.getRandomBytesAsync(32);
    if (!secp256k1.utils.isValidPrivateKey(entropy)) throw new Error('DEVICE_KEY_GENERATION_FAILED');
    privateKey = bytesToHex(entropy);
  }
  if (!deviceRef) deviceRef = `mobile-${Crypto.randomUUID()}`;
  if (needsPersist) {
    await SecureStore.setItemAsync(storageKey, JSON.stringify({ deviceRef, privateKey }), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  const secret = hexToBytes(privateKey);
  if (!secp256k1.utils.isValidPrivateKey(secret)) throw new Error('DEVICE_KEY_STORAGE_INVALID');
  const publicKey = secp256k1.getPublicKey(secret, false).slice(1);
  const address = `0x${bytesToHex(keccak_256(publicKey).slice(-20))}` as const;
  return {
    deviceRef,
    address,
    signMessage(message: string) {
      const signature = secp256k1.sign(messageDigest(message), secret);
      const recovery = signature.recovery;
      if (recovery === undefined) throw new Error('DEVICE_SIGNATURE_RECOVERY_MISSING');
      return `0x${signature.toCompactHex()}${(27 + recovery).toString(16).padStart(2, '0')}`;
    },
  };
}
