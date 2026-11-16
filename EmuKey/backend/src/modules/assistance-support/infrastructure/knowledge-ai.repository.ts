import type { AiReadQueryPort } from './ai-retrieval.database.js';
import type { GroundingSource } from '../application/ports/ai-gateway.port.js';

/** Only public approved/current Knowledge is exposed to inference, for every role. */
export class KnowledgeAiRepository {
  constructor(private readonly pool: AiReadQueryPort) {}
  async search(input: {
    question: string;
    productIds?: string[];
    planIds?: string[];
  }): Promise<GroundingSource[]> {
    const result = await this.pool.query<GroundingSource>(
      `SELECT k.id::text AS id, k.content,
      k.document_id::text AS "documentId", k.document_title AS "documentTitle",
      k.document_version AS "documentVersion", k.chunk_index AS "chunkIndex",
      k.product_id::text AS "productId", k.plan_id::text AS "planId"
      FROM ai_public_knowledge k
      WHERE ($2::uuid[] IS NULL OR k.product_id=ANY($2))
        AND ($3::uuid[] IS NULL OR k.plan_id IS NULL OR k.plan_id=ANY($3))
        AND (to_tsvector('simple', k.content || ' ' || k.document_title) @@ websearch_to_tsquery('simple',$1)
          OR EXISTS (SELECT 1 FROM unnest(string_to_array(lower($1),' ')) term
            WHERE length(term)>=3 AND lower(k.content || ' ' || k.document_title) LIKE '%' || term || '%'))
      ORDER BY ts_rank_cd(to_tsvector('simple',k.content),websearch_to_tsquery('simple',$1)) DESC,
        k.document_id, k.chunk_index LIMIT 5`,
      [input.question, input.productIds ?? null, input.planIds ?? null],
    );
    return result.rows;
  }
}
