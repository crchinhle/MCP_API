import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { PDFParse } from 'pdf-parse';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { PrivateStoragePort } from '../../../platform/storage/private-storage.port.js';

function mapDocument(row: Record<string, unknown>) {
  return { id: String(row.id), title: String(row.title), logicalDocumentKey: String(row.logical_document_key), version: Number(row.version), status: String(row.status), isCurrent: row.is_current === true };
}

export class KnowledgeRepository {
  constructor(private readonly pool: Pool, private readonly storage?: PrivateStoragePort, private readonly limits = { maxFileBytes: 10_485_760, maxChunks: 500, maxChunkBytes: 12_000, allowedMimeTypes: ['application/pdf', 'text/plain'] }) {}
  async create(actor: AuthPrincipal, input: { chunks?: string[]; file?: { originalname: string; mimetype: string; size: number; buffer: Buffer }; logicalDocumentKey: string; productId: string; sourceType: string; title: string; version?: number }) {
    const client = await this.pool.connect();
    let storageKey: string | null = null;
    try {
      await client.query('BEGIN');
       const owned = await client.query('SELECT id FROM products WHERE id = $1 AND provider_user_id = $2 FOR SHARE', [input.productId, actor.sub]);
       if (!owned.rows[0]) throw new Error('KNOWLEDGE_PRODUCT_NOT_FOUND');
       await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [`knowledge:${actor.sub}:${input.logicalDocumentKey}`]);
       const versions = await client.query<{ next_version: number }>('SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM knowledge_documents WHERE provider_user_id = $1 AND logical_document_key = $2', [actor.sub, input.logicalDocumentKey]);
       const version = input.version ?? Number(versions.rows[0]?.next_version ?? 1);
       const duplicate = await client.query('SELECT id FROM knowledge_documents WHERE provider_user_id = $1 AND logical_document_key = $2 AND version = $3', [actor.sub, input.logicalDocumentKey, version]);
       if (duplicate.rows[0]) throw new Error('KNOWLEDGE_VERSION_EXISTS');
       if (input.file && (!this.storage || input.file.size > this.limits.maxFileBytes || !this.limits.allowedMimeTypes.includes(input.file.mimetype) || !validFile(input.file) || (input.sourceType === 'PDF' && input.file.mimetype !== 'application/pdf') || (input.sourceType === 'TXT' && input.file.mimetype !== 'text/plain'))) throw new Error('KNOWLEDGE_FILE_NOT_ALLOWED');
        const chunks = input.chunks ?? (input.file ? await extractChunks(input.file, this.limits.maxChunkBytes) : []);
       if (chunks.length === 0 || chunks.length > this.limits.maxChunks || chunks.some((chunk) => Buffer.byteLength(chunk, 'utf8') > this.limits.maxChunkBytes)) throw new Error('KNOWLEDGE_CHUNK_LIMIT');
       storageKey = input.file ? `knowledge/${actor.sub}/${input.logicalDocumentKey}/${version}-${createHash('sha256').update(input.file.buffer).digest('hex')}` : null;
       if (input.file && storageKey) await this.storage!.put(storageKey, input.file.buffer, input.file.mimetype);
       const document = await client.query<Record<string, unknown>>(`INSERT INTO knowledge_documents (provider_user_id, product_id, logical_document_key, version, source_type, title, storage_key, storage_mime_type, storage_size_bytes, checksum, status) SELECT $1, id, $2, $3, $4, $5, $6, $7, $8, decode($9, 'hex'), 'PROCESSING' FROM products WHERE id = $10 AND provider_user_id = $1 RETURNING id`, [actor.sub, input.logicalDocumentKey, version, input.sourceType, input.title, storageKey, input.file?.mimetype ?? null, input.file?.size ?? null, input.file ? createHash('sha256').update(input.file.buffer).digest('hex') : null, input.productId]);
       if (!document.rows[0]) throw new Error('KNOWLEDGE_PRODUCT_NOT_FOUND');
       for (const [index, content] of chunks.entries()) await client.query(`INSERT INTO knowledge_chunks (document_id, chunk_index, content, token_count) VALUES ($1, $2, $3, $4)`, [document.rows[0].id, index, content, content.split(/\s+/u).length]);
       await client.query(`UPDATE knowledge_documents SET status = 'READY', updated_at = now() WHERE id = $1`, [document.rows[0].id]);
      await client.query('COMMIT');
      return mapDocument({ ...document.rows[0], title: input.title, logical_document_key: input.logicalDocumentKey, version, status: 'READY', is_current: false });
    } catch (error) { await client.query('ROLLBACK'); if (storageKey) await this.storage?.delete(storageKey).catch(() => undefined); throw error; } finally { client.release(); }
  }
  async list(actor: AuthPrincipal): Promise<Record<string, unknown>[]> { const result = await this.pool.query<Record<string, unknown>>(`SELECT * FROM knowledge_documents WHERE provider_user_id = $1 ORDER BY logical_document_key, version DESC`, [actor.sub]); return result.rows.map(mapDocument); }
  async detail(actor: AuthPrincipal, id: string) {
    const document = await this.pool.query<Record<string, unknown>>('SELECT * FROM knowledge_documents WHERE id = $1 AND provider_user_id = $2', [id, actor.sub]);
    if (!document.rows[0]) throw new Error('KNOWLEDGE_DOCUMENT_NOT_FOUND');
    const chunks = await this.pool.query<{ content: string }>('SELECT content FROM knowledge_chunks WHERE document_id = $1 ORDER BY chunk_index', [id]);
    return { ...mapDocument(document.rows[0]), chunks: chunks.rows.map((row) => row.content) };
  }

  async publish(actor: AuthPrincipal, id: string, expectedCurrentVersion?: number) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const target = await client.query<{ logical_document_key: string }>('SELECT logical_document_key FROM knowledge_documents WHERE id = $1 AND provider_user_id = $2', [id, actor.sub]);
      if (!target.rows[0]) throw new Error('KNOWLEDGE_DOCUMENT_NOT_FOUND');
      // Serialize all versions, including the first publish where no current row exists.
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [`knowledge:${actor.sub}:${target.rows[0].logical_document_key}`]);
      const current = await client.query<{ version: number }>('SELECT version FROM knowledge_documents WHERE provider_user_id = $1 AND logical_document_key = (SELECT logical_document_key FROM knowledge_documents WHERE id = $2 AND provider_user_id = $1) AND is_current FOR UPDATE', [actor.sub, id]);
      if (expectedCurrentVersion !== undefined && (current.rows[0]?.version ?? 0) !== expectedCurrentVersion) throw new Error('KNOWLEDGE_VERSION_CONFLICT');
      await client.query(`UPDATE knowledge_documents SET is_current = FALSE, updated_at = now() WHERE provider_user_id = $1 AND logical_document_key = (SELECT logical_document_key FROM knowledge_documents WHERE id = $2 AND provider_user_id = $1)`, [actor.sub, id]);
      const result = await client.query<Record<string, unknown>>(`UPDATE knowledge_documents SET is_current = TRUE, updated_at = now() WHERE id = $1 AND provider_user_id = $2 AND status = 'READY' RETURNING *`, [id, actor.sub]);
      if (!result.rows[0]) throw new Error('KNOWLEDGE_DOCUMENT_NOT_FOUND');
      await client.query('COMMIT');
      return mapDocument(result.rows[0]);
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  async search(actor: AuthPrincipal, question: string): Promise<Array<{ id: string; content: string }>> {
    const result = await this.pool.query<{ id: string; content: string }>(
      `SELECT kc.id::text AS id, kc.content
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       WHERE kd.status = 'READY' AND kd.is_current
         AND (
           $2 = 'SYSTEM_ADMIN' OR
           ($2 = 'PROVIDER_ADMIN' AND kd.provider_user_id = $1) OR
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

  async searchForConversation(input: { conversationId: string; customerUserId: string; question: string }): Promise<Array<{ id: string; content: string }>> {
    const result = await this.pool.query<{ id: string; content: string }>(
      `SELECT kc.id::text AS id, kc.content
       FROM knowledge_chunks kc
       JOIN knowledge_documents kd ON kd.id = kc.document_id
       JOIN conversations c ON c.id = $1 AND c.customer_user_id = $2
        WHERE kd.status = 'READY' AND kd.is_current
          AND kd.product_id IN (
            SELECT product_id FROM licenses WHERE customer_user_id = $2
          )
          AND (c.context_type = 'GENERAL' OR
               (c.context_type = 'PRODUCT' AND c.context_id = kd.product_id) OR
               (c.context_type = 'ORDER' AND EXISTS (
                 SELECT 1 FROM orders o WHERE o.id = c.context_id AND o.customer_user_id = $2 AND o.product_id = kd.product_id
               )) OR
               (c.context_type = 'PLAN' AND EXISTS (
                 SELECT 1 FROM plans p JOIN products product ON product.id = p.product_id
                 WHERE p.id = c.context_id AND p.product_id = kd.product_id
                   AND p.status = 'PUBLISHED' AND product.status = 'PUBLISHED'
               )) OR
               (c.context_type = 'LICENSE' AND EXISTS (
                 SELECT 1 FROM licenses l WHERE l.id = c.context_id AND l.customer_user_id = $2 AND l.product_id = kd.product_id
               )))
          AND to_tsvector('simple', kc.content) @@ websearch_to_tsquery('simple', $3)
        ORDER BY ts_rank(to_tsvector('simple', kc.content), websearch_to_tsquery('simple', $3)) DESC,
                 kc.created_at DESC LIMIT 5`,
      [input.conversationId, input.customerUserId, input.question],
    );
    return result.rows;
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

function validFile(file: { originalname: string; mimetype: string; buffer: Buffer }): boolean {
  const extension = file.originalname.toLowerCase().split('.').pop();
  if (file.mimetype === 'application/pdf') return extension === 'pdf' && file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  return extension === 'txt' && !file.buffer.includes(0);
}

async function extractChunks(file: { mimetype: string; buffer: Buffer }, maxChunkBytes: number): Promise<string[]> {
  if (file.mimetype === 'text/plain') return chunkText(file.buffer.toString('utf8'), maxChunkBytes);
  const parser = new PDFParse({ data: file.buffer });
  try {
    const result = await parser.getText();
    return chunkText(result.text, maxChunkBytes);
  } finally {
    await parser.destroy();
  }
}
