import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';
import type { Hex } from 'viem';

import { AuditWriter } from '../../../platform/audit/audit-writer.js';
import { planCommitment } from '../../../platform/crypto/license-crypto.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { BillingCycle } from '../presentation/catalog.dto.js';

export interface ProductRecord {
  code: string;
  createdAt: Date;
  description: string | null;
  imageUrl: string | null;
  id: string;
  name: string;
  providerUserId: string;
  publishedAt: Date | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  updatedAt: Date;
}

export interface PlanRecord {
  billingCycle: BillingCycle;
  code: string;
  createdAt: Date;
  durationMonths: number;
  entitlements: Record<string, unknown>;
  id: string;
  maxActiveDevices: number;
  name: string;
  planCommitment: Hex;
  priceVnd: number;
  productId: string;
  providerUserId: string;
  publishedAt: Date | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  updatedAt: Date;
  version: number;
}

export interface ProductInput {
  code?: string;
  description?: string | null;
  imageUrl?: string | null;
  name?: string;
}

export interface PlanInput {
  billingCycle?: BillingCycle;
  code?: string;
  durationMonths?: number;
  entitlements?: Record<string, unknown>;
  maxActiveDevices?: number;
  name?: string;
  priceVnd?: number;
  productId?: string;
}

function dateOrNull(value: unknown): Date | null {
  return value instanceof Date
    ? value
    : typeof value === 'string'
      ? new Date(value)
      : null;
}

function bufferHex(value: unknown): Hex {
  if (!Buffer.isBuffer(value) || value.length !== 32) {
    throw new Error('INVALID_DATABASE_HASH');
  }
  return `0x${value.toString('hex')}`;
}

function mapProduct(row: Record<string, unknown>): ProductRecord {
  return {
    code: String(row.code),
    createdAt: new Date(String(row.created_at)),
    description: typeof row.description === 'string' ? row.description : null,
    imageUrl: typeof row.image_url === 'string' ? row.image_url : null,
    id: String(row.id),
    name: String(row.name),
    providerUserId: String(row.provider_user_id),
    publishedAt: dateOrNull(row.published_at),
    status: row.status as ProductRecord['status'],
    updatedAt: new Date(String(row.updated_at)),
  };
}

function mapPlan(row: Record<string, unknown>): PlanRecord {
  return {
    billingCycle: row.billing_cycle as BillingCycle,
    code: String(row.code),
    createdAt: new Date(String(row.created_at)),
    durationMonths: Number(row.duration_months),
    entitlements: (row.entitlements ?? {}) as Record<string, unknown>,
    id: String(row.id),
    maxActiveDevices: Number(row.max_active_devices),
    name: String(row.name),
    planCommitment: bufferHex(row.plan_commitment),
    priceVnd: Number(row.price_vnd),
    productId: String(row.product_id),
    providerUserId: String(row.provider_user_id),
    publishedAt: dateOrNull(row.published_at),
    status: row.status as PlanRecord['status'],
    updatedAt: new Date(String(row.updated_at)),
    version: Number(row.version),
  };
}

