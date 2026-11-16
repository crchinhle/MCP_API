import { describe, expect, it, vi } from 'vitest';
import { GeminiEmbeddingGateway } from '../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/gemini-embedding.gateway.js';
import { validateEmbedding } from '../../../../EmuKey/backend/src/modules/assistance-support/application/ports/embedding.port.js';
import { extractAiRetrievalUpgrade } from '../../../../EmuKey/backend/src/entrypoints/database/index-ai-catalog.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

describe('Catalog embedding adapter (mock provider, no Gemini quality claim)', () => {
  it('uses the requested model, dimensions and retrieval task with bounded transport', async () => {
    const gateway = new GeminiEmbeddingGateway({ apiKey: 'unit-test', dimensions: 3, timeoutMs: 500 });
    const embedContent = vi.spyOn(gateway['client'].models, 'embedContent').mockResolvedValueOnce({ embeddings: [{ values: [3, 4, 0] }] });
    expect(await gateway.embed({ text: 'school', taskType: 'RETRIEVAL_QUERY' })).toEqual([0.6, 0.8, 0]);
    expect(embedContent).toHaveBeenCalledWith({ model: 'gemini-embedding-001', contents: 'school', config: {
      taskType: 'RETRIEVAL_QUERY', outputDimensionality: 3, abortSignal: expect.any(AbortSignal), httpOptions: { timeout: 500 },
    } });
    embedContent.mockResolvedValueOnce({ embeddings: [{ values: [1, 0, 0] }] });
    await gateway.embed({ text: 'catalog', taskType: 'RETRIEVAL_DOCUMENT' });
    expect(embedContent.mock.calls.at(-1)?.[0].config.taskType).toBe('RETRIEVAL_DOCUMENT');
  });

  it('rejects wrong dimensions, empty responses, zero/invalid vectors and invalid options', async () => {
    expect(() => validateEmbedding([0, 0], 2)).toThrow('EMBEDDING_INVALID_VECTOR');
    expect(() => validateEmbedding([Infinity, 1], 2)).toThrow('EMBEDDING_INVALID_VECTOR');
    expect(() => new GeminiEmbeddingGateway({ apiKey: 'x', dimensions: 0 })).toThrow('EMBEDDING_INVALID_OPTIONS');
    const gateway = new GeminiEmbeddingGateway({ apiKey: 'unit-test', dimensions: 3 });
    const embedContent = vi.spyOn(gateway['client'].models, 'embedContent');
    embedContent.mockResolvedValueOnce({ embeddings: [] });
    await expect(gateway.embed({ text: 'catalog', taskType: 'RETRIEVAL_DOCUMENT' })).rejects.toThrow('EMBEDDING_INVALID_RESPONSE');
    embedContent.mockResolvedValueOnce({ embeddings: [{ values: [1, 0] }] });
    await expect(gateway.embed({ text: 'catalog', taskType: 'RETRIEVAL_DOCUMENT' })).rejects.toThrow('EMBEDDING_INVALID_VECTOR');
    await expect(gateway.embed({ text: '', taskType: 'RETRIEVAL_QUERY' })).rejects.toThrow('EMBEDDING_INVALID_INPUT');
  });
});

describe('Catalog additive upgrade', () => {
  it('derives additive SQL from authoritative schema markers without initializer/seed', async () => {
    const sql = extractAiRetrievalUpgrade(await readFile(resolve(import.meta.dirname, '../../../../EmuKey/backend/database/schema.sql'), 'utf8'));
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS catalog_ai_embeddings');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS ai_metadata');
    expect(sql).toContain('GRANT SELECT ON ai_public_catalog, ai_public_catalog_embeddings, ai_public_knowledge');
    expect(sql).not.toMatch(/DROP SCHEMA|emukey_seed|INSERT INTO users/);
    expect(sql.startsWith('BEGIN;')).toBe(true);
    expect(sql.endsWith('COMMIT;')).toBe(true);
  });
  it('refuses absent or duplicated schema markers', () => {
    expect(() => extractAiRetrievalUpgrade('BEGIN; COMMIT;')).toThrow('AI_RETRIEVAL_SCHEMA_MARKERS_INVALID');
    expect(() => extractAiRetrievalUpgrade('-- emukey:ai-retrieval:begin\nx\n-- emukey:ai-retrieval:begin\ny\n-- emukey:ai-retrieval:end')).toThrow();
  });
});
