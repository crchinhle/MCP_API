import type { MobileLicense, MobileOrderSummary } from '../../infrastructure/api/client';

export interface BuyerHomeMetrics {
  readonly activeLicenses: number;
  readonly activeDevices: number | null;
  readonly licensesExpiringWithin30Days: number;
  readonly recentOrders: number;
}

type LicenseLike = Pick<MobileLicense, 'expiresAt'> &
  Partial<
    Pick<
      MobileLicense,
      | 'status'
      | 'fulfillmentMode'
      | 'providerDeliveryStatus'
      | 'activationKeyTrustStatus'
      | 'finality'
    >
  >;

export function isLicenseActive(license: LicenseLike, now: Date): boolean {
  const status = license.status ?? 'ACTIVE';
  if (status !== 'ACTIVE') return false;
  const expiresAt = new Date(license.expiresAt).getTime();
  if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) return false;
  if (license.activationKeyTrustStatus === 'UNTRUSTED_REORG') return false;
  if (license.finality === 'PROJECTION_STALE' || license.finality === 'REORGED') return false;
  if (license.fulfillmentMode === 'PROVIDER_HANDOFF' && license.providerDeliveryStatus === 'FAILED') {
    return false;
  }
  return true;
}

export function selectBuyerHomeMetrics(
  orders: readonly Pick<MobileOrderSummary, 'id'>[],
  licenses: readonly (LicenseLike & Pick<MobileLicense, 'activeDeviceCount'>)[],
  now: Date,
): BuyerHomeMetrics {
  const start = now.getTime();
  const end = start + 30 * 24 * 60 * 60 * 1000;

  const activeLicenses = licenses.filter((license) => isLicenseActive(license, now));
  const expiringLicenses = activeLicenses.filter((license) => {
    const expiresAt = new Date(license.expiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt > start && expiresAt <= end;
  });

  return {
    activeLicenses: activeLicenses.length,
    activeDevices: activeLicenses.some(
      (license) =>
        license.fulfillmentMode === 'PROVIDER_HANDOFF' ||
        !Number.isFinite(license.activeDeviceCount) ||
        license.activeDeviceCount < 0,
    )
      ? null
      : activeLicenses.reduce((total, license) => total + license.activeDeviceCount, 0),
    licensesExpiringWithin30Days: expiringLicenses.length,
    recentOrders: orders.length,
  };
}

export function selectExpiringLicenses<T extends LicenseLike>(
  licenses: readonly T[],
  now: Date,
): T[] {
  const start = now.getTime();
  const end = start + 30 * 24 * 60 * 60 * 1000;
  return licenses
    .filter((license) => {
      if (!isLicenseActive(license, now)) return false;
      const expiresAt = new Date(license.expiresAt).getTime();
      return Number.isFinite(expiresAt) && expiresAt > start && expiresAt <= end;
    })
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
}
