import { AiCatalogIndexer } from '../../../../EmuKey/backend/src/modules/assistance-support/worker/ai-catalog-indexer.js';

describe('Trusted catalog indexer', () => {
  it('skips duplicate concurrent polling and releases the Redis lease', async () => {
    let resolve!: () => void;
    const repository = { reindex: vi.fn(() => new Promise<void>(r => { resolve = r; })) };
    const redis = { set: vi.fn().mockResolvedValue('OK'), eval: vi.fn().mockResolvedValue(1) };
    const worker = new AiCatalogIndexer(repository as never, redis as never);
    const first = worker.poll(); await Promise.resolve();
    await worker.poll(); expect(repository.reindex).toHaveBeenCalledTimes(1);
    resolve(); await first; expect(redis.eval).toHaveBeenCalledTimes(1);
  });
  it('does not index while another worker owns the lease', async () => {
    const repository = { reindex: vi.fn() };
    await new AiCatalogIndexer(repository as never, { set: vi.fn().mockResolvedValue(null) } as never).poll();
    expect(repository.reindex).not.toHaveBeenCalled();
  });
});
