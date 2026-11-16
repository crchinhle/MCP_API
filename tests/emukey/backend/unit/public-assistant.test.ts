import { PublicAssistantService } from '../../../../EmuKey/backend/src/modules/assistance-support/application/public-assistant.service.js';

function setup() {
  const records = new Map<string, string>();
  const redis = { incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1), get: vi.fn(async (key: string) => records.get(key) ?? null), set: vi.fn(async (key: string, value: string, ...args: unknown[]) => { if (args.includes('NX') && records.has(key)) return null; records.set(key, value); return 'OK'; }), eval: vi.fn(async (_script: string, _n: number, key: string) => { records.delete(key); return 1; }) };
  const answer = { answer: 'verified', grounded: true, citedSourceIds: [], citationDetails: [], catalogSources: [], recommendations: [], intent: 'PRODUCT_QA', outcome: 'ANSWERED' };
  const advisor = { answer: vi.fn().mockResolvedValue(answer), isCurrent: vi.fn().mockResolvedValue(true) };
  return { records, redis, advisor, service: new PublicAssistantService(redis as never, advisor as never) };
}
describe('Public assistant session boundary', () => {
  it('issues a server session and reuses its bounded history', async () => {
    const { service, advisor, redis } = setup();
    const first = await service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'id1' }, '127.0.0.1');
    expect(first.sessionId).toMatch(/^[a-f\d-]{36}$/);
    await service.ask({ question: 'Gói đó?', sessionId: first.sessionId, clientMessageId: 'id2' }, '127.0.0.1');
    expect(advisor.answer).toHaveBeenLastCalledWith(expect.objectContaining({ history: expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'Sản phẩm nào?' })]) }));
    expect(redis.set).toHaveBeenCalledWith(expect.stringContaining('session'), expect.any(String), 'EX', 1800);
  });
  it('returns the same answer on retry without calling inference twice', async () => {
    const { service, advisor } = setup();
    const first = await service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'same' }, 'ip');
    const second = await service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'same', sessionId: first.sessionId }, 'ip');
    expect(second).toEqual(first); expect(advisor.answer).toHaveBeenCalledTimes(1);
  });
  it('does not let clients adopt an arbitrary session identifier', async () => {
    const { service, advisor } = setup();
    await expect(service.ask({ question: 'Q', clientMessageId: 'id', sessionId: 'guessed' }, 'ip')).rejects.toThrow();
    expect(advisor.answer).not.toHaveBeenCalled();
  });
  it('rejects reused client IDs with changed content', async () => {
    const { service } = setup();
    const first = await service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'same' }, 'ip');
    await expect(service.ask({ question: 'Khác', clientMessageId: 'same', sessionId: first.sessionId }, 'ip')).rejects.toThrow();
  });
  it('rechecks stored evidence on a retry after publication changes', async () => {
    const { service, advisor } = setup();
    const first = await service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'same' }, 'ip');
    advisor.isCurrent.mockResolvedValue(false);
    await expect(service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'same', sessionId: first.sessionId }, 'ip')).rejects.toThrow();
    expect(advisor.answer).toHaveBeenCalledTimes(1);
  });
  it('fails closed when rate limit is exceeded', async () => {
    const { service, redis, advisor } = setup(); redis.incr.mockResolvedValue(21);
    await expect(service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'id' }, 'ip')).rejects.toThrow();
    expect(advisor.answer).not.toHaveBeenCalled();
  });
});
