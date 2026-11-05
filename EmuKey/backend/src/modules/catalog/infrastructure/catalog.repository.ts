import { Pool } from 'pg';

export class CatalogRepository {
  constructor(private readonly pool: Pool) {}

  async listPublished() {
    const result = await this.pool.query<Record<string, unknown>>(`SELECT p.id, p.provider_user_id, COALESCE(u.organization_name, u.display_name) AS provider_display_name, p.code, p.name, p.description, p.image_url, p.published_at, pl.id AS plan_id, pl.code AS plan_code, pl.name AS plan_name, CASE WHEN pl.duration_months=12 THEN 'YEARLY' ELSE 'MONTHLY' END AS billing_cycle, pl.duration_months, pl.price_vnd, pl.max_active_devices, pl.entitlements FROM products p JOIN users u ON u.id=p.provider_user_id LEFT JOIN plans pl ON pl.product_id = p.id AND pl.status = 'PUBLISHED' WHERE p.status = 'PUBLISHED' ORDER BY p.name, pl.price_vnd`);
    return result.rows;
  }

  async findPublished(slug: string) {
    const result = await this.pool.query<Record<string, unknown>>(`SELECT p.id, p.provider_user_id, COALESCE(u.organization_name, u.display_name) AS provider_display_name, p.code, p.name, p.description, p.image_url, p.published_at, pl.id AS plan_id, pl.code AS plan_code, pl.name AS plan_name, CASE WHEN pl.duration_months=12 THEN 'YEARLY' ELSE 'MONTHLY' END AS billing_cycle, pl.duration_months, pl.price_vnd, pl.max_active_devices, pl.entitlements FROM products p JOIN users u ON u.id=p.provider_user_id LEFT JOIN plans pl ON pl.product_id = p.id AND pl.status = 'PUBLISHED' WHERE p.status = 'PUBLISHED' AND p.code = $1 ORDER BY pl.price_vnd`, [slug]);
    return result.rows;
  }

  async findPublishedById(id: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT p.id, p.provider_user_id, COALESCE(u.organization_name,u.display_name) AS provider_display_name,
              p.code, p.name, p.description, p.image_url, p.published_at,
              pl.id AS plan_id, pl.code AS plan_code, pl.name AS plan_name,
              CASE WHEN pl.duration_months=12 THEN 'YEARLY' ELSE 'MONTHLY' END AS billing_cycle,
              pl.duration_months, pl.price_vnd, pl.max_active_devices, pl.entitlements
       FROM products p JOIN users u ON u.id=p.provider_user_id
       LEFT JOIN plans pl ON pl.product_id=p.id AND pl.status='PUBLISHED'
       WHERE p.status='PUBLISHED' AND p.id=$1 ORDER BY pl.price_vnd`, [id],
    );
    return result.rows;
  }

  async findPublishedPlans(ids: string[]) {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT pl.id, pl.product_id, pl.name, pl.version, CASE WHEN pl.duration_months=12 THEN 'YEARLY' ELSE 'MONTHLY' END AS billing_cycle,
              pl.duration_months, pl.price_vnd, pl.max_active_devices,
              pl.entitlements, p.name AS product_name
       FROM plans pl
       JOIN products p ON p.id = pl.product_id
       WHERE pl.id = ANY($1::uuid[])
         AND pl.status = 'PUBLISHED'
         AND p.status = 'PUBLISHED'`,
      [ids],
    );
    return result.rows;
  }
}
