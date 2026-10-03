import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { CatalogRepository } from '../infrastructure/catalog.repository.js';

@Injectable()
export class ComparePlansQuery {
  constructor(private readonly repository: CatalogRepository) {}

  async execute(rawIds: string | string[]) {
    const ids = [...new Set((Array.isArray(rawIds) ? rawIds : rawIds.split(',')).map((id) => id.trim()).filter(Boolean))];
    if (ids.length < 2 || ids.length > 4 || ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
      throw new BadRequestException({
        code: 'INVALID_PLAN_COMPARISON',
        message: 'Compare between two and four unique plan UUIDs.',
      });
    }
    const plans = await this.repository.findPublishedPlans(ids);
    if (plans.length !== ids.length) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'One or more published plans were not found.',
      });
    }
    const byId = new Map(plans.map((plan) => [String(plan.id), plan]));
    const ordered = ids.map((id) => byId.get(id)!);
    return {
      dimensions: [
        { key: 'priceVnd', label: 'Price (VND)', values: Object.fromEntries(ordered.map((plan) => [String(plan.id), Number(plan.price_vnd)])) },
        { key: 'durationMonths', label: 'Duration (months)', values: Object.fromEntries(ordered.map((plan) => [String(plan.id), Number(plan.duration_months)])) },
        { key: 'maxActiveDevices', label: 'Maximum active devices', values: Object.fromEntries(ordered.map((plan) => [String(plan.id), Number(plan.max_active_devices)])) },
        { key: 'entitlements', label: 'Entitlements', values: Object.fromEntries(ordered.map((plan) => [String(plan.id), plan.entitlements])) },
      ],
      plans: ordered.map((plan) => ({
        billingCycle: plan.billing_cycle,
        id: String(plan.id),
        name: String(plan.name),
        productId: String(plan.product_id),
        productName: String(plan.product_name),
        version: Number(plan.version),
      })),
    };
  }
}
