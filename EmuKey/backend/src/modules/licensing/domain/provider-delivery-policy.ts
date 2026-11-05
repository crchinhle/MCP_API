export type FulfillmentMode = 'LEGACY_DEVICE' | 'PROVIDER_HANDOFF';

export interface ProviderReceipt {
  deliveryId: string;
  licenseId: string;
  revision: number;
  receiptId: string;
  result: 'ACCEPTED';
}

export interface ProviderLicenseMessage {
  schemaVersion: 1;
  deliveryId: string;
  eventType: string;
  revision: number;
  providerId: string;
  productId: string;
  licenseId: string;
  publicLicenseId: string;
  keyVersion: number;
  licenseKey: string;
  plan: {
    id: string;
    version: number;
    entitlements: Record<string, unknown>;
    maxDevices: number;
  };
  periodStart: string;
  expiresAt: string;
  status: string;
  usable: boolean;
}

export function canReceiveProviderKey(
  license: {
    status: string;
    trust: string;
    expiresAt: Date;
    revision: number;
    acceptedRevision: number | null;
  },
  now = new Date(),
): boolean {
  return (
    license.status === 'ACTIVE' &&
    license.trust === 'TRUSTED' &&
    license.expiresAt > now &&
    license.revision > 0 &&
    license.acceptedRevision === license.revision
  );
}

export function validProviderReceipt(
  value: unknown,
  expected: Pick<ProviderReceipt, 'deliveryId' | 'licenseId' | 'revision'>,
): value is ProviderReceipt {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as Record<string, unknown>;
  return (
    receipt.result === 'ACCEPTED' &&
    receipt.deliveryId === expected.deliveryId &&
    receipt.licenseId === expected.licenseId &&
    receipt.revision === expected.revision &&
    typeof receipt.receiptId === 'string' &&
    receipt.receiptId.length > 0 &&
    receipt.receiptId.length <= 200
  );
}

export function deliveryRetryDelay(
  attempt: number,
  jitter = Math.random(),
): number | null {
  const delay = [
    5_000, 30_000, 120_000, 600_000, 1_800_000, 7_200_000, 21_600_000,
  ][attempt - 1];
  return delay === undefined
    ? null
    : Math.round(delay * (0.8 + Math.max(0, Math.min(1, jitter)) * 0.4));
}
