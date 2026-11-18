import { PublicAssistantService } from '../../../../EmuKey/backend/src/modules/assistance-support/application/public-assistant.service.js';

function setup() {
  const records = new Map<string, string>();
  const redis = { incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1), get: vi.fn(async (key: string) => records.get(key) ?? null), set: vi.fn(async (key: string, value: string, ...args: unknown[]) => { if (args.includes('NX') && records.has(key)) return null; records.set(key, value); return 'OK'; }), eval: vi.fn(async (_script: string, _n: number, key: string) => { records.delete(key); return 1; }) };
  const answer = { answer: 'verified', grounded: true, citedSourceIds: [], citationDetails: [], catalogSources: [], recommendations: [], intent: 'PRODUCT_QA', outcome: 'ANSWERED' };
  const advisor = { answer: vi.fn().mockResolvedValue(answer), isCurrent: vi.fn().mockResolvedValue(true) };
  return { records, redis, advisor, service: new PublicAssistantService(redis as never, advisor as never) };
}
describe('Public assistant session boundary', () => {
  it('requires independent proof and explicit consent and binds a transfer to one account', async () => {
    const { service } = setup();
    const first = await service.ask({ question: 'Public history', clientMessageId: 'initial' }, 'ip');
    const save = vi.fn().mockResolvedValue({ id: 'linked' });
    await expect(service.ask({ sessionId: first.sessionId, question: 'Read without proof', clientMessageId: 'other' }, 'ip')).rejects.toMatchObject({ status: 404 });
    await expect(service.link({ ...first, accepted: false }, 'customer-a', save)).rejects.toMatchObject({ status: 400 });
    await expect(service.link({ ...first, sessionToken: '0'.repeat(64), accepted: true }, 'customer-a', save)).rejects.toMatchObject({ status: 404 });
    expect(save).not.toHaveBeenCalled();
    expect(await service.link({ ...first, accepted: true }, 'customer-a', save)).toEqual({ id: 'linked' });
    expect(save).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'Public history' })]));
    expect(await service.link({ ...first, accepted: true }, 'customer-a', save)).toEqual({ id: 'linked' });
    expect(save).toHaveBeenCalledTimes(1);
    await expect(service.link({ ...first, accepted: true }, 'customer-b', save)).rejects.toMatchObject({ status: 404 });
    await expect(service.ask({ ...first, question: 'No guest access after linking', clientMessageId: 'later' }, 'ip')).rejects.toMatchObject({ status: 404 });
  });
  it('requires a separate session proof and explicit consent before linking guest history', async () => {
    const { service } = setup();
    const first = await service.ask({ question: 'Q', clientMessageId: 'first' }, 'ip');
    const save = vi.fn().mockResolvedValue({ id: 'linked' });
    await expect(service.link({ sessionId: first.sessionId, sessionToken: 'wrong', accepted: true }, 'buyer', save)).rejects.toMatchObject({ status: 404 });
    await expect(service.link({ sessionId: first.sessionId, sessionToken: first.sessionToken, accepted: false }, 'buyer', save)).rejects.toMatchObject({ status: 400 });
    await expect(service.link({ sessionId: first.sessionId, sessionToken: first.sessionToken, accepted: true }, 'buyer', save)).resolves.toEqual({ id: 'linked' });
    await expect(service.link({ sessionId: first.sessionId, sessionToken: first.sessionToken, accepted: true }, 'other', save)).rejects.toMatchObject({ status: 404 });
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('issues a server session and reuses its bounded history', async () => {
    const { service, advisor, redis } = setup();
    const first = await service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'id1' }, '127.0.0.1');
    expect(first.sessionId).toMatch(/^[a-f\d-]{36}$/);
    await service.ask({ question: 'Gói đó?', sessionId: first.sessionId, sessionToken: first.sessionToken, clientMessageId: 'id2' }, '127.0.0.1');
    expect(advisor.answer).toHaveBeenLastCalledWith(expect.objectContaining({ history: expect.arrayContaining([expect.objectContaining({ role: 'user', content: 'Sản phẩm nào?' })]) }));
    expect(redis.set).toHaveBeenCalledWith(expect.stringContaining('session'), expect.any(String), 'EX', 1800);
  });
  it('returns the same answer on retry without calling inference twice', async () => {
    const { service, advisor } = setup();
    const first = await service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'same' }, 'ip');
    const second = await service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'same', sessionId: first.sessionId, sessionToken: first.sessionToken }, 'ip');
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
    await expect(service.ask({ question: 'Khác', clientMessageId: 'same', sessionId: first.sessionId, sessionToken: first.sessionToken }, 'ip')).rejects.toThrow();
  });
  it('rechecks stored evidence on a retry after publication changes', async () => {
    const { service, advisor } = setup();
    const first = await service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'same' }, 'ip');
    advisor.isCurrent.mockResolvedValue(false);
    await expect(service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'same', sessionId: first.sessionId, sessionToken: first.sessionToken }, 'ip')).rejects.toThrow();
    expect(advisor.answer).toHaveBeenCalledTimes(1);
  });
  it('fails closed when rate limit is exceeded', async () => {
    const { service, redis, advisor } = setup(); redis.incr.mockResolvedValue(21);
    await expect(service.ask({ question: 'Sản phẩm nào?', clientMessageId: 'id' }, 'ip')).rejects.toThrow();
    expect(advisor.answer).not.toHaveBeenCalled();
  });
});
