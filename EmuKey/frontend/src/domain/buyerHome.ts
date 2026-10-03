import type { LicenseDeviceDto, LicenseProjectionDto, OrderDto } from '../infrastructure/api/generated';

export interface BuyerHomeMetrics {
  readonly recentOrders: number;
  readonly activeDevices: number;
  readonly licensesExpiringWithin30Days: number;
}

export function selectBuyerHomeMetrics(
  orders: readonly Pick<OrderDto, 'id'>[],
  licenses: readonly Pick<LicenseProjectionDto, 'expiresAt'>[],
  devices: readonly Pick<LicenseDeviceDto, 'status'>[],
  now: Date,
): BuyerHomeMetrics {
  const start = now.getTime();
  const end = start + 30 * 24 * 60 * 60 * 1000;
  return {
    recentOrders: orders.length,
    activeDevices: devices.filter((device) => device.status === 'ACTIVE').length,
    licensesExpiringWithin30Days: licenses.filter((license) => {
      const expiresAt = new Date(license.expiresAt).getTime();
      return expiresAt >= start && expiresAt <= end;
    }).length,
  };
}
