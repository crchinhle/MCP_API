import type { LicenseProjectionDto, OrderDto } from '../infrastructure/api/generated';

export interface BuyerHomeMetrics {
  readonly activeLicenses: number;
  readonly activeDevices: number;
  readonly licensesExpiringWithin30Days: number;
  readonly recentOrders: number;
}

export function isLicenseActive(
  license: Pick<LicenseProjectionDto, 'expiresAt'> &
    Partial<Pick<LicenseProjectionDto, 'status' | 'fulfillmentMode' | 'providerDeliveryStatus' | 'activationKeyTrustStatus' | 'finality'>>,
  now: Date,
): boolean {
  const status = license.status ?? 'ACTIVE';
  if (status !== 'ACTIVE') return false;
  const expiresAt = new Date(license.expiresAt).getTime();
  if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) return false;
  if (license.activationKeyTrustStatus === 'UNTRUSTED_REORG') return false;
  if (license.finality === 'PROJECTION_STALE' || license.finality === 'REORGED') return false;
  if (license.fulfillmentMode === 'PROVIDER_HANDOFF' && license.providerDeliveryStatus === 'FAILED') return false;
  return true;
}

export function selectBuyerHomeMetrics(
  orders: readonly Pick<OrderDto, 'id'>[],
  licenses: readonly (Pick<LicenseProjectionDto, 'expiresAt' | 'activeDeviceCount'> &
    Partial<Pick<LicenseProjectionDto, 'status' | 'fulfillmentMode' | 'providerDeliveryStatus' | 'activationKeyTrustStatus' | 'finality'>>)[],
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
    activeDevices: activeLicenses.reduce((total, license) => total + (license.activeDeviceCount ?? 0), 0),
    licensesExpiringWithin30Days: expiringLicenses.length,
    recentOrders: orders.length,
  };
}

export function selectExpiringLicenses<
  T extends Pick<LicenseProjectionDto, 'expiresAt'> &
    Partial<Pick<LicenseProjectionDto, 'status' | 'fulfillmentMode' | 'providerDeliveryStatus' | 'activationKeyTrustStatus' | 'finality'>>,
>(licenses: readonly T[], now: Date): T[] {
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
