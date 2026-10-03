import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { CreatePlanDto, CreateProductDto, UpdatePlanDto, UpdateProductDto } from '../presentation/catalog.dto.js';
import { CatalogAdminRepository, type PlanInput, type ProductInput } from '../infrastructure/catalog-admin.repository.js';
import { canonicalizeEntitlements } from '../../../platform/crypto/license-crypto.js';

function publicProduct(value: Awaited<ReturnType<CatalogAdminRepository['findProduct']>>) {
  if (!value) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' });
  return {
    code: value.code,
    createdAt: value.createdAt,
    description: value.description,
    imageUrl: value.imageUrl,
    id: value.id,
    name: value.name,
    publishedAt: value.publishedAt,
    status: value.status,
    updatedAt: value.updatedAt,
  };
}

function publicPlan(value: Awaited<ReturnType<CatalogAdminRepository['findPlan']>>) {
  if (!value) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Plan not found.' });
  return {
    billingCycle: value.billingCycle,
    code: value.code,
    createdAt: value.createdAt,
    durationMonths: value.durationMonths,
    entitlements: value.entitlements,
    id: value.id,
    maxActiveDevices: value.maxActiveDevices,
    name: value.name,
    planCommitment: value.planCommitment,
    priceVnd: value.priceVnd,
    productId: value.productId,
    publishedAt: value.publishedAt,
    status: value.status,
    updatedAt: value.updatedAt,
    version: value.version,
  };
}

function validateEntitlements(entitlements: Record<string, unknown> | undefined): Record<string, unknown> {
  const value = entitlements ?? {};
  for (const key of Object.keys(value)) {
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      throw new BadRequestException({ code: 'INVALID_ENTITLEMENTS', message: 'Entitlement keys must be canonical identifiers.' });
    }
  }
  try {
    canonicalizeEntitlements(value);
  } catch {
    throw new BadRequestException({ code: 'INVALID_ENTITLEMENTS', message: 'Entitlements must be valid canonical JSON.' });
  }
  return value;
}

function validatePlanValues(input: { billingCycle: string; durationMonths: number; maxActiveDevices: number; priceVnd: number }): void {
  const expectedDuration = input.billingCycle === 'MONTHLY' ? 1 : input.billingCycle === 'YEARLY' ? 12 : 0;
  if (!expectedDuration || input.durationMonths !== expectedDuration) {
    throw new BadRequestException({ code: 'INVALID_PLAN_DURATION', message: 'MONTHLY plans require 1 month and YEARLY plans require 12 months.' });
  }
  if (![input.priceVnd, input.maxActiveDevices].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new BadRequestException({ code: 'INVALID_PLAN_VALUES', message: 'Price and limits must be positive integers.' });
  }
}

