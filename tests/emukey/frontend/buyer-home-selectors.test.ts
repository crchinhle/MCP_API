import { describe, expect, it } from 'vitest';

import { selectBuyerHomeMetrics, selectExpiringLicenses, isLicenseActive } from '../../../EmuKey/frontend/src/domain/buyerHome';

describe('Buyer Home metrics', () => {
  const now = new Date('2026-09-23T00:00:00.000Z');
  const orders = [{ id: 'order-1' }, { id: 'order-2' }] as never[];
  const licenses = [
    { activeDeviceCount: 2, expiresAt: '2026-10-01T00:00:00.000Z', status: 'ACTIVE' },
    { activeDeviceCount: 1, expiresAt: '2027-01-01T00:00:00.000Z', status: 'ACTIVE' },
  ] as never[];

  it('computes active licenses, active devices, and expiry window independently', () => {
    const metrics = selectBuyerHomeMetrics(
      orders,
      licenses,
      now,
    );
    expect(metrics).toEqual({ activeLicenses: 2, activeDevices: 3, licensesExpiringWithin30Days: 1, recentOrders: 2 });
  });

  it('does not count quotas, inactive devices, or expiry outside the fixed window', () => {
    const metrics = selectBuyerHomeMetrics(
      [{ id: 'order-1' }] as never[],
      [{ activeDeviceCount: 1, expiresAt: '2026-10-24T00:00:00.000Z', status: 'ACTIVE' }] as never[],
      now,
    );
    expect(metrics).toEqual({ activeLicenses: 1, activeDevices: 1, licensesExpiringWithin30Days: 0, recentOrders: 1 });
  });

  it('excludes revoked, suspended, expired, or pending licenses from active counts', () => {
    const mixedLicenses = [
      { id: 'lic-1', activeDeviceCount: 2, expiresAt: '2026-10-05T00:00:00.000Z', status: 'ACTIVE' },
      { id: 'lic-2', activeDeviceCount: 4, expiresAt: '2026-09-01T00:00:00.000Z', status: 'ACTIVE' }, // expired date
      { id: 'lic-3', activeDeviceCount: 1, expiresAt: '2026-11-01T00:00:00.000Z', status: 'EXPIRED' },
      { id: 'lic-4', activeDeviceCount: 3, expiresAt: '2026-11-01T00:00:00.000Z', status: 'REVOKED' },
      { id: 'lic-5', activeDeviceCount: 1, expiresAt: '2026-11-01T00:00:00.000Z', status: 'SUSPENDED' },
      { id: 'lic-6', activeDeviceCount: 2, expiresAt: '2026-11-01T00:00:00.000Z', status: 'PENDING_ONCHAIN' },
    ] as never[];

    const metrics = selectBuyerHomeMetrics([], mixedLicenses, now);
    expect(metrics.activeLicenses).toBe(1);
    expect(metrics.activeDevices).toBe(2);
    expect(metrics.licensesExpiringWithin30Days).toBe(1);
  });

  it('handles empty licenses array', () => {
    const metrics = selectBuyerHomeMetrics([], [], now);
    expect(metrics).toEqual({ activeLicenses: 0, activeDevices: 0, licensesExpiringWithin30Days: 0, recentOrders: 0 });
  });

  it('does not report provider-managed device activity as a measured total', () => {
    const metrics = selectBuyerHomeMetrics([], [
      { activeDeviceCount: 0, expiresAt: '2027-01-01', fulfillmentMode: 'PROVIDER_HANDOFF' },
      { activeDeviceCount: 3, expiresAt: '2027-01-01', fulfillmentMode: 'LEGACY_DEVICE' },
    ], now);
    expect(metrics.activeLicenses).toBe(2);
    expect(metrics.activeDevices).toBeNull();
  });

  it('distinguishes an unknown legacy measurement from measured zero', () => {
    expect(selectBuyerHomeMetrics([], [{ expiresAt: '2027-01-01' }] as never[], now).activeDevices).toBeNull();
    expect(selectBuyerHomeMetrics([], [{ expiresAt: '2027-01-01', activeDeviceCount: 0 }], now).activeDevices).toBe(0);
  });

  it('filters and sorts expiring licenses by closest expiration date', () => {
    const licExpiringSoon = { id: 'soon', expiresAt: '2026-09-28T00:00:00.000Z', status: 'ACTIVE' };
    const licExpiringLater = { id: 'later', expiresAt: '2026-10-15T00:00:00.000Z', status: 'ACTIVE' };
    const licFarFuture = { id: 'far', expiresAt: '2027-01-01T00:00:00.000Z', status: 'ACTIVE' };
    const licPast = { id: 'past', expiresAt: '2026-09-10T00:00:00.000Z', status: 'ACTIVE' };

    const expiring = selectExpiringLicenses([licFarFuture, licExpiringLater, licPast, licExpiringSoon] as never[], now);
    expect(expiring.map((l) => l.id)).toEqual(['soon', 'later']);
  });
});