export class CatalogAdminRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit = new AuditWriter(),
  ) {}

  async listProducts(actor: AuthPrincipal): Promise<ProductRecord[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM products
       WHERE provider_user_id = $1
       ORDER BY created_at DESC`,
      [actor.sub],
    );
    return result.rows.map(mapProduct);
  }

  async findProduct(
    actor: AuthPrincipal,
    id: string,
  ): Promise<ProductRecord | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM products WHERE id = $1 AND provider_user_id = $2',
      [id, actor.sub],
    );
    return result.rows[0] ? mapProduct(result.rows[0]) : null;
  }

  async createProduct(
    actor: AuthPrincipal,
    input: Required<ProductInput>,
  ): Promise<ProductRecord> {
    return this.withTransaction(async (client) => {
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO products (provider_user_id, code, name, description, image_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [actor.sub, input.code, input.name, input.description, input.imageUrl],
      );
      const row = result.rows[0];
      if (!row) throw new Error('PRODUCT_CREATE_FAILED');
      const product = mapProduct(row);
      await this.writeAudit(client, actor, 'PRODUCT_CREATED', 'PRODUCT', product.id, {
        code: product.code,
      });
      return product;
    });
  }

  async updateProduct(
    actor: AuthPrincipal,
    id: string,
    input: ProductInput,
  ): Promise<ProductRecord> {
    return this.withTransaction(async (client) => {
      const current = await this.lockProduct(client, actor, id);
      if (current.status !== 'DRAFT') throw new Error('PRODUCT_NOT_DRAFT');
      const result = await client.query<Record<string, unknown>>(
        `UPDATE products
         SET name = $1, description = $2, image_url = $3, updated_at = now()
         WHERE id = $4 AND provider_user_id = $5
         RETURNING *`,
        [
          input.name ?? current.name,
          input.description === undefined ? current.description : input.description,
          input.imageUrl === undefined ? current.imageUrl : input.imageUrl,
          id,
          actor.sub,
        ],
      );
      const product = mapProduct(result.rows[0] ?? {});
      await this.writeAudit(client, actor, 'PRODUCT_UPDATED', 'PRODUCT', id, {});
      return product;
    });
  }

  async transitionProduct(
    actor: AuthPrincipal,
    id: string,
    status: 'PUBLISHED' | 'ARCHIVED',
  ): Promise<ProductRecord> {
    return this.withTransaction(async (client) => {
      const current = await this.lockProduct(client, actor, id);
      if (status === 'PUBLISHED' && current.status !== 'DRAFT') {
        throw new Error('PRODUCT_NOT_DRAFT');
      }
      if (status === 'ARCHIVED' && current.status !== 'PUBLISHED') {
        throw new Error('PRODUCT_NOT_PUBLISHED');
      }
      const result = await client.query<Record<string, unknown>>(
        `UPDATE products
         SET status = $1,
             published_at = CASE WHEN $1::varchar = 'PUBLISHED' THEN now() ELSE published_at END,
             updated_at = now()
         WHERE id = $2 AND provider_user_id = $3
         RETURNING *`,
        [status, id, actor.sub],
      );
      const product = mapProduct(result.rows[0] ?? {});
      await this.writeAudit(client, actor, `PRODUCT_${status}`, 'PRODUCT', id, {
        previousStatus: current.status,
      });
      return product;
    });
  }

  async deleteProduct(actor: AuthPrincipal, id: string): Promise<void> {
    return this.withTransaction(async (client) => {
      const current = await this.lockProduct(client, actor, id);
      if (current.status !== 'DRAFT') throw new Error('PRODUCT_NOT_DRAFT');
      try {
        await client.query(
          'DELETE FROM products WHERE id = $1 AND provider_user_id = $2',
          [id, actor.sub],
        );
      } catch (error) {
        if ((error as { code?: string }).code === '23503') {
          throw new Error('PRODUCT_HAS_DEPENDENCIES', { cause: error });
        }
        throw error;
      }
      await this.writeAudit(client, actor, 'PRODUCT_DELETED', 'PRODUCT', id, {});
    });
  }

  async listPlans(
    actor: AuthPrincipal,
    productId?: string,
  ): Promise<PlanRecord[]> {
    const values: string[] = [actor.sub];
    const productFilter = productId ? ' AND product_id = $2' : '';
    if (productId) values.push(productId);
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM plans
       WHERE provider_user_id = $1${productFilter}
       ORDER BY created_at DESC`,
      values,
    );
    return result.rows.map(mapPlan);
  }

  async findPlan(actor: AuthPrincipal, id: string): Promise<PlanRecord | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM plans WHERE id = $1 AND provider_user_id = $2',
      [id, actor.sub],
    );
    return result.rows[0] ? mapPlan(result.rows[0]) : null;
  }

  async createPlan(
    actor: AuthPrincipal,
    input: Required<PlanInput>,
  ): Promise<PlanRecord> {
    return this.withTransaction(async (client) => {
      const productResult = await client.query<Record<string, unknown>>(
        `SELECT p.id, p.status, u.provider_chain_address
         FROM products p
         JOIN users u ON u.id = p.provider_user_id
         WHERE p.id = $1 AND p.provider_user_id = $2
         FOR UPDATE OF p`,
        [input.productId, actor.sub],
      );
      const product = productResult.rows[0];
      if (!product) throw new Error('PRODUCT_NOT_FOUND');
      if (product.status === 'ARCHIVED') throw new Error('PRODUCT_ARCHIVED');

      const versionResult = await client.query<{ version: number }>(
        `SELECT COALESCE(MAX(version), 0)::int + 1 AS version
         FROM plans WHERE product_id = $1 AND code = $2`,
        [input.productId, input.code],
      );
      const version = versionResult.rows[0]?.version ?? 1;
      const id = randomUUID();
      const commitment = planCommitment({
        durationMonths: input.durationMonths,
        entitlements: input.entitlements,
        maxActiveDevices: input.maxActiveDevices,
        planId: id,
        planVersion: version,
        productId: input.productId,
        providerChainAddress: String(product.provider_chain_address) as `0x${string}`,
      });
      const result = await client.query<Record<string, unknown>>(
        `INSERT INTO plans
          (id, product_id, provider_user_id, code, version, name, billing_cycle,
            duration_months, price_vnd, max_active_devices, entitlements,
            plan_commitment)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                  decode($12, 'hex'))
         RETURNING *`,
        [
          id,
          input.productId,
          actor.sub,
          input.code,
          version,
          input.name,
          input.billingCycle,
          input.durationMonths,
          input.priceVnd,
          input.maxActiveDevices,
          JSON.stringify(input.entitlements),
           commitment.slice(2),
        ],
      );
      const plan = mapPlan(result.rows[0] ?? {});
      await this.writeAudit(client, actor, 'PLAN_CREATED', 'PLAN', plan.id, {
        productId: plan.productId,
        version,
      });
      return plan;
    });
  }

  async updatePlan(
    actor: AuthPrincipal,
    id: string,
    input: PlanInput,
  ): Promise<PlanRecord> {
    return this.withTransaction(async (client) => {
      const current = await this.lockPlan(client, actor, id);
      if (current.status !== 'DRAFT') throw new Error('PLAN_NOT_DRAFT');
      const providerResult = await client.query<{ provider_chain_address: string }>(
        `SELECT provider_chain_address
         FROM users
         WHERE id = $1 AND role = 'PROVIDER_ADMIN'`,
        [actor.sub],
      );
      const providerChainAddress = providerResult.rows[0]?.provider_chain_address;
      if (!providerChainAddress) throw new Error('PROVIDER_CHAIN_IDENTITY_MISSING');
      const nextDurationMonths = input.durationMonths ?? current.durationMonths;
      const nextEntitlements = input.entitlements ?? current.entitlements;
      const nextMaxActiveDevices =
        input.maxActiveDevices ?? current.maxActiveDevices;
      const commitment = planCommitment({
        durationMonths: nextDurationMonths,
        entitlements: nextEntitlements,
        maxActiveDevices: nextMaxActiveDevices,
        planId: current.id,
        planVersion: current.version,
        productId: current.productId,
         providerChainAddress: providerChainAddress as `0x${string}`,
      });
      const result = await client.query<Record<string, unknown>>(
        `UPDATE plans
         SET name = $1, billing_cycle = $2, duration_months = $3,
             price_vnd = $4, max_active_devices = $5, entitlements = $6,
             plan_commitment = decode($7, 'hex'),
             updated_at = now()
         WHERE id = $8 AND provider_user_id = $9
         RETURNING *`,
        [
          input.name ?? current.name,
          input.billingCycle ?? current.billingCycle,
          nextDurationMonths,
          input.priceVnd ?? current.priceVnd,
          nextMaxActiveDevices,
          JSON.stringify(nextEntitlements),
          commitment.slice(2),
          id,
          actor.sub,
        ],
      );
      const plan = mapPlan(result.rows[0] ?? {});
      await this.writeAudit(client, actor, 'PLAN_UPDATED', 'PLAN', id, {});
      return plan;
    });
  }

  async deletePlan(actor: AuthPrincipal, id: string): Promise<void> {
    return this.withTransaction(async (client) => {
      const current = await this.lockPlan(client, actor, id);
      if (current.status !== 'DRAFT') throw new Error('PLAN_NOT_DRAFT');
      try {
        await client.query(
          'DELETE FROM plans WHERE id = $1 AND provider_user_id = $2',
          [id, actor.sub],
        );
      } catch (error) {
        if ((error as { code?: string }).code === '23503') {
          throw new Error('PLAN_HAS_DEPENDENCIES', { cause: error });
        }
        throw error;
      }
      await this.writeAudit(client, actor, 'PLAN_DELETED', 'PLAN', id, {});
    });
  }

  async transitionPlan(
    actor: AuthPrincipal,
    id: string,
    status: 'PUBLISHED' | 'ARCHIVED',
  ): Promise<PlanRecord> {
    return this.withTransaction(async (client) => {
      const currentResult = await client.query<Record<string, unknown>>(
        `SELECT pl.*, p.status AS product_status
         FROM plans pl
         JOIN products p
           ON p.id = pl.product_id AND p.provider_user_id = pl.provider_user_id
         WHERE pl.id = $1 AND pl.provider_user_id = $2
         FOR UPDATE OF pl`,
        [id, actor.sub],
      );
      const row = currentResult.rows[0];
      if (!row) throw new Error('PLAN_NOT_FOUND');
      const current = mapPlan(row);
      if (status === 'PUBLISHED' && current.status !== 'DRAFT') {
        throw new Error('PLAN_NOT_DRAFT');
      }
      if (status === 'ARCHIVED' && current.status !== 'PUBLISHED') {
        throw new Error('PLAN_NOT_PUBLISHED');
      }
      if (status === 'PUBLISHED' && row.product_status !== 'PUBLISHED') {
        throw new Error('PRODUCT_NOT_PUBLISHED');
      }
      const result = await client.query<Record<string, unknown>>(
        `UPDATE plans
         SET status = $1,
             published_at = CASE WHEN $1::varchar = 'PUBLISHED' THEN now() ELSE published_at END,
             updated_at = now()
         WHERE id = $2 AND provider_user_id = $3
         RETURNING *`,
        [status, id, actor.sub],
      );
      const plan = mapPlan(result.rows[0] ?? {});
      await this.writeAudit(client, actor, `PLAN_${status}`, 'PLAN', id, {
        previousStatus: current.status,
      });
      return plan;
    });
  }

  private async lockProduct(
    client: PoolClient,
    actor: AuthPrincipal,
    id: string,
  ): Promise<ProductRecord> {
    const result = await client.query<Record<string, unknown>>(
      `SELECT * FROM products
       WHERE id = $1 AND provider_user_id = $2 FOR UPDATE`,
      [id, actor.sub],
    );
    if (!result.rows[0]) throw new Error('PRODUCT_NOT_FOUND');
    return mapProduct(result.rows[0]);
  }

  private async lockPlan(
    client: PoolClient,
    actor: AuthPrincipal,
    id: string,
  ): Promise<PlanRecord> {
    const result = await client.query<Record<string, unknown>>(
      `SELECT * FROM plans
       WHERE id = $1 AND provider_user_id = $2 FOR UPDATE`,
      [id, actor.sub],
    );
    if (!result.rows[0]) throw new Error('PLAN_NOT_FOUND');
    return mapPlan(result.rows[0]);
  }

  private writeAudit(
    client: PoolClient,
    actor: AuthPrincipal,
    action: string,
    targetType: 'PLAN' | 'PRODUCT',
    targetId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.write(client, {
      action,
      actorRole: actor.role,
      actorUserId: actor.sub,
      metadata,
      targetId,
      targetType,
    });
  }

  private async withTransaction<T>(
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
