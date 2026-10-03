import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestJson } from '../../../EmuKey/frontend/src/application/auth/authContext';

// SUP-03 / SUP-20 regression: the backend assistance contract requires
// `clientMessageId` on AI asks and `reason` on escalation. Sending the old
// payload makes every escalation fail with 400, so these assertions lock the
// request shape at the boundary.
describe('assistance request contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends a required clientMessageId with an AI question', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ answer: 'ok', citedSourceIds: [], grounded: false })),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    });

    await requestJson('/conversations/11111111-1111-4111-8111-111111111111/ai-ask', {
      method: 'POST',
      body: JSON.stringify({
        clientMessageId: '22222222-2222-4222-8222-222222222222',
        question: 'Gói nào cho 3 thiết bị?',
      }),
    });

    const call = fetchMock.mock.calls.at(-1);
    const init = call?.[1];
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
    expect(body).toEqual({
      clientMessageId: '22222222-2222-4222-8222-222222222222',
      question: 'Gói nào cho 3 thiết bị?',
    });
  });

  it('sends a non-empty reason when escalating to human support', async () => {
    const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(Response.json({ id: 'conversation' }, { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    });

    await requestJson('/conversations/11111111-1111-4111-8111-111111111111/request-support', {
      method: 'POST',
      body: JSON.stringify({ reason: 'AI chưa giải được, cần nhân viên kiểm tra đơn hàng.' }),
    });

    const call = fetchMock.mock.calls.at(-1);
    const init = call?.[1];
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
    expect(body.reason).toBe('AI chưa giải được, cần nhân viên kiểm tra đơn hàng.');
  });
});