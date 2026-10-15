import { BadRequestException, NotFoundException, Injectable } from '@nestjs/common';
import { CatalogRepository } from '../infrastructure/catalog.repository.js';

export function validateImageUrl(imageUrl: string | null): void {
  if (imageUrl === null) return;
  const invalid = () => new BadRequestException({
    code: 'INVALID_PRODUCT_IMAGE_URL',
    message: 'Product images must use an internal path or a valid HTTPS URL (HTTP is allowed locally).',
  });
  if (!imageUrl || /[\s\\]/.test(imageUrl)) throw invalid();
  for (const character of imageUrl) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) throw invalid();
  }
  // A network-path reference (//host) is not an internal path.
  if (imageUrl.startsWith('/') && !imageUrl.startsWith('//')) return;
  if (!/^https?:\/\/[^/]/i.test(imageUrl)) throw invalid();
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    throw invalid();
  }
  const local = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  if (!url.hostname || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw invalid();
}

@Injectable()
export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}
  private map(rows: Record<string, unknown>[]) {
    const first = rows[0];
    if (!first) throw new NotFoundException('Product not found');
    const imageUrl = typeof first.image_url === 'string' ? first.image_url : null;
    validateImageUrl(imageUrl);
    return { slug: String(first.code), name: String(first.name), summary: typeof first.description === 'string' ? first.description : '', imageUrl, publishedAt: first.published_at, plans: rows.filter((r) => r.plan_id).map((r) => ({ id: String(r.plan_id), code: String(r.plan_code), name: String(r.plan_name), billingCycle: r.billing_cycle, durationMonths: Number(r.duration_months), priceVnd: Number(r.price_vnd), maxActiveDevices: Number(r.max_active_devices), entitlements: r.entitlements })) };
  }
  async list() { const rows: Record<string, unknown>[] = await this.repository.listPublished(); const grouped = new Map<string, Record<string, unknown>[]>(); for (const row of rows) { const key = String(row.id); grouped.set(key, [...(grouped.get(key) ?? []), row]); } return [...grouped.values()].map((group) => this.map(group)); }
  async find(slug: string) { const rows: Record<string, unknown>[] = await this.repository.findPublished(slug); return this.map(rows); }
}
