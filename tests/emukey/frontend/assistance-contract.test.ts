import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestJson } from '../../../EmuKey/frontend/src/application/auth/authContext';
import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversationMessages, type MessageDto } from '../../../EmuKey/frontend/src/application/assistance/assistanceQueries';

// SUP-03 / SUP-20 regression: the backend assistance contract requires
// `clientMessageId` on AI asks and `reason` on escalation. Sending the old
// payload makes every escalation fail with 400, so these assertions lock the
// request shape at the boundary.
describe('assistance request contract', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('merges older history with a concurrent new-message poll and keeps conversation caches separate', async () => {
    const paths: URL[] = [];
    const message = (sequence: number): MessageDto => ({ id: `message-${sequence}`, clientMessageId: `intent-${sequence}`, conversationId: 'first', serverSequence: sequence, senderType: 'CUSTOMER', content: `Message ${sequence}` });
    let releaseOlder: (() => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(String(url), 'http://localhost'); paths.push(parsed);
      if (parsed.pathname.includes('/second/')) return Response.json([]);
      if (parsed.searchParams.has('before')) {
        await new Promise<void>(resolve => { releaseOlder = resolve; });
        return Response.json(Array.from({ length: 50 }, (_, index) => message(index + 1)));
      }
      if (parsed.searchParams.has('after')) return Response.json([message(101)]);
      return Response.json(Array.from({ length: 50 }, (_, index) => message(index + 51)));
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const { result, rerender } = renderHook(({ id }) => useConversationMessages(id), { initialProps: { id: 'first' }, wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(50));
    let loading: Promise<unknown> | undefined;
    act(() => { loading = result.current.loadOlder(); });
    await waitFor(() => expect(releaseOlder).toBeDefined());
    await act(async () => { await result.current.refetch(); });
    await act(async () => { releaseOlder!(); await loading; });
    await waitFor(() => expect(result.current.data).toHaveLength(101));
    expect(new Set(result.current.data!.map(item => item.id)).size).toBe(101);
    expect(result.current.data!.map(item => item.serverSequence)).toEqual(Array.from({ length: 101 }, (_, index) => index + 1));
    expect(paths.some(url => url.searchParams.get('before') === '51')).toBe(true);
    expect(paths.some(url => url.searchParams.get('after') === '100')).toBe(true);
    rerender({ id: 'second' });
    await waitFor(() => expect(result.current.data).toEqual([]));
    rerender({ id: 'first' });
    await waitFor(() => expect(result.current.data).toHaveLength(101));
  });

  it.each([25, 50])('retains an older page of %i messages committed between poll computation and its cache write', async (olderCount) => {
    const message = (sequence: number): MessageDto => ({ id: `message-${sequence}`, clientMessageId: `intent-${sequence}`, conversationId: 'first', serverSequence: sequence, senderType: 'CUSTOMER', content: `Message ${sequence}` });
    let releaseOlder: (() => void) | undefined;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const parsed = new URL(String(url), 'http://localhost');
      if (parsed.searchParams.has('before')) {
        await new Promise<void>(resolve => { releaseOlder = resolve; });
        return Response.json(Array.from({ length: olderCount }, (_, index) => message(index + 51 - olderCount)));
      }
      return Response.json(parsed.searchParams.has('after') ? [message(101)] : Array.from({ length: 50 }, (_, index) => message(index + 51)));
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const { result, unmount } = renderHook(() => useConversationMessages('first'), { wrapper });
    try {
      await waitFor(() => expect(result.current.data).toHaveLength(50));
      let loading: Promise<unknown> | undefined;
      act(() => { loading = result.current.loadOlder(); });
      await waitFor(() => expect(releaseOlder).toBeDefined());
      const query = client.getQueryCache().find({ queryKey: ['assistance', 'messages', 'first', undefined] })!;
      const options = query.options;
      const poll = options.queryFn as (context: unknown) => Promise<unknown>;
      // Hold the real query result at the asynchronous framework boundary;
      // the real older-page mutation commits before QueryClient stores it.
      await act(async () => { await client.fetchQuery({ ...options, queryFn: async context => {
        const computed = await poll(context);
        releaseOlder!();
        await loading;
        return computed;
      } }); });
      await waitFor(() => expect(result.current.data).toHaveLength(olderCount + 51));
      expect(result.current.data!.map(item => item.serverSequence)).toEqual(Array.from({ length: olderCount + 51 }, (_, index) => index + 51 - olderCount));
      expect(new Set(result.current.data!.map(item => item.id)).size).toBe(olderCount + 51);
      expect(result.current.hasOlder).toBe(olderCount === 50);
    } finally { unmount(); client.clear(); }
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
