import { BadRequestException, ConflictException } from '@nestjs/common';
import { CatalogAdminService } from '../../src/modules/catalog/application/catalog-admin.service.js';
import type { CatalogAdminRepository, PlanRecord, ProductRecord } from '../../src/modules/catalog/infrastructure/catalog-admin.repository.js';
import type { AuthPrincipal } from '../../src/modules/identity-access/identity.types.js';
import { vi } from 'vitest';

const actor: AuthPrincipal = { sub: '00000000-0000-4000-8000-000000000002', role: 'PROVIDER_ADMIN', sessionVersion: 1 };
const product: ProductRecord = { code: 'EMUKEY', createdAt: new Date(), description: null, imageUrl: null, id: '00000000-0000-4000-8000-000000000200', name: 'Emukey', providerUserId: actor.sub, publishedAt: null, status: 'DRAFT', updatedAt: new Date() };
const plan: PlanRecord = { billingCycle: 'MONTHLY', code: 'MONTHLY', createdAt: new Date(), durationMonths: 1, entitlements: { desktop: true }, id: '00000000-0000-4000-8000-000000000300', maxActiveDevices: 2, name: 'Monthly', planCommitment: `0x${'01'.repeat(32)}`, priceVnd: 120000, productId: product.id, providerUserId: actor.sub, publishedAt: null, status: 'DRAFT', updatedAt: new Date(), version: 1 };

function repository() {
  return {
    archivePlan: vi.fn(), archiveProduct: vi.fn(),
    createPlan: vi.fn().mockResolvedValue(plan), createProduct: vi.fn().mockResolvedValue(product),
    findPlan: vi.fn().mockResolvedValue(plan), findProduct: vi.fn().mockResolvedValue(product),
    listPlans: vi.fn().mockResolvedValue([plan]), listProducts: vi.fn().mockResolvedValue([product]),
    transitionPlan: vi.fn().mockResolvedValue({ ...plan, status: 'PUBLISHED' }),
    transitionProduct: vi.fn().mockResolvedValue({ ...product, status: 'PUBLISHED' }),
    updatePlan: vi.fn().mockResolvedValue(plan), updateProduct: vi.fn().mockResolvedValue(product),
  } as unknown as CatalogAdminRepository;
}

describe('CatalogAdminService', () => {
  it('rejects non-canonical monthly duration and non-positive price', async () => {
    const service = new CatalogAdminService(repository());
    await expect(service.createPlan(actor, { productId: product.id, code: 'M', name: 'Monthly', billingCycle: 'MONTHLY', durationMonths: 12, priceVnd: 1, maxActiveDevices: 1 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createPlan(actor, { productId: product.id, code: 'M', name: 'Monthly', billingCycle: 'MONTHLY', durationMonths: 1, priceVnd: 0, maxActiveDevices: 1 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts nested canonical JSON and rejects unsupported values', async () => {
    const repo = repository();
    const service = new CatalogAdminService(repo);
    await expect(service.createPlan(actor, { productId: product.id, code: 'M', name: 'Monthly', billingCycle: 'MONTHLY', durationMonths: 1, priceVnd: 1, maxActiveDevices: 1, entitlements: { desktop: Number.NaN } })).rejects.toBeInstanceOf(BadRequestException);
    await service.createPlan(actor, { productId: product.id, code: 'M', name: 'Monthly', billingCycle: 'MONTHLY', durationMonths: 1, priceVnd: 1, maxActiveDevices: 1, entitlements: { desktop: { nested: true } } });
    expect((repo.createPlan as unknown as { mock: { calls: unknown[][] } }).mock.calls).toHaveLength(1);
  });

  it('passes publish failures as conflicts', async () => {
    const repo = repository();
    repo.transitionProduct = vi.fn().mockRejectedValue(new Error('PRODUCT_NOT_DRAFT'));
    const service = new CatalogAdminService(repo);
    await expect(service.publishProduct(actor, product.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps invalid catalog state transitions to conflicts', async () => {
    const repo = repository();
    repo.transitionProduct = vi.fn().mockRejectedValue(new Error('PRODUCT_NOT_PUBLISHED'));
    const service = new CatalogAdminService(repo);
    await expect(service.archiveProduct(actor, product.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects blank names on update', async () => {
    const service = new CatalogAdminService(repository());
    await expect(service.updateProduct(actor, product.id, { name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updatePlan(actor, plan.id, { name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an allowlisted product DTO', async () => {
    const service = new CatalogAdminService(repository());
    const result = await service.listProducts(actor);
    expect(result[0]).toMatchObject({ id: product.id, code: product.code });
    expect(result[0]).not.toHaveProperty('passwordHash');
    expect(result[0]).not.toHaveProperty('privateKey');
  });
});
