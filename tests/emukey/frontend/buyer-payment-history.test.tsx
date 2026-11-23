import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../../EmuKey/frontend/src/application/auth/authContext';
import { App } from '../../../EmuKey/frontend/src/presentation/app/App';
import { BuyerPaymentHistoryScreen } from '../../../EmuKey/frontend/src/presentation/screens/BuyerPaymentHistoryScreen';

afterEach(() => {
  cleanup();
});

const historyFixture = [
  {
    transactionId: 'tx-1',
    providerEventId: 'evt-1',
    providerTransactionReference: 'SEPAY-REF-001',
    amountVnd: 1500000,
    classification: 'MATCHED',
    reviewStatus: null,
    receivedAt: '2026-10-01T10:00:00.000Z',
    providerOccurredAt: '2026-10-01T09:59:00.000Z',
    orderId: '00000000-0000-4000-8000-000000000501',
    orderNumber: 'ORD-2026-0218',
    orderType: 'NEW_PURCHASE',
    productNameSnapshot: 'SecureDesk Pro',
    planNameSnapshot: 'Gói 25 thiết bị',
  },
  {
    transactionId: 'tx-2',
    providerEventId: 'evt-2',
    providerTransactionReference: null,
    amountVnd: 500000,
    classification: 'AMOUNT_MISMATCH',
    reviewStatus: 'OPEN',
    receivedAt: '2026-10-02T11:00:00.000Z',
    providerOccurredAt: '2026-10-02T10:59:00.000Z',
    orderId: null,
    orderNumber: null,
    orderType: null,
    productNameSnapshot: null,
    planNameSnapshot: null,
  },
];

describe('Customer payment history (web)', () => {
  it('navigates from BuyerOrdersScreen to payment history, renders transactions, and opens order detail', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/payments/history')) return Response.json(historyFixture);
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/buyer/orders']} />);
      await screen.findByText('ORD-2026-0218');

      fireEvent.click(screen.getByRole('button', { name: 'Lịch sử thanh toán' }));

      expect(await screen.findByRole('heading', { name: 'Lịch sử thanh toán' })).toBeTruthy();
      expect(await screen.findByText('SEPAY-REF-001')).toBeTruthy();
      expect(screen.getAllByText('Không có').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/1\.500\.000\s*₫/)).toBeTruthy();
      expect(screen.getByText('Đã khớp')).toBeTruthy();
      expect(screen.getByText('Số tiền không khớp')).toBeTruthy();

      fireEvent.click(screen.getByRole('link', { name: 'Xem đơn hàng' }));
      expect(await screen.findByRole('dialog')).toBeTruthy();
      expect(await screen.findByText(/Chi tiết ORD-2026-0218/)).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('shows empty state, error state, and retries loading payment history', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let phase: 'error' | 'empty' = 'error';
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/payments/history')) {
        if (phase === 'error') {
          return Response.json({ message: 'Lỗi máy chủ' }, { status: 500 });
        }
        return Response.json([]);
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/buyer/orders/history']} />);
      expect(await screen.findByText('Không thể tải lịch sử thanh toán')).toBeTruthy();

      phase = 'empty';
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByText('Chưa có giao dịch thanh toán nào.')).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('does not flash previous account payment history when switching users', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let currentAccount = 'customer-a';
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/payments/history')) {
        if (currentAccount === 'customer-a') {
          return Response.json([historyFixture[0]]);
        }
        return Response.json([
          {
            ...historyFixture[0],
            transactionId: 'tx-b',
            orderNumber: 'ORD-USER-B',
            providerTransactionReference: 'REF-USER-B',
          },
        ]);
      }
      return original(input, init);
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const renderWithUser = (id: string) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider
          key={id}
          initialUser={{ id, email: `${id}@example.com`, displayName: id, role: 'CUSTOMER', status: 'ACTIVE' }}
          skipBootstrap
        >
          <MemoryRouter initialEntries={['/buyer/orders/history']}>
            <Routes>
              <Route path="/buyer/orders/history" element={<BuyerPaymentHistoryScreen />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    try {
      const { rerender } = render(renderWithUser('customer-a'));
      expect(await screen.findByText('SEPAY-REF-001')).toBeTruthy();

      currentAccount = 'customer-b';
      rerender(renderWithUser('customer-b'));

      expect(screen.queryByText('SEPAY-REF-001')).toBeNull();
      await waitFor(() => expect(screen.getByText('REF-USER-B')).toBeTruthy());
      expect(screen.queryByText('SEPAY-REF-001')).toBeNull();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });
});
