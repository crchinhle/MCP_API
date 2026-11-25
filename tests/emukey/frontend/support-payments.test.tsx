import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

const supportHistoryFixture = [
  {
    transactionId: 'tx-sup-1',
    providerEventId: 'evt-sup-1',
    providerTransactionReference: 'SEPAY-SUP-001',
    amountVnd: 2500000,
    classification: 'MATCHED',
    reviewStatus: null,
    receivedAt: '2026-10-03T10:00:00.000Z',
    providerOccurredAt: '2026-10-03T09:59:00.000Z',
    orderId: 'ord-sup-1',
    orderNumber: 'ORD-SUP-001',
    orderType: 'NEW_PURCHASE',
    productNameSnapshot: 'Enterprise Key',
    planNameSnapshot: 'Gói năm',
  },
];

describe('Support staff payment history (UC2)', () => {
  it('navigates from support menu to read-only payment history and opens transaction detail without review actions', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/payments/history')) return Response.json(supportHistoryFixture);
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/support']} />);
      const navLink = await screen.findByRole('link', { name: 'Lịch sử thanh toán' });
      fireEvent.click(navLink);

      expect(await screen.findByRole('heading', { name: 'Lịch sử thanh toán' })).toBeTruthy();
      expect(await screen.findByText('ORD-SUP-001')).toBeTruthy();

      expect(screen.queryByText(/Rà soát thanh toán/i)).toBeNull();
      expect(screen.queryByRole('button', { name: /Ghi kết luận|Rematch|Đối soát/i })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Xem' }));
      expect(await screen.findByRole('dialog')).toBeTruthy();
      expect(screen.getByText('SEPAY-SUP-001')).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('does not loop requests when /payments/history returns 500 and retries only on explicit click', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let historyCalls = 0;
    let shouldFail = true;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/payments/history')) {
        historyCalls += 1;
        if (shouldFail) {
          return Response.json({ message: 'Internal Server Error' }, { status: 500 });
        }
        return Response.json(supportHistoryFixture);
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/support/payments']} />);
      expect(await screen.findByText('Không thể tải lịch sử thanh toán.')).toBeTruthy();
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(historyCalls).toBe(1);

      shouldFail = false;
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByText('ORD-SUP-001')).toBeTruthy();
      expect(historyCalls).toBe(2);
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('denies CUSTOMER access to /support/payments via real ProtectedRoute guard without calling /payments/history', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let historyCalled = false;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return Response.json({
          accessToken: 'tok-cust',
          user: { id: 'cust-1', email: 'c@example.com', displayName: 'Cust', role: 'CUSTOMER', status: 'ACTIVE' },
        });
      }
      if (url.endsWith('/payments/history')) {
        historyCalled = true;
        return Response.json(supportHistoryFixture);
      }
      return original(input, init);
    });
    try {
      window.history.pushState({}, '', '/support/payments');
      render(<App />);
      expect(await screen.findByText('Không có quyền truy cập')).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Lịch sử thanh toán' })).toBeNull();
      expect(historyCalled).toBe(false);
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('allows SUPPORT_STAFF access to /support/payments via real ProtectedRoute guard in read-only mode', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return Response.json({
          accessToken: 'tok-sup',
          user: { id: 'sup-1', email: 's@example.com', displayName: 'Sup', role: 'SUPPORT_STAFF', status: 'ACTIVE' },
        });
      }
      if (url.endsWith('/payments/history')) {
        return Response.json(supportHistoryFixture);
      }
      return original(input, init);
    });
    try {
      window.history.pushState({}, '', '/support/payments');
      render(<App />);
      expect(await screen.findByRole('heading', { name: 'Lịch sử thanh toán' })).toBeTruthy();
      expect(await screen.findByText('ORD-SUP-001')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Ghi kết luận|Rematch|Đối soát|Bàn giao bản quyền/i })).toBeNull();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('reuses the refresh request ID when retrying a failed session check', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const refreshIds: (string | null)[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshIds.push(new Headers(init?.headers).get('X-Refresh-Request-Id'));
        if (refreshIds.length === 1) return Response.json({}, { status: 503 });
        return Response.json({
          accessToken: 'tok-sup',
          user: { id: 'sup-1', email: 's@example.com', displayName: 'Sup', role: 'SUPPORT_STAFF', status: 'ACTIVE' },
        });
      }
      if (url.endsWith('/payments/history')) return Response.json(supportHistoryFixture);
      return original(input, init);
    });
    try {
      window.history.pushState({}, '', '/support/payments');
      render(<App />);
      fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByText('ORD-SUP-001')).toBeTruthy();
      expect(refreshIds).toEqual([expect.stringMatching(/^[0-9a-f]{32}$/), refreshIds[0]]);
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });
});
