import { Logger } from '@nestjs/common';
import type { QueryResult, QueryResultRow } from 'pg';
import type { GroundingSource } from '../application/ports/ai-gateway.port.js';
import { catalogReference } from '../application/catalog-reference.js';
import {
  validateEmbedding,
  type EmbeddingPort,
} from '../application/ports/embedding.port.js';

export interface CatalogSearchInput {
  interpreted?: boolean;
  productReference?: string;
  question: string;
  productIds?: string[];
  planIds?: string[];
  maxPriceVnd?: number;
  minDevices?: number;
  durationMonths?: number;
}

interface CatalogRow {
  [key: string]: unknown;
  product_id: string;
  product_code: string;
  product_name: string;
  plan_id: string;
  plan_name: string;
  price_vnd: string | number;
  max_active_devices: number;
  duration_months: number;
  entitlements: Record<string, unknown>;
  content: string;
  content_hash: string;
}

const filters = `($1::uuid[] IS NULL OR d.product_id = ANY($1::uuid[]))
  AND ($2::uuid[] IS NULL OR d.plan_id = ANY($2::uuid[]))
  AND ($3::bigint IS NULL OR d.price_vnd <= $3)
  AND ($4::integer IS NULL OR d.max_active_devices >= $4)
  AND ($5::integer IS NULL OR d.duration_months = $5)`;

const stopwords = new Set(
  (
    'toi minh ban can muon tim co nhung cac goi nao gi la va cho cua voi ve duoc khong hay mot san pham phan mem ' +
    'the a an and or for of to is are what which how please product products plan plans software'
  ).split(' '),
);

/** Only letter/number lexemes enter tsquery syntax; the entire expression remains a bound value. */
function lexicalTerms(question: string): string {
  return [
    ...new Set(
      (question.match(/[\p{L}\p{N}]+/gu) ?? []).filter((token) => {
        const normalized = token
          .normalize('NFD')
          .replace(/\p{M}/gu, '')
          .toLowerCase()
          .replaceAll('đ', 'd');
        return (
          token.length > 1 && token.length <= 80 && !stopwords.has(normalized)
        );
      }),
    ),
  ]
    .slice(0, 24)
    .join(' | ');
}

/** Explicit quoted names and named-product package/price questions fail closed on unknown names. */
function namedScope(
  questionParameter: number,
  literalParameter: number,
): string {
  return `WITH named_products AS (SELECT DISTINCT n.product_id FROM ai_public_catalog n
    WHERE strpos(lower($${questionParameter}), lower(n.product_name)) > 0
       OR strpos(lower($${questionParameter}), lower(n.product_code)) > 0
       OR ($${literalParameter}::text IS NOT NULL AND starts_with(lower(n.product_name), $${literalParameter} || ' ')))`;
}

function nameFilter(literalParameter: number): string {
  return `(NOT EXISTS (SELECT 1 FROM named_products) OR d.product_id IN (SELECT product_id FROM named_products))
    AND ($${literalParameter}::text IS NULL OR lower(d.product_name) = $${literalParameter}
      OR starts_with(lower(d.product_name), $${literalParameter} || ' ')
      OR lower(d.product_code) = $${literalParameter} OR lower(d.plan_name) = $${literalParameter})`;
}

export class CatalogAiRepository {
  private readonly logger = new Logger(CatalogAiRepository.name);
  constructor(
    private readonly pool: {
      query<R extends QueryResultRow>(
        text: string,
        values?: unknown[],
      ): Promise<QueryResult<R>>;
    },
    private readonly embedding?: EmbeddingPort,
  ) {}

