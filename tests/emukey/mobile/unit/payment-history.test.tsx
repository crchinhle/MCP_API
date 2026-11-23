import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useCustomerSession } from '../../../../EmuKey/mobile/src/application/auth/useCustomerSession';
import { listOrders, listLicenses, listPaymentHistory } from '../../../../EmuKey/mobile/src/infrastructure/api/client';
import type { PaymentHistoryDto } from '../../../../EmuKey/mobile/src/infrastructure/api/generated';
import { OrdersScreen } from '../../../../EmuKey/mobile/src/presentation/screens/orders/OrdersScreen';
import { PaymentHistoryScreen } from '../../../../EmuKey/mobile/src/presentation/screens/orders/PaymentHistoryScreen';

jest.mock('../../../../EmuKey/mobile/src/application/auth/useCustomerSession', () => ({
  useCustomerSession: jest.fn(),
}));

jest.mock('../../../../EmuKey/mobile/src/infrastructure/api/client', () => {
  const actual = jest.requireActual<
    typeof import('../../../../EmuKey/mobile/src/infrastructure/api/client')
  >('../../../../EmuKey/mobile/src/infrastructure/api/client');
  return {
    MobileApiError: actual.MobileApiError,
    listOrders: jest.fn(),
    listLicenses: jest.fn(),
    listPaymentHistory: jest.fn(),
    listNotifications: jest.fn().mockResolvedValue([]),
  };
});

const historyFixture: PaymentHistoryDto[] = [
  {
    transactionId: 'tx-1',
    providerEventId: 'evt-1',
    providerTransactionReference: 'SEPAY-M-001',
    amountVnd: 990_000,
    classification: 'MATCHED',
    reviewStatus: null,
    receivedAt: '2026-10-01T10:00:00Z',
    providerOccurredAt: '2026-10-01T09:59:00Z',
    orderId: 'order-1',
    orderNumber: 'ORD-001',
    orderType: 'NEW_PURCHASE',
    productNameSnapshot: 'Desktop Pro',
    planNameSnapshot: 'Pro 1Y',
  },
  {
    transactionId: 'tx-2',
    providerEventId: 'evt-2',
    providerTransactionReference: null,
    amountVnd: 500_000,
    classification: 'UNMATCHED',
    reviewStatus: 'OPEN',
    receivedAt: '2026-10-02T10:00:00Z',
    providerOccurredAt: '2026-10-02T09:59:00Z',
    orderId: null,
    orderNumber: null,
    orderType: null,
    productNameSnapshot: null,
    planNameSnapshot: null,
  },
];

describe('Mobile customer payment history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useCustomerSession).mockReturnValue({
      user: { id: 'customer-1', email: 'c1@example.com', displayName: 'C1', role: 'CUSTOMER', status: 'ACTIVE' },
    } as ReturnType<typeof useCustomerSession>);
    jest.mocked(listOrders).mockResolvedValue([]);
    jest.mocked(listLicenses).mockResolvedValue([]);
  });

  it('opens payment history from OrdersScreen', async () => {
    const onOpenPaymentHistory = jest.fn();
    await render(
      <OrdersScreen
        onOpenNotifications={jest.fn()}
        onOpenOrderDetail={jest.fn()}
        onOpenPayment={jest.fn()}
        onOpenPaymentHistory={onOpenPaymentHistory}
        onOpenTerms={jest.fn()}
      />,
    );

    const button = await screen.findByText('Lịch sử thanh toán');
    fireEvent.press(button);
    expect(onOpenPaymentHistory).toHaveBeenCalledTimes(1);
  });

  it('renders payment history items, handles optional reference, and navigates to OrderDetail', async () => {
    jest.mocked(listPaymentHistory).mockResolvedValue(historyFixture);
    const onOpenOrderDetail = jest.fn();
    await render(
      <PaymentHistoryScreen
        onBack={jest.fn()}
        onOpenOrderDetail={onOpenOrderDetail}
      />,
    );

    expect(await screen.findByText('Desktop Pro')).toBeTruthy();
    expect(screen.getByText(/ORD-001/)).toBeTruthy();
    expect(screen.getByText(/SEPAY-M-001/)).toBeTruthy();
    expect(screen.getByText('Đã khớp')).toBeTruthy();
    expect(screen.getByText('Chưa khớp đơn hàng')).toBeTruthy();
    expect(screen.getByText(/990\.000\s*₫/)).toBeTruthy();

    fireEvent.press(screen.getByText('Xem đơn hàng'));
    expect(onOpenOrderDetail).toHaveBeenCalledWith('order-1');
  });

  it('handles error, retry, and empty state', async () => {
    jest.mocked(listPaymentHistory)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([]);

    await render(
      <PaymentHistoryScreen
        onBack={jest.fn()}
        onOpenOrderDetail={jest.fn()}
      />,
    );

    expect(await screen.findByText(/Không thể kết nối máy chủ|Không thể tải lịch sử thanh toán/)).toBeTruthy();
    fireEvent.press(screen.getByText('Thử lại'));

    expect(await screen.findByText('Chưa có giao dịch thanh toán')).toBeTruthy();
  });

  it('clears previous account payment history when switching users', async () => {
    jest.mocked(listPaymentHistory)
      .mockResolvedValueOnce([historyFixture[0]!])
      .mockResolvedValueOnce([
        {
          ...historyFixture[0]!,
          transactionId: 'tx-b',
          orderNumber: 'ORD-B',
          providerTransactionReference: 'REF-B',
        },
      ]);

    const { rerender } = await render(
      <PaymentHistoryScreen onBack={jest.fn()} onOpenOrderDetail={jest.fn()} />,
    );
    expect(await screen.findByText(/SEPAY-M-001/)).toBeTruthy();

    jest.mocked(useCustomerSession).mockReturnValue({
      user: { id: 'customer-2', email: 'c2@example.com', displayName: 'C2', role: 'CUSTOMER', status: 'ACTIVE' },
    } as ReturnType<typeof useCustomerSession>);

    await rerender(<PaymentHistoryScreen onBack={jest.fn()} onOpenOrderDetail={jest.fn()} />);

    expect(screen.queryByText(/SEPAY-M-001/)).toBeNull();
    await waitFor(() => expect(screen.getByText(/REF-B/)).toBeTruthy());
  });
});
