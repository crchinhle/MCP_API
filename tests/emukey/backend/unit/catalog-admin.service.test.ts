import { BadRequestException, ConflictException, ValidationPipe } from '@nestjs/common';
import { CatalogAdminService } from '../../../../EmuKey/backend/src/modules/catalog/application/catalog-admin.service.js';
import type { CatalogAdminRepository, PlanRecord, ProductRecord } from '../../../../EmuKey/backend/src/modules/catalog/infrastructure/catalog-admin.repository.js';
import type { AuthPrincipal } from '../../../../EmuKey/backend/src/modules/identity-access/identity.types.js';
import { vi } from 'vitest';
import { CatalogService } from '../../../../EmuKey/backend/src/modules/catalog/application/catalog.service.js';
import { CreateProductDto, UpdateProductDto } from '../../../../EmuKey/backend/src/modules/catalog/presentation/catalog.dto.js';

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
  afterEach(() => vi.unstubAllEnvs());

  it.each(['javascript:alert(1)', 'data:image/png;base64,abc', 'not-a-url', '', 'https://', 'https:/example.com/a.png', 'https:///example.com/a.png', '//example.com/a.png', '/\\example.com/a.png', 'https://example.com/\na.png', '/images/\u0000a.png'])('rejects unsafe or malformed image URL %s on create and update', async (imageUrl) => {
    const service = new CatalogAdminService(repository());
    await expect(service.createProduct(actor, { code: 'IMAGE', name: 'Image', imageUrl }))
      .rejects.toMatchObject({ response: { code: 'INVALID_PRODUCT_IMAGE_URL' } });
    await expect(service.updateProduct(actor, product.id, { imageUrl }))
      .rejects.toMatchObject({ response: { code: 'INVALID_PRODUCT_IMAGE_URL' } });
  });

  it.each([null, '/images/product.png', 'https://cdn.example.com/product.png'])('accepts image URL %s through DTO validation and persistence', async (imageUrl) => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    const repo = repository();
    repo.createProduct = async (_actor, input) => ({ ...product, imageUrl: input.imageUrl ?? null });
    repo.updateProduct = async (_actor, _id, input) => ({ ...product, imageUrl: input.imageUrl ?? null });
    const service = new CatalogAdminService(repo);
    const create = await pipe.transform({ code: 'IMAGE', name: 'Image', imageUrl }, { type: 'body', metatype: CreateProductDto });
    const update = await pipe.transform({ imageUrl }, { type: 'body', metatype: UpdateProductDto });
    await expect(service.createProduct(actor, create)).resolves.toMatchObject({ imageUrl });
    await expect(service.updateProduct(actor, product.id, update)).resolves.toMatchObject({ imageUrl });
  });

  it.each(['development', 'test', 'production'])('allows HTTP images only in local environments (%s)', async (environment) => {
    vi.stubEnv('NODE_ENV', environment);
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    const dto = await pipe.transform({ code: 'IMAGE', name: 'Image', imageUrl: 'http://localhost:3000/a.png' }, { type: 'body', metatype: CreateProductDto });
    const service = new CatalogAdminService(repository());
    if (environment === 'production') {
      await expect(service.createProduct(actor, dto)).rejects.toMatchObject({ response: { code: 'INVALID_PRODUCT_IMAGE_URL' } });
    } else {
      await expect(service.createProduct(actor, dto)).resolves.toMatchObject({ id: product.id });
    }
  });

  it('rejects an unsafe stored image in both public catalog reads', async () => {
    const row = { id: product.id, code: product.code, name: product.name, image_url: 'javascript:alert(1)' };
    const service = new CatalogService({ listPublished: async () => [row], findPublished: async () => [row] } as never);
    await expect(service.list()).rejects.toMatchObject({ response: { code: 'INVALID_PRODUCT_IMAGE_URL' } });
    await expect(service.find(product.code)).rejects.toMatchObject({ response: { code: 'INVALID_PRODUCT_IMAGE_URL' } });
  });

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