  /** SELECT only: use a reader pool/transaction, never the trusted indexer's pool in inference. */
  async search(input: CatalogSearchInput): Promise<GroundingSource[]> {
    this.validate(input);
    const parameters = [
      input.productIds ?? null,
      input.planIds ?? null,
      input.maxPriceVnd ?? null,
      input.minDevices ?? null,
      input.durationMonths ?? null,
    ];
    if (input.interpreted && input.productReference?.trim()) {
      // Resolve a model-extracted name against the actual published catalog first.
      // Ignore spacing/punctuation/case so "clinic desk" can resolve "ClinicDesk".
      // A miss falls through to embeddings; this hint never excludes semantic candidates.
      const reference = input.productReference
        .replace(/[^\p{L}\p{N}]/gu, '')
        .toLowerCase();
      const named = await this.pool.query<CatalogRow>(
        `SELECT d.* FROM ai_public_catalog d WHERE ${filters}
        AND (regexp_replace(lower(d.product_name),'[^[:alnum:]]','','g') = $6
          OR regexp_replace(lower(d.product_code),'[^[:alnum:]]','','g') = $6
          OR starts_with(regexp_replace(lower(d.product_name),'[^[:alnum:]]','','g'), $6))
        ORDER BY d.product_name,d.price_vnd,d.plan_id LIMIT 8`,
        [...parameters, reference],
      );
      if (reference.length >= 3 && named.rows.length) {
        this.logger.log({
          event: 'ai.catalog.retrieval',
          method: 'LEXICAL',
          reason: 'RESOLVED_NAME',
          count: named.rows.length,
        });
        return this.sources(named.rows, 'LEXICAL');
      }
    }
    // Semantic interpretation is a search hint, never a literal identity constraint.
    // Reranking validates candidate identities afterwards. Lexical-only development
    // retains the conservative literal fallback when no understanding adapter exists.
    const literal =
      input.interpreted || input.planIds?.length || input.productIds?.length
        ? null
        : catalogReference(input.question);
    let reason = 'EMBEDDING_DISABLED';
    if (this.embedding && !input.planIds?.length) {
      let vector: number[] | undefined;
      try {
        vector = validateEmbedding(
          await this.embedding.embed({
            text: input.question,
            taskType: 'RETRIEVAL_QUERY',
          }),
          this.embedding.dimensions,
        );
      } catch {
        reason = 'EMBEDDING_UNAVAILABLE';
      }
      if (vector) {
        try {
          // Exact cosine search keeps structured filters complete; no approximate-index recall loss.
          const result = await this.pool.query<CatalogRow>(
            `${namedScope(9, 10)} SELECT d.*, 1 - (e.embedding <=> $6::vector) AS similarity FROM ai_public_catalog d
            JOIN ai_public_catalog_embeddings e ON e.plan_id = d.plan_id AND e.content_hash = d.content_hash
            WHERE ${filters} AND e.model = $7 AND e.dimensions = $8
            AND ${nameFilter(10)}
            AND CASE WHEN e.dimensions = $8 THEN (e.embedding <=> $6::vector) <= 0.5 ELSE false END
            ORDER BY e.embedding <=> $6::vector, d.plan_id LIMIT 8`,
            [
              ...parameters,
              JSON.stringify(vector),
              this.embedding.model,
              this.embedding.dimensions,
              input.question,
              literal,
            ],
          );
          if (result.rows.length) {
            this.logger.log({
              event: 'ai.catalog.retrieval',
              method: 'VECTOR',
              count: result.rows.length,
            });
            // Keep a narrow relevance band around the best candidate. Shared catalog JSON
            // vocabulary alone must not introduce a different software category into advice.
            const best = Number(result.rows[0]?.similarity ?? 1);
            return this.sources(
              result.rows.filter(
                (row) =>
                  row.similarity === undefined ||
                  Number(row.similarity) >= best - 0.05,
              ),
              'VECTOR',
            );
          }
          reason = 'NO_VECTOR_MATCH';
        } catch (error) {
          // Only missing deployment artifacts permit fallback; authorization/connection failures surface.
          const code = (error as { code?: string }).code;
          if (code !== '42P01' && code !== '42704' && code !== '42883')
            throw error;
          reason = 'VECTOR_SCHEMA_UNAVAILABLE';
        }
      }
    }
    const result = await this.pool.query<CatalogRow>(
      `${namedScope(7, 8)} SELECT d.* FROM ai_public_catalog d
      WHERE ${filters} AND ${nameFilter(8)} AND (
        to_tsvector('simple', d.content) @@ to_tsquery('simple', $6)
        OR cardinality($1::uuid[]) > 0 OR cardinality($2::uuid[]) > 0
        OR EXISTS (SELECT 1 FROM named_products WHERE product_id = d.product_id))
      ORDER BY CASE WHEN strpos(lower($7), lower(d.product_name)) > 0 OR strpos(lower($7), lower(d.product_code)) > 0
          THEN 2 WHEN strpos(lower($7), lower(d.plan_name)) > 0 THEN 1 ELSE 0 END DESC,
        ts_rank_cd(to_tsvector('simple', d.content), to_tsquery('simple', $6)) DESC,
        d.price_vnd, d.plan_id LIMIT 8`,
      [...parameters, lexicalTerms(input.question), input.question, literal],
    );
    this.logger.log({
      event: 'ai.catalog.retrieval',
      method: 'LEXICAL',
      reason,
      count: result.rows.length,
    });
    return this.sources(result.rows, 'LEXICAL');
  }

