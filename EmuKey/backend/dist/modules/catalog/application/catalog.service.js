var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { NotFoundException, Injectable } from '@nestjs/common';
import { CatalogRepository } from '../infrastructure/catalog.repository.js';
let CatalogService = class CatalogService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    map(rows) {
        const first = rows[0];
        if (!first)
            throw new NotFoundException('Product not found');
        return { slug: String(first.code), name: String(first.name), summary: typeof first.description === 'string' ? first.description : '', imageUrl: typeof first.image_url === 'string' ? first.image_url : null, publishedAt: first.published_at, plans: rows.filter((r) => r.plan_id).map((r) => ({ id: String(r.plan_id), code: String(r.plan_code), name: String(r.plan_name), billingCycle: r.billing_cycle, durationMonths: Number(r.duration_months), priceVnd: Number(r.price_vnd), maxActiveDevices: Number(r.max_active_devices), entitlements: r.entitlements })) };
    }
    async list() { const rows = await this.repository.listPublished(); const grouped = new Map(); for (const row of rows) {
        const key = String(row.id);
        grouped.set(key, [...(grouped.get(key) ?? []), row]);
    } return [...grouped.values()].map((group) => this.map(group)); }
    async find(slug) { const rows = await this.repository.findPublished(slug); return this.map(rows); }
};
CatalogService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [CatalogRepository])
], CatalogService);
export { CatalogService };
//# sourceMappingURL=catalog.service.js.map