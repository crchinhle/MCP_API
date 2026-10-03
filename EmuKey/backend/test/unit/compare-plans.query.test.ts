import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ComparePlansQuery } from '../../src/modules/catalog/application/compare-plans.query.js';
import type { CatalogRepository } from '../../src/modules/catalog/infrastructure/catalog.repository.js';

const firstId = '00000000-0000-4000-8000-000000000301';
const secondId = '00000000-0000-4000-8000-000000000302';

describe('ComparePlansQuery', () => {
  it('returns structured, caller-ordered comparison dimensions', async () => {
    const repository = {
      findPublishedPlans: vi.fn(() =>
        Promise.resolve([
          { id: secondId, product_id: 'p1', product_name: 'Product', name: 'Yearly', version: 1, billing_cycle: 'YEARLY', duration_months: 12, price_vnd: 1200, max_active_devices: 3, entitlements: { desktop: true } },
          { id: firstId, product_id: 'p1', product_name: 'Product', name: 'Monthly', version: 1, billing_cycle: 'MONTHLY', duration_months: 1, price_vnd: 120, max_active_devices: 2, entitlements: { desktop: true } },
        ])),
    } as unknown as CatalogRepository;

    const result = await new ComparePlansQuery(repository).execute(
      `${firstId},${secondId}`,
    );

    expect(result.plans.map(({ id }) => id)).toEqual([firstId, secondId]);
    expect(result.dimensions.map(({ key }) => key)).toEqual([
      'priceVnd',
      'durationMonths',
      'maxActiveDevices',
      'entitlements',
    ]);
  });

  it('rejects invalid cardinality and missing published plans', async () => {
    const repository = {
      findPublishedPlans: vi.fn(() => Promise.resolve([])),
    } as unknown as CatalogRepository;
    const query = new ComparePlansQuery(repository);

    await expect(query.execute(firstId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(query.execute([firstId, secondId])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
