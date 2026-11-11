import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { PDFParse } from 'pdf-parse';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { PrivateStoragePort } from '../../../platform/storage/private-storage.port.js';

export function normalizeTags(tags?: string[]): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length > 50) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed);
      if (result.length >= 10) break;
    }
  }
  return result;
}

function mapDocument(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    ...(typeof row.provider_user_id === 'string' ? { providerUserId: row.provider_user_id } : {}),
    ...(typeof row.product_id === 'string' ? { productId: row.product_id } : {}),
    ...(typeof row.product_name === 'string' ? { productName: row.product_name } : {}),
    ...(typeof row.plan_id === 'string' ? { planId: row.plan_id } : {}),
    ...(typeof row.plan_name === 'string' ? { planName: row.plan_name } : {}),
    title: String(row.title),
    ...(typeof row.summary === 'string' ? { summary: row.summary } : {}),
    ...(Array.isArray(row.tags) && row.tags.length > 0 ? { tags: row.tags as string[] } : {}),
    logicalDocumentKey: String(row.logical_document_key),
    version: Number(row.version),
    status: String(row.status),
    isCurrent: row.is_current === true,
    ...(row.created_at ? { createdAt: new Date(row.created_at as string).toISOString() } : {}),
    ...(row.updated_at ? { updatedAt: new Date(row.updated_at as string).toISOString() } : {}),
  };
}

export class KnowledgeRepository {
  constructor(
    private readonly pool: Pool,
    private readonly storage?: PrivateStoragePort,
    private readonly limits = {
      maxFileBytes: 10_485_760,
      maxChunks: 500,
      maxChunkBytes: 12_000,
      allowedMimeTypes: ['application/pdf', 'text/plain'],
    },
  ) {}

  capabilities() {
    return {
      maxFileBytes: Math.min(this.limits.maxFileBytes, 10_485_760),
      allowedMimeTypes: this.limits.allowedMimeTypes,
    };
  }

  async chunk(actor: AuthPrincipal, documentId: string, chunkId: string) {
    const document = await this.detail(actor, documentId);
    const result = await this.pool.query<{ id: string; content: string; chunk_index: number; heading: string | null }>(
      'SELECT id, content, chunk_index, heading FROM knowledge_chunks WHERE id = $1 AND document_id = $2',
      [chunkId, documentId],
    );
    if (!result.rows[0]) throw new Error('KNOWLEDGE_DOCUMENT_NOT_FOUND');
    return {
      documentId,
      documentTitle: document.title,
      documentVersion: document.version,
      chunkId,
      content: result.rows[0].content,
      chunkIndex: result.rows[0].chunk_index,
      heading: result.rows[0].heading ?? undefined,
    };
  }