  /** Explicit trusted writer operation. No DDL or business-table updates; safe to repeat. */
  async reindex(): Promise<{
    indexed: number;
    superseded: number;
    model: string;
    dimensions: number;
  }> {
    if (!this.embedding) throw new Error('CATALOG_EMBEDDING_REQUIRED');
    const { model, dimensions } = this.embedding;
    const result = await this.pool.query<CatalogRow>(
      `SELECT d.* FROM ai_public_catalog d
      LEFT JOIN catalog_ai_embeddings e ON e.plan_id = d.plan_id AND e.model = $1 AND e.dimensions = $2
      WHERE e.content_hash IS DISTINCT FROM d.content_hash ORDER BY d.plan_id`,
      [model, dimensions],
    );
    let indexed = 0;
    let superseded = 0;
    for (const document of result.rows) {
      const vector = validateEmbedding(
        await this.embedding.embed({
          text: document.content,
          taskType: 'RETRIEVAL_DOCUMENT',
        }),
        dimensions,
      );
      // Re-check live publication/hash after the remote call. Search independently re-checks on every read.
      const written = await this.pool.query(
        `INSERT INTO catalog_ai_embeddings
        (plan_id, model, dimensions, content_hash, embedding, indexed_at)
        SELECT d.plan_id, $2, $3, d.content_hash, $5::vector, now() FROM ai_public_catalog d
        WHERE d.plan_id = $1 AND d.content_hash = $4
        ON CONFLICT (plan_id, model, dimensions) DO UPDATE SET
          content_hash = EXCLUDED.content_hash, embedding = EXCLUDED.embedding, indexed_at = EXCLUDED.indexed_at`,
        [
          document.plan_id,
          model,
          dimensions,
          document.content_hash,
          JSON.stringify(vector),
        ],
      );
      if (written.rowCount) indexed++;
      else superseded++;
    }
    this.logger.log({
      event: 'ai.catalog.reindex',
      indexed,
      superseded,
      model,
      dimensions,
    });
    return { indexed, superseded, model, dimensions };
  }

  /** Trusted operational diagnostics; stale hashes are intentionally invisible to inference views. */
  async status(
    space = {
      model: this.embedding?.model ?? 'gemini-embedding-001',
      dimensions: this.embedding?.dimensions ?? 768,
    },
  ) {
    if (
      !space.model.trim() ||
      !Number.isInteger(space.dimensions) ||
      space.dimensions < 1 ||
      space.dimensions > 3072
    )
      throw new Error('EMBEDDING_INVALID_OPTIONS');
    const result = await this.pool.query<{
      published_plans: string;
      indexed_plans: string;
      stale_plans: string;
      missing_plans: string;
    }>(
      `SELECT count(*) AS published_plans,
        count(*) FILTER (WHERE e.content_hash = d.content_hash) AS indexed_plans,
        count(*) FILTER (WHERE e.content_hash IS NOT NULL AND e.content_hash <> d.content_hash) AS stale_plans,
        count(*) FILTER (WHERE e.plan_id IS NULL) AS missing_plans
       FROM ai_public_catalog d LEFT JOIN catalog_ai_embeddings e
         ON e.plan_id = d.plan_id AND e.model = $1 AND e.dimensions = $2`,
      [space.model, space.dimensions],
    );
    const row = result.rows[0];
    return {
      publishedPlans: Number(row?.published_plans ?? 0),
      indexedPlans: Number(row?.indexed_plans ?? 0),
      stalePlans: Number(row?.stale_plans ?? 0),
      missingPlans: Number(row?.missing_plans ?? 0),
      ...space,
    };
  }

  private validate(input: CatalogSearchInput): void {
    if (
      typeof input.question !== 'string' ||
      !input.question.trim() ||
      input.question.length > 4000
    )
      throw new Error('CATALOG_INVALID_QUESTION');
    for (const ids of [input.productIds, input.planIds]) {
      if (
        ids !== undefined &&
        (!Array.isArray(ids) ||
          ids.length > 100 ||
          ids.some(
            (id) =>
              typeof id !== 'string' ||
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                id,
              ),
          ))
      )
        throw new Error('CATALOG_INVALID_FILTER');
    }
    for (const value of [
      input.maxPriceVnd,
      input.minDevices,
      input.durationMonths,
    ]) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
        throw new Error('CATALOG_INVALID_FILTER');
    }
    if (
      (input.minDevices !== undefined &&
        (input.minDevices < 1 || input.minDevices > 2147483647)) ||
      (input.durationMonths !== undefined &&
        (input.durationMonths < 1 || input.durationMonths > 2147483647))
    )
      throw new Error('CATALOG_INVALID_FILTER');
  }

  private sources(
    rows: CatalogRow[],
    retrievalMethod: 'VECTOR' | 'LEXICAL',
  ): GroundingSource[] {
    return rows.map((row) => ({
      id: `catalog:${row.plan_id}`,
      kind: 'CATALOG' as const,
      content: row.content,
      productId: row.product_id,
      productCode: row.product_code,
      productName: row.product_name,
      planId: row.plan_id,
      planName: row.plan_name,
      priceVnd: Number(row.price_vnd),
      maxActiveDevices: Number(row.max_active_devices),
      durationMonths: Number(row.duration_months),
      entitlements: row.entitlements,
      retrievalMethod,
    }));
  }
}