@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly repository: CatalogAdminRepository,
  ) {}

  async listProducts(actor: AuthPrincipal) { return (await this.repository.listProducts(actor)).map((product) => publicProduct(product)); }
  async findProduct(actor: AuthPrincipal, id: string) { return publicProduct(await this.repository.findProduct(actor, id)); }
  async listPlans(actor: AuthPrincipal, productId?: string) { return (await this.repository.listPlans(actor, productId)).map((plan) => publicPlan(plan)); }
  async findPlan(actor: AuthPrincipal, id: string) { return publicPlan(await this.repository.findPlan(actor, id)); }

  async createProduct(actor: AuthPrincipal, dto: CreateProductDto) {
    const input: Required<ProductInput> = {
      code: dto.code.trim(),
      description: dto.description?.trim() ?? null,
      imageUrl: dto.imageUrl?.trim() ?? null,
      name: dto.name.trim(),
    };
    if (!input.code || !input.name) throw new BadRequestException({ code: 'INVALID_PRODUCT', message: 'Product code and name are required.' });
    try { return publicProduct(await this.repository.createProduct(actor, input)); } catch (error) { this.translateUnique(error, 'PRODUCT_CODE_CONFLICT'); throw error; }
  }

  async updateProduct(actor: AuthPrincipal, id: string, dto: UpdateProductDto) {
    const input: ProductInput = {};
    if (dto.name !== undefined) {
      input.name = dto.name.trim();
      if (!input.name) throw new BadRequestException({ code: 'INVALID_PRODUCT', message: 'Product name is required.' });
    }
    if (dto.description !== undefined) input.description = dto.description.trim();
    if (dto.imageUrl !== undefined) input.imageUrl = dto.imageUrl.trim();
    try { return publicProduct(await this.repository.updateProduct(actor, id, input)); } catch (error) { this.translate(error, 'PRODUCT_NOT_FOUND'); throw error; }
  }

  async publishProduct(actor: AuthPrincipal, id: string) { try { return publicProduct(await this.repository.transitionProduct(actor, id, 'PUBLISHED')); } catch (error) { this.translate(error, 'PRODUCT_NOT_FOUND'); throw error; } }
  async archiveProduct(actor: AuthPrincipal, id: string) { try { return publicProduct(await this.repository.transitionProduct(actor, id, 'ARCHIVED')); } catch (error) { this.translate(error, 'PRODUCT_NOT_FOUND'); throw error; } }
  async deleteProduct(actor: AuthPrincipal, id: string) { try { await this.repository.deleteProduct(actor, id); return { deleted: true }; } catch (error) { this.translate(error, 'PRODUCT_NOT_FOUND'); throw error; } }

  async createPlan(actor: AuthPrincipal, dto: CreatePlanDto) {
    validatePlanValues(dto);
    const input: Required<PlanInput> = { billingCycle: dto.billingCycle, code: dto.code.trim(), durationMonths: dto.durationMonths, entitlements: validateEntitlements(dto.entitlements), maxActiveDevices: dto.maxActiveDevices, name: dto.name.trim(), priceVnd: dto.priceVnd, productId: dto.productId };
    if (!input.code || !input.name) throw new BadRequestException({ code: 'INVALID_PLAN', message: 'Plan code and name are required.' });
    try { return publicPlan(await this.repository.createPlan(actor, input)); } catch (error) { this.translateUnique(error, 'PLAN_CODE_CONFLICT'); this.translate(error, 'PRODUCT_NOT_FOUND'); throw error; }
  }

  async updatePlan(actor: AuthPrincipal, id: string, dto: UpdatePlanDto) {
    const current = await this.repository.findPlan(actor, id);
    if (!current) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Plan not found.' });
    validatePlanValues({ billingCycle: dto.billingCycle ?? current.billingCycle, durationMonths: dto.durationMonths ?? current.durationMonths, maxActiveDevices: dto.maxActiveDevices ?? current.maxActiveDevices, priceVnd: dto.priceVnd ?? current.priceVnd });
    const input: PlanInput = {};
    if (dto.billingCycle !== undefined) input.billingCycle = dto.billingCycle;
    if (dto.durationMonths !== undefined) input.durationMonths = dto.durationMonths;
    if (dto.entitlements !== undefined) input.entitlements = validateEntitlements(dto.entitlements);
    if (dto.maxActiveDevices !== undefined) input.maxActiveDevices = dto.maxActiveDevices;
    if (dto.name !== undefined) {
      input.name = dto.name.trim();
      if (!input.name) throw new BadRequestException({ code: 'INVALID_PLAN', message: 'Plan name is required.' });
    }
    if (dto.priceVnd !== undefined) input.priceVnd = dto.priceVnd;
    try { return publicPlan(await this.repository.updatePlan(actor, id, input)); } catch (error) { this.translate(error, 'PLAN_NOT_FOUND'); throw error; }
  }

  async publishPlan(actor: AuthPrincipal, id: string) { try { return publicPlan(await this.repository.transitionPlan(actor, id, 'PUBLISHED')); } catch (error) { this.translate(error, 'PLAN_NOT_FOUND'); throw error; } }
  async archivePlan(actor: AuthPrincipal, id: string) { try { return publicPlan(await this.repository.transitionPlan(actor, id, 'ARCHIVED')); } catch (error) { this.translate(error, 'PLAN_NOT_FOUND'); throw error; } }
  async deletePlan(actor: AuthPrincipal, id: string) { try { await this.repository.deletePlan(actor, id); return { deleted: true }; } catch (error) { this.translate(error, 'PLAN_NOT_FOUND'); throw error; } }

  private translateUnique(error: unknown, code: string): void { if ((error as { code?: string }).code === '23505') throw new ConflictException({ code, message: 'A resource with the same code already exists.' }); }
  private translate(error: unknown, notFoundCode: string): void {
    const code = error instanceof Error ? error.message : (error as { code?: string }).code;
    if (code === notFoundCode || code === 'PRODUCT_NOT_FOUND' || code === 'PLAN_NOT_FOUND') throw new NotFoundException({ code: code === 'PRODUCT_NOT_FOUND' || code === 'PLAN_NOT_FOUND' ? code : notFoundCode, message: 'Catalog resource not found.' });
    if (code === 'PRODUCT_ARCHIVED' || code === 'PLAN_ARCHIVED' || code === 'PRODUCT_NOT_DRAFT' || code === 'PLAN_NOT_DRAFT' || code === 'PRODUCT_HAS_DEPENDENCIES' || code === 'PLAN_HAS_DEPENDENCIES' || code === 'PRODUCT_ALREADY_PUBLISHED' || code === 'PLAN_ALREADY_PUBLISHED' || code === 'PRODUCT_NOT_PUBLISHED' || code === 'PLAN_NOT_PUBLISHED') throw new ConflictException({ code, message: 'The requested catalog state transition is not allowed.' });
  }
}