  async create(
    actor: AuthPrincipal,
    input: {
      chunks?: string[];
      file?: { originalname: string; mimetype: string; size: number; buffer: Buffer };
      logicalDocumentKey: string;
      productId: string;
      planId?: string;
      sourceType: string;
      title: string;
      summary?: string;
      tags?: string[];
      version?: number;
    },
  ) {
    const client = await this.pool.connect();
    let storageKey: string | null = null;
    try {
      await client.query('BEGIN');
      const owned = await client.query('SELECT id FROM products WHERE id = $1 AND provider_user_id = $2 FOR SHARE', [
        input.productId,
        actor.sub,
      ]);
      if (!owned.rows[0]) throw new Error('KNOWLEDGE_PRODUCT_NOT_FOUND');

      if (input.planId) {
        const planOwned = await client.query('SELECT id FROM plans WHERE id = $1 AND product_id = $2 FOR SHARE', [
          input.planId,
          input.productId,
        ]);
        if (!planOwned.rows[0]) throw new Error('KNOWLEDGE_PLAN_NOT_FOUND');
      }

      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [
        `knowledge:${input.productId}:${input.logicalDocumentKey}`,
      ]);
      const versions = await client.query<{ next_version: number }>(
        'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM knowledge_documents WHERE product_id = $1 AND logical_document_key = $2',
        [input.productId, input.logicalDocumentKey],
      );
      const version = input.version ?? Number(versions.rows[0]?.next_version ?? 1);
      const duplicate = await client.query(
        'SELECT id FROM knowledge_documents WHERE product_id = $1 AND logical_document_key = $2 AND version = $3',
        [input.productId, input.logicalDocumentKey, version],
      );
      if (duplicate.rows[0]) throw new Error('KNOWLEDGE_VERSION_EXISTS');

      if (input.file && !this.storage) throw new Error('KNOWLEDGE_STORAGE_UNAVAILABLE');
      if (input.file && input.file.size > this.capabilities().maxFileBytes) throw new Error('KNOWLEDGE_FILE_TOO_LARGE');
      if (
        input.file &&
        (!this.limits.allowedMimeTypes.includes(input.file.mimetype) ||
          !validFile(input.file) ||
          (input.sourceType === 'PDF' && input.file.mimetype !== 'application/pdf') ||
          (input.sourceType === 'TXT' && input.file.mimetype !== 'text/plain'))
      )
        throw new Error('KNOWLEDGE_FILE_NOT_ALLOWED');

      const structuredChunks: Array<{ heading?: string; content: string }> = input.chunks
        ? input.chunks.map((content) => ({ content }))
        : input.file
          ? await extractStructuredChunks(input.file, this.limits.maxChunkBytes)
          : [];

      if (
        structuredChunks.length === 0 ||
        structuredChunks.length > this.limits.maxChunks ||
        structuredChunks.some((chunk) => Buffer.byteLength(chunk.content, 'utf8') > this.limits.maxChunkBytes)
      )
        throw new Error('KNOWLEDGE_CHUNK_LIMIT');

      storageKey = input.file
        ? `knowledge/${actor.sub}/${input.productId}/${input.logicalDocumentKey}/${version}-${createHash('sha256')
            .update(input.file.buffer)
            .digest('hex')}`
        : null;
      if (input.file && storageKey) await this.storage!.put(storageKey, input.file.buffer, input.file.mimetype);

      const normalizedTags = normalizeTags(input.tags);

      const document = await client.query<Record<string, unknown>>(
        `INSERT INTO knowledge_documents (
          product_id, plan_id, logical_document_key, version, source_type,
          title, summary, tags, storage_key, storage_mime_type, storage_size_bytes,
          checksum, status
        )
        SELECT
          id, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          decode($12, 'hex'), 'PROCESSING'
        FROM products WHERE id = $13 AND provider_user_id = $1
        RETURNING id`,
        [
          actor.sub,
          input.planId ?? null,
          input.logicalDocumentKey,
          version,
          input.sourceType,
          input.title,
          input.summary ?? null,
          normalizedTags,
          storageKey,
          input.file?.mimetype ?? null,
          input.file?.size ?? null,
          input.file ? createHash('sha256').update(input.file.buffer).digest('hex') : null,
          input.productId,
        ],
      );
      if (!document.rows[0]) throw new Error('KNOWLEDGE_PRODUCT_NOT_FOUND');

      for (const [index, chunk] of structuredChunks.entries()) {
        await client.query(
          `INSERT INTO knowledge_chunks (document_id, chunk_index, heading, content) VALUES ($1, $2, $3, $4)`,
          [document.rows[0].id, index, chunk.heading ?? null, chunk.content],
        );
      }

      await client.query(`UPDATE knowledge_documents SET status = 'READY', updated_at = now() WHERE id = $1`, [
        document.rows[0].id,
      ]);
      await client.query('COMMIT');
      return mapDocument({
        ...document.rows[0],
        title: input.title,
        summary: input.summary ?? null,
        tags: normalizedTags,
        logical_document_key: input.logicalDocumentKey,
        version,
        status: 'READY',
        is_current: false,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      if (storageKey) await this.storage?.delete(storageKey).catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async list(actor: AuthPrincipal): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT kd.*,
              p.provider_user_id,
              p.name AS product_name,
              pl.name AS plan_name
       FROM knowledge_documents kd
       JOIN products p ON p.id = kd.product_id
       LEFT JOIN plans pl ON pl.id = kd.plan_id
       WHERE $2 = 'SYSTEM_ADMIN'
          OR ($2 = 'PROVIDER_ADMIN' AND kd.product_id IN (SELECT id FROM products WHERE provider_user_id = $1))
          OR ($2 = 'CUSTOMER' AND kd.status = 'READY' AND kd.is_current
              AND kd.product_id IN (SELECT product_id FROM licenses WHERE customer_user_id = $1))
       ORDER BY p.provider_user_id, kd.logical_document_key, kd.version DESC`,
      [actor.sub, actor.role],
    );
    return result.rows.map(mapDocument);
  }

  async detail(actor: AuthPrincipal, id: string) {
    const document = await this.pool.query<Record<string, unknown>>(
      `SELECT kd.*,
              p.provider_user_id,
              p.name AS product_name,
              pl.name AS plan_name
       FROM knowledge_documents kd
       JOIN products p ON p.id = kd.product_id
       LEFT JOIN plans pl ON pl.id = kd.plan_id
       WHERE kd.id = $1 AND (
         $3 = 'SYSTEM_ADMIN'
         OR ($3 = 'PROVIDER_ADMIN' AND kd.product_id IN (SELECT id FROM products WHERE provider_user_id = $2))
         OR ($3 = 'CUSTOMER' AND kd.status = 'READY' AND kd.is_current
             AND kd.product_id IN (SELECT product_id FROM licenses WHERE customer_user_id = $2))
       )`,
      [id, actor.sub, actor.role],
    );
    if (!document.rows[0]) throw new Error('KNOWLEDGE_DOCUMENT_NOT_FOUND');
    const chunks = await this.pool.query<{ id: string; chunk_index: number; heading: string | null; content: string }>(
      'SELECT id, chunk_index, heading, content FROM knowledge_chunks WHERE document_id = $1 ORDER BY chunk_index',
      [id],
    );
    const chunkDetails = chunks.rows.map((row) => ({
      id: row.id,
      chunkIndex: row.chunk_index,
      heading: row.heading ?? undefined,
      content: row.content,
    }));
    return {
      ...mapDocument(document.rows[0]),
      chunks: chunks.rows.map((row) => row.content),
      chunkDetails,
      content: chunks.rows.map((row) => row.content).join('\n\n'),
    };
  }

  async publish(actor: AuthPrincipal, id: string, expectedCurrentVersion?: number) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const target = await client.query<{ logical_document_key: string; product_id: string }>(
        "SELECT logical_document_key, product_id FROM knowledge_documents WHERE id=$1 AND (product_id IN (SELECT id FROM products WHERE provider_user_id=$2) OR $3='SYSTEM_ADMIN')",
        [id, actor.sub, actor.role],
      );
      if (!target.rows[0]) throw new Error('KNOWLEDGE_DOCUMENT_NOT_FOUND');
      const productId = target.rows[0].product_id;
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [
        `knowledge:${productId}:${target.rows[0].logical_document_key}`,
      ]);
      const current = await client.query<{ version: number }>(
        'SELECT version FROM knowledge_documents WHERE product_id = $1 AND logical_document_key = (SELECT logical_document_key FROM knowledge_documents WHERE id = $2 AND product_id=$1) AND is_current FOR UPDATE',
        [productId, id],
      );
      if (expectedCurrentVersion !== undefined && (current.rows[0]?.version ?? 0) !== expectedCurrentVersion)
        throw new Error('KNOWLEDGE_VERSION_CONFLICT');
      await client.query(
        `UPDATE knowledge_documents SET is_current = FALSE, updated_at = now() WHERE product_id = $1 AND logical_document_key = (SELECT logical_document_key FROM knowledge_documents WHERE id = $2 AND product_id=$1)`,
        [productId, id],
      );
      const result = await client.query<Record<string, unknown>>(
        `UPDATE knowledge_documents SET is_current = TRUE, updated_at = now() WHERE id = $1 AND product_id = $2 AND status = 'READY' RETURNING *, (SELECT provider_user_id FROM products WHERE id=knowledge_documents.product_id) AS provider_user_id`,
        [id, productId],
      );
      if (!result.rows[0]) throw new Error('KNOWLEDGE_DOCUMENT_NOT_FOUND');
      await client.query('COMMIT');
      return mapDocument(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async search(actor: AuthPrincipal, question: string): Promise<Array<{ id: string; content: string }>> {
    const result = await this.pool.query<{
      id: string;
      content: string;
      documentId: string;
      documentTitle: string;
      documentVersion: number;
      chunkIndex: number;
    }>(
      `SELECT kc.id::text AS id, kc.content, kd.id AS "documentId", kd.title AS "documentTitle", kd.version AS "documentVersion", kc.chunk_index AS "chunkIndex"
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kd.status = 'READY' AND kd.is_current
         AND (
           $2 = 'SYSTEM_ADMIN' OR
           ($2 = 'PROVIDER_ADMIN' AND kd.product_id IN (SELECT id FROM products WHERE provider_user_id = $1)) OR
           ($2 = 'CUSTOMER' AND kd.product_id IN (
             SELECT product_id FROM licenses WHERE customer_user_id = $1
           ))
         )
         AND to_tsvector('simple', kc.content) @@ websearch_to_tsquery('simple', $3)
       ORDER BY ts_rank(to_tsvector('simple', kc.content), websearch_to_tsquery('simple', $3)) DESC,
                kc.created_at DESC LIMIT 5`,
      [actor.sub, actor.role, question],
    );
    return result.rows;
  }

  async searchForConversation(input: { conversationId: string; customerUserId: string; question: string }) {
    const result = await this.pool.query<{
      id: string;
      content: string;
      documentId: string;
      documentTitle: string;
      documentVersion: number;
      chunkIndex: number;
    }>(
      `SELECT kc.id::text AS id, kc.content, kd.id AS "documentId", kd.title AS "documentTitle", kd.version AS "documentVersion", kc.chunk_index AS "chunkIndex"
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       JOIN conversations c ON c.id = $1 AND c.customer_user_id = $2
       WHERE kd.status = 'READY' AND kd.is_current
         AND kd.product_id IN (
           SELECT product_id FROM licenses WHERE customer_user_id = $2
         )
         AND (num_nonnulls(c.product_id, c.plan_id, c.order_id, c.license_id) = 0 OR
              (c.product_id IS NOT NULL AND c.product_id = kd.product_id) OR
              (c.order_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM orders o WHERE o.id = c.order_id AND o.customer_user_id = $2 AND o.product_id = kd.product_id
              )) OR
              (c.plan_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM plans p JOIN products product ON product.id = p.product_id
                WHERE p.id = c.plan_id AND p.product_id = kd.product_id
                  AND p.status = 'PUBLISHED' AND product.status = 'PUBLISHED'
              )) OR
              (c.license_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM licenses l WHERE l.id = c.license_id AND l.customer_user_id = $2 AND l.product_id = kd.product_id
              )))
         AND to_tsvector('simple', kc.content) @@ websearch_to_tsquery('simple', $3)
       ORDER BY ts_rank(to_tsvector('simple', kc.content), websearch_to_tsquery('simple', $3)) DESC,
                kc.created_at DESC LIMIT 5`,
      [input.conversationId, input.customerUserId, input.question],
    );
    return result.rows;
  }

  // PUBLIC HELP CENTER APIS (No Auth Required)
  async listPublic(query: { search?: string; tag?: string; productId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = ["kd.status = 'READY'", 'kd.is_current = TRUE', "p.status = 'PUBLISHED'"];
    const values: unknown[] = [];
    let pIdx = 1;

    if (query.productId) {
      conditions.push(`kd.product_id = $${pIdx++}`);
      values.push(query.productId);
    }

    if (query.tag && query.tag.trim() && query.tag.trim() !== 'Tất cả') {
      conditions.push(`EXISTS (SELECT 1 FROM unnest(kd.tags) t WHERE lower(t) = lower($${pIdx++}))`);
      values.push(query.tag.trim());
    }

    if (query.search && query.search.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        `(kd.title ILIKE $${pIdx} OR p.name ILIKE $${pIdx} OR kd.summary ILIKE $${pIdx} OR EXISTS (SELECT 1 FROM unnest(kd.tags) t WHERE t ILIKE $${pIdx}))`,
      );
      values.push(s);
      pIdx++;
    }

    const whereClause = conditions.join(' AND ');

    // 1. Total count
    const countRes = await this.pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM knowledge_documents kd
       JOIN products p ON p.id = kd.product_id
       WHERE ${whereClause}`,
      values,
    );
    const total = Number(countRes.rows[0]?.count ?? 0);

    // 2. Paginated items
    const itemsRes = await this.pool.query<Record<string, unknown>>(
      `SELECT kd.id, kd.product_id, p.name AS product_name,
              kd.plan_id, pl.name AS plan_name,
              kd.title, kd.summary, kd.tags, kd.source_type, kd.updated_at
       FROM knowledge_documents kd
       JOIN products p ON p.id = kd.product_id
       LEFT JOIN plans pl ON pl.id = kd.plan_id
       WHERE ${whereClause}
       ORDER BY kd.updated_at DESC, kd.title ASC
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...values, limit, offset],
    );

    const items = itemsRes.rows.map((row) => ({
      id: String(row.id),
      productId: String(row.product_id),
      productName: String(row.product_name),
      planId: row.plan_id ? String(row.plan_id) : undefined,
      planName: row.plan_name ? String(row.plan_name) : undefined,
      title: String(row.title),
      summary: row.summary ? String(row.summary) : undefined,
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      sourceType: String(row.source_type),
      updatedAt: row.updated_at ? new Date(row.updated_at as string).toISOString() : new Date().toISOString(),
    }));

    // 3. Available tags across all published docs of published products
    const tagsRes = await this.pool.query<{ tag: string }>(
      `SELECT DISTINCT unnest(kd.tags) AS tag
       FROM knowledge_documents kd
       JOIN products p ON p.id = kd.product_id
       WHERE kd.status = 'READY' AND kd.is_current = TRUE AND p.status = 'PUBLISHED'
       ORDER BY tag ASC`,
    );
    const availableTags = tagsRes.rows.map((r) => r.tag).filter(Boolean);

    // 4. Products that have published docs
    const productsRes = await this.pool.query<{ id: string; name: string }>(
      `SELECT DISTINCT p.id, p.name
       FROM products p
       JOIN knowledge_documents kd ON kd.product_id = p.id
       WHERE kd.status = 'READY' AND kd.is_current = TRUE AND p.status = 'PUBLISHED'
       ORDER BY p.name ASC`,
    );
    const products = productsRes.rows.map((r) => ({ id: String(r.id), name: String(r.name) }));

    return {
      items,
      total,
      page,
      limit,
      availableTags,
      products,
    };
  }

  async detailPublic(id: string) {
    const docRes = await this.pool.query<Record<string, unknown>>(
      `SELECT kd.id, kd.product_id, p.name AS product_name,
              kd.plan_id, pl.name AS plan_name,
              kd.title, kd.summary, kd.tags, kd.source_type, kd.updated_at
       FROM knowledge_documents kd
       JOIN products p ON p.id = kd.product_id
       LEFT JOIN plans pl ON pl.id = kd.plan_id
       WHERE kd.id = $1 AND kd.status = 'READY' AND kd.is_current = TRUE AND p.status = 'PUBLISHED'`,
      [id],
    );

    if (!docRes.rows[0]) throw new Error('KNOWLEDGE_DOCUMENT_NOT_FOUND');
    const row = docRes.rows[0];

    const chunksRes = await this.pool.query<{
      id: string;
      chunk_index: number;
      heading: string | null;
      content: string;
    }>(
      `SELECT id, chunk_index, heading, content
       FROM knowledge_chunks
       WHERE document_id = $1
       ORDER BY chunk_index ASC`,
      [id],
    );

    const chunks = chunksRes.rows.map((c) => ({
      id: String(c.id),
      chunkIndex: Number(c.chunk_index),
      heading: c.heading ?? undefined,
      content: String(c.content),
    }));

    const fullContent = chunks.map((c) => c.content).join('\n\n');

    // Related documents of same product or sharing tags
    const relatedRes = await this.pool.query<Record<string, unknown>>(
      `SELECT kd.id, kd.title, kd.tags, p.name AS product_name
       FROM knowledge_documents kd
       JOIN products p ON p.id = kd.product_id
       WHERE kd.status = 'READY' AND kd.is_current = TRUE AND p.status = 'PUBLISHED'
         AND kd.id <> $1
         AND (kd.product_id = $2 OR (cardinality(kd.tags) > 0 AND kd.tags && $3))
       ORDER BY (kd.product_id = $2) DESC, kd.updated_at DESC
       LIMIT 4`,
      [id, row.product_id, row.tags ?? []],
    );

    const relatedDocuments = relatedRes.rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      productName: String(r.product_name),
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    }));

    return {
      id: String(row.id),
      productId: String(row.product_id),
      productName: String(row.product_name),
      planId: row.plan_id ? String(row.plan_id) : undefined,
      planName: row.plan_name ? String(row.plan_name) : undefined,
      title: String(row.title),
      summary: row.summary ? String(row.summary) : undefined,
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      sourceType: String(row.source_type),
      updatedAt: row.updated_at ? new Date(row.updated_at as string).toISOString() : new Date().toISOString(),
      chunks,
      content: fullContent,
      relatedDocuments,
    };
  }
}

export function chunkText(content: string, maxChunkBytes = 12_000): string[] {
  const normalized = content.replaceAll('\u0000', '').trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const codePoint of normalized) {
    const codePointBytes = Buffer.byteLength(codePoint, 'utf8');
    if (current && currentBytes + codePointBytes > maxChunkBytes) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    if (codePointBytes > maxChunkBytes) throw new Error('KNOWLEDGE_CHUNK_LIMIT');
    current += codePoint;
    currentBytes += codePointBytes;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function chunkStructuredText(
  content: string,
  maxChunkBytes = 12_000,
): Array<{ heading?: string; content: string }> {
  const normalized = content.replaceAll('\u0000', '').trim();
  if (!normalized) return [];

  const headingRegex = /(?:^|\n)(#{1,4}\s+[^\n]+)/g;
  const sections: Array<{ heading?: string; text: string }> = [];
  let lastIndex = 0;
  let currentHeading: string | undefined = undefined;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(normalized)) !== null) {
    const textBefore = normalized.slice(lastIndex, match.index).trim();
    if (textBefore) {
      sections.push({ ...(currentHeading ? { heading: currentHeading } : {}), text: textBefore });
    }
    const matchedHeading = match[1];
    if (matchedHeading) {
      currentHeading = matchedHeading.replace(/^#{1,4}\s+/, '').trim();
    }
    lastIndex = match.index + match[0].length;
  }
  const textAfter = normalized.slice(lastIndex).trim();
  if (textAfter) {
    sections.push({ ...(currentHeading ? { heading: currentHeading } : {}), text: textAfter });
  }

  if (sections.length === 0) {
    sections.push({ text: normalized });
  }

  const result: Array<{ heading?: string; content: string }> = [];
  for (const section of sections) {
    const sectionBytes = Buffer.byteLength(section.text, 'utf8');
    const headingProp = section.heading ? { heading: section.heading } : {};
    if (sectionBytes <= maxChunkBytes) {
      result.push({ ...headingProp, content: section.text });
      continue;
    }

    const paragraphs = section.text.split(/\n\s*\n+/);
    let buffer = '';
    let bufferBytes = 0;
    for (const p of paragraphs) {
      const pTrimmed = p.trim();
      if (!pTrimmed) continue;
      const pBytes = Buffer.byteLength(pTrimmed, 'utf8');
      if (pBytes > maxChunkBytes) {
        if (buffer) {
          result.push({ ...headingProp, content: buffer });
          buffer = '';
          bufferBytes = 0;
        }
        const subChunks = chunkText(pTrimmed, maxChunkBytes);
        for (const sub of subChunks) {
          result.push({ ...headingProp, content: sub });
        }
      } else if (bufferBytes + pBytes + 2 > maxChunkBytes) {
        result.push({ ...headingProp, content: buffer });
        buffer = pTrimmed;
        bufferBytes = pBytes;
      } else {
        buffer = buffer ? `${buffer}\n\n${pTrimmed}` : pTrimmed;
        bufferBytes = Buffer.byteLength(buffer, 'utf8');
      }
    }
    if (buffer) {
      result.push({ ...headingProp, content: buffer });
    }
  }

  return result.length > 0 ? result : [{ content: normalized }];
}

function validFile(file: { originalname: string; mimetype: string; buffer: Buffer }): boolean {
  const extension = file.originalname.toLowerCase().split('.').pop();
  if (file.mimetype === 'application/pdf')
    return extension === 'pdf' && file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  return extension === 'txt' && !file.buffer.includes(0);
}

async function extractStructuredChunks(
  file: { mimetype: string; buffer: Buffer },
  maxChunkBytes: number,
): Promise<Array<{ heading?: string; content: string }>> {
  if (file.mimetype === 'text/plain') return chunkStructuredText(file.buffer.toString('utf8'), maxChunkBytes);
  const parser = new PDFParse({ data: file.buffer });
  try {
    const result = await parser.getText();
    return chunkStructuredText(result.text, maxChunkBytes);
  } finally {
    await parser.destroy();
  }
}
