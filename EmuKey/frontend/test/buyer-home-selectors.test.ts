import { describe, expect, it } from 'vitest';

import { selectBuyerHomeMetrics } from '../src/domain/buyerHome';

describe('Buyer Home metrics', () => {
  const now = new Date('2026-09-23T00:00:00.000Z');
  const orders = [{ id: 'order-1' }, { id: 'order-2' }] as never[];
  const licenses = [
    { expiresAt: '2026-10-01T00:00:00.000Z' },
    { expiresAt: '2027-01-01T00:00:00.000Z' },
  ] as never[];

  it('computes recent orders, active devices, and expiry window independently', () => {
    const metrics = selectBuyerHomeMetrics(
      orders,
      licenses,
      [{ status: 'ACTIVE' }, { status: 'ACTIVE' }, { status: 'ACTIVE' }, { status: 'REVOKED' }, { status: 'PENDING_ONCHAIN' }] as never[],
      now,
    );
    expect(metrics).toEqual({ recentOrders: 2, activeDevices: 3, licensesExpiringWithin30Days: 1 });
  });

  it('does not count quotas, inactive devices, or expiry outside the fixed window', () => {
    const metrics = selectBuyerHomeMetrics(
      [{ id: 'order-1' }] as never[],
      [{ expiresAt: '2026-10-24T00:00:00.000Z' }] as never[],
      [{ status: 'ACTIVE' }, { status: 'REVOKED' }, { status: 'PENDING_ONCHAIN' }] as never[],
      now,
    );
    expect(metrics).toEqual({ recentOrders: 1, activeDevices: 1, licensesExpiringWithin30Days: 0 });
  });
});
