import type { Pool } from 'pg';

import { CommerceRepository } from '../../src/modules/commerce-payment/infrastructure/commerce.repository.js';

function poolReturning(rows: Record<string, unknown>[]) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
    connect: vi.fn(),
  };
}

describe('payment receipt timestamps (PAY-20)', () => {
  it('reports the effective paid time from the provider policy and exposes raw evidence separately', async () => {
    const row = {
      amount_minor: 199000,
      currency: 'VND',
      order_id: 'order-1',
      order_number: 'ORD-1',
      order_type: 'NEW_PURCHASE',
      paid_at: new Date('2026-09-28T09:30:34.000Z'),
      plan_name_snapshot: 'Plan',
      product_name_snapshot: 'Product',
      provider_name_snapshot: 'Provider',
      provider_occurred_at: new Date('2026-09-28T09:30:34.000Z'),
      provider_transaction_ref: 'BANK-1',
      received_at: new Date('2026-09-28T10:00:00.000Z'),
      timing_basis: 'PROVIDER',
      transaction_id: 'tx-1',
    };
    const pool = poolReturning([row]);
    const repository = new CommerceRepository(pool as unknown as Pool);

    const receipt = await repository.getPaymentReceipt({ role: 'CUSTOMER', sub: 'customer-1' } as never, 'tx-1');

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('payment_effective_time(pt) AS paid_at'), ['tx-1', 'customer-1']);
    expect(receipt).toMatchObject({
      paidAt: new Date('2026-09-28T09:30:34.000Z'),
      providerOccurredAt: new Date('2026-09-28T09:30:34.000Z'),
      receivedAt: new Date('2026-09-28T10:00:00.000Z'),
      timingBasis: 'PROVIDER',
    });
  });

  it('keeps sandbox-receipt policy distinct from provider occurrence time', async () => {
    const row = {
      amount_minor: 199000,
      currency: 'VND',
      order_id: 'order-2',
      order_number: 'ORD-2',
      order_type: 'NEW_PURCHASE',
      paid_at: new Date('2026-09-28T10:00:00.000Z'),
      plan_name_snapshot: 'Plan',
      product_name_snapshot: 'Product',
      provider_name_snapshot: 'Provider',
      provider_occurred_at: new Date('2026-09-28T09:30:34.000Z'),
      provider_transaction_ref: 'BANK-2',
      received_at: new Date('2026-09-28T10:00:00.000Z'),
      timing_basis: 'SANDBOX_RECEIPT',
      transaction_id: 'tx-2',
    };
    const repository = new CommerceRepository(poolReturning([row]) as unknown as Pool);

    const receipt = await repository.getPaymentReceipt({ role: 'CUSTOMER', sub: 'customer-2' } as never, 'tx-2');

    expect(receipt).toMatchObject({
      paidAt: new Date('2026-09-28T10:00:00.000Z'),
      providerOccurredAt: new Date('2026-09-28T09:30:34.000Z'),
      receivedAt: new Date('2026-09-28T10:00:00.000Z'),
      timingBasis: 'SANDBOX_RECEIPT',
    });
    expect(receipt?.paidAt).not.toEqual(receipt?.providerOccurredAt);
  });

  it('returns null when the transaction is not fulfilled or not visible to the actor', async () => {
    const repository = new CommerceRepository(poolReturning([]) as unknown as Pool);

    await expect(repository.getPaymentReceipt({ role: 'CUSTOMER', sub: 'customer-3' } as never, 'missing')).resolves.toBeNull();
  });
});