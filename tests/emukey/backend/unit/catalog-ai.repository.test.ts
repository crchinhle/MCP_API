import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { CatalogAiRepository } from '../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/catalog-ai.repository.js';
import type { EmbeddingPort } from '../../../../EmuKey/backend/src/modules/assistance-support/application/ports/embedding.port.js';

const row = {
  product_id: '00000000-0000-4000-8000-000000000001', product_code: 'CLASSROOM', product_name: 'Classroom',
  plan_id: '00000000-0000-4000-8000-000000000002', plan_name: 'Yearly', price_vnd: '900000',
  max_active_devices: 5, duration_months: 12, entitlements: { classrooms: true }, content: 'Classroom yearly', content_hash: 'hash',
};
function setup() {
  const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const embedding: EmbeddingPort = { model: 'test-model', dimensions: 3, embed: vi.fn().mockResolvedValue([1, 0, 0]) };
  return { query, embedding, repository: new CatalogAiRepository({ query } as unknown as Pool, embedding) };
}

describe('Catalog AI retrieval', () => {
  it('does not include the generic gói prefix in a named product reference', async () => {
    const { repository, query } = setup();
    await repository.search({ question: 'Gói Classroom Hub có những gói nào giá ra sao và được nhà cung cấp nào cung cấp' });
    expect(query.mock.calls[0][1].at(-1)).toBe('classroom hub');
  });
  it('returns numeric catalog sources and never writes during semantic inference', async () => {
    const { query, embedding, repository } = setup();
    query.mockResolvedValueOnce({ rows: [row] });
    expect(await repository.search({ question: 'school management', maxPriceVnd: 1000000, minDevices: 4, durationMonths: 12 }))
      .toMatchObject([{ id: `catalog:${row.plan_id}`, kind: 'CATALOG', priceVnd: 900000, maxActiveDevices: 5, retrievalMethod: 'VECTOR' }]);
    expect(embedding.embed).toHaveBeenCalledWith({ text: 'school management', taskType: 'RETRIEVAL_QUERY' });
    for (const [sql] of query.mock.calls) expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE)\b/i);
    expect(query.mock.calls[0][0]).toContain('content_hash = d.content_hash');
    expect(query.mock.calls[0][1]).toEqual([null, null, 1000000, 4, 12, '[1,0,0]', 'test-model', 3, 'school management', null]);
  });

  it('falls back honestly when embedding fails, without sending SQL error details to logs', async () => {
    const { query, embedding, repository } = setup();
    vi.mocked(embedding.embed).mockRejectedValueOnce(new Error('provider secret'));
    query.mockResolvedValueOnce({ rows: [row] });
    expect(await repository.search({ question: 'Classroom' })).toMatchObject([{ retrievalMethod: 'LEXICAL' }]);
    expect(query.mock.calls[0][0]).toContain('to_tsquery');
  });

  it('falls back when the index is absent or has no current model/hash match', async () => {
    const { query, repository } = setup();
    query.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: '42P01' })).mockResolvedValueOnce({ rows: [row] });
    expect(await repository.search({ question: 'Classroom' })).toMatchObject([{ retrievalMethod: 'LEXICAL' }]);
    const next = setup();
    next.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [row] });
    expect(await next.repository.search({ question: 'Classroom' })).toMatchObject([{ retrievalMethod: 'LEXICAL' }]);
  });

  it('does not hide database permission failures', async () => {
    const { query, repository } = setup();
    query.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: '42501' }));
    await expect(repository.search({ question: 'Classroom' })).rejects.toThrow('denied');
  });

  it('rejects malformed constraints and invalid vectors before querying', async () => {
    const { query, embedding, repository } = setup();
    await expect(repository.search({ question: 'x', minDevices: -1 })).rejects.toThrow('CATALOG_INVALID_FILTER');
    await expect(repository.search({ question: 'x', productIds: ['sql injection'] })).rejects.toThrow('CATALOG_INVALID_FILTER');
    expect(query).not.toHaveBeenCalled();
    vi.mocked(embedding.embed).mockResolvedValueOnce([NaN, 0, 0]);
    await repository.search({ question: 'Classroom' });
    expect(query.mock.calls[0][0]).toContain('to_tsquery');
  });

  it('reindexes only changed documents and uses a live hash guard on writes', async () => {
    const { query, embedding, repository } = setup();
    query.mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rowCount: 1, rows: [] });
    expect(await repository.reindex()).toEqual({ indexed: 1, superseded: 0, model: 'test-model', dimensions: 3 });
    expect(embedding.embed).toHaveBeenCalledWith({ text: row.content, taskType: 'RETRIEVAL_DOCUMENT' });
    expect(query.mock.calls[0][0]).toContain('IS DISTINCT FROM');
    expect(query.mock.calls[1][0]).toContain('d.content_hash = $4');
    expect(query.mock.calls[1][0]).toContain('ON CONFLICT');
  });

  it('requires an embedding adapter for explicit reindex', async () => {
    const { query } = setup();
    await expect(new CatalogAiRepository({ query } as unknown as Pool).reindex()).rejects.toThrow('CATALOG_EMBEDDING_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('reports current/stale/missing index coverage without calling the embedding provider', async () => {
    const { query, embedding, repository } = setup();
    query.mockResolvedValueOnce({ rows: [{ published_plans: '5', indexed_plans: '2', stale_plans: '1', missing_plans: '2' }] });
    expect(await repository.status()).toEqual({ publishedPlans: 5, indexedPlans: 2, stalePlans: 1, missingPlans: 2, model: 'test-model', dimensions: 3 });
    expect(embedding.embed).not.toHaveBeenCalled();
  });

  it('uses OR keywords, literal product scope, and a cosine threshold instead of filter-only relevance', async () => {
    const { query, repository } = setup();
    await repository.search({ question: 'Classroom Hub có những gói nào?', maxPriceVnd: 1000000 });
    expect(query.mock.calls[0][0]).toContain('0.5');
    expect(query.mock.calls[0][1].at(-1)).toBe('classroom hub');
    expect(query.mock.calls[1][1][5]).toBe('Classroom | Hub');
    expect(query.mock.calls[1][0]).not.toContain('OR $3::bigint IS NOT NULL');
  });

  it('keeps injection literals entirely in parameters and never interprets them as SQL', async () => {
    const { query, repository } = setup();
    const question = '"Missing\' OR 1=1; DROP TABLE products; --" có những gói nào?';
    expect(await repository.search({ question })).toEqual([]);
    for (const [sql, parameters] of query.mock.calls) {
      expect(sql).not.toContain('DROP TABLE');
      expect(parameters).toContain('missing\' or 1=1; drop table products; --');
    }
  });
});
