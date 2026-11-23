import * as Sharing from 'expo-sharing';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  buildOrdersCsv,
  escapeCsvCell,
  exportOrdersCsv,
} from '../../../../EmuKey/mobile/src/infrastructure/order-export';
import { OrderDetailScreen } from '../../../../EmuKey/mobile/src/presentation/screens/orders/OrderDetailScreen';
import { OrdersScreen } from '../../../../EmuKey/mobile/src/presentation/screens/orders/OrdersScreen';
import {
  MobileApiError,
  cancelOrder,
  getOrder,
  listLicenses,
  listOrders,
  type MobileOrderDetail,
  type MobileOrderSummary,
} from '../../../../EmuKey/mobile/src/infrastructure/api/client';

// The native preset's RefreshControl mock drops all props. Forward them so the
// test can trigger the real screen's onRefresh handler through a host element.
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: function MockRefreshControl(props: import('react-native').RefreshControlProps) {
      return React.createElement(View, props);
    },
  };
});

jest.mock('../../../../EmuKey/mobile/src/infrastructure/api/client', () => {
  const actual = jest.requireActual<
    typeof import('../../../../EmuKey/mobile/src/infrastructure/api/client')
  >('../../../../EmuKey/mobile/src/infrastructure/api/client');
  return {
    MobileApiError: actual.MobileApiError,
    listOrders: jest.fn(),
    listLicenses: jest.fn(),
    getOrder: jest.fn(),
    cancelOrder: jest.fn(),
    createConversation: jest.fn(),
    listNotifications: jest.fn().mockResolvedValue([]),
  };
});

const ordersFixture: MobileOrderSummary[] = [
  {
    id: 'o1',
    orderNumber: 'ORD-001',
    orderStatus: 'WAITING_PAYMENT',
    orderType: 'NEW_PURCHASE',
    productNameSnapshot: 'Desktop Pro',
    planNameSnapshot: 'Pro 1Y',
    priceVndSnapshot: 990_000,
    durationMonthsSnapshot: 12,
    maxActiveDevicesSnapshot: 2,
    createdAt: '2026-10-01T00:00:00Z',
  },
  {
    id: 'o2',
    orderNumber: 'ORD-002',
    orderStatus: 'PAYMENT_ACCEPTED',
    orderType: 'NEW_PURCHASE',
    productNameSnapshot: 'Server Key',
    planNameSnapshot: 'Enterprise',
    priceVndSnapshot: 2_500_000,
    durationMonthsSnapshot: 12,
    maxActiveDevicesSnapshot: 10,
    createdAt: '2026-10-02T00:00:00Z',
  },
  {
    id: 'o3',
    orderNumber: 'ORD-003',
    orderStatus: 'CANCELLED',
    orderType: 'NEW_PURCHASE',
    productNameSnapshot: 'Cancelled App',
    planNameSnapshot: 'Starter',
    priceVndSnapshot: 129_000,
    durationMonthsSnapshot: 1,
    maxActiveDevicesSnapshot: 1,
    createdAt: '2026-10-03T00:00:00Z',
  },
];

const detailFixture: MobileOrderDetail = {
  ...ordersFixture[0],
  billingCycleSnapshot: 'YEARLY',
  currency: 'VND',
  customerUserId: 'cust-1',
  entitlementsSnapshot: {},
  paymentDueAt: '2026-10-02T00:00:00Z',
  planCommitmentSnapshot: `0x${'11'.repeat(32)}`,
  planId: 'plan-1',
  planVersionSnapshot: 1,
  productId: 'prod-1',
  providerNameSnapshot: 'EmuKey',
  providerUserId: 'prov-1',
};

describe('mobile orders management & CSV export', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(listOrders).mockResolvedValue(ordersFixture);
    jest.mocked(listLicenses).mockResolvedValue([]);
  });

  it('escapes formula injection triggers cleanly in CSV cells and builds CSV rows', () => {
    expect(escapeCsvCell('=cmd|calc')).toBe(`"'=cmd|calc"`);
    expect(escapeCsvCell('+1+2')).toBe(`"'+1+2"`);
    expect(escapeCsvCell('-SUM(A1)')).toBe(`"'-SUM(A1)"`);
    expect(escapeCsvCell('@evil')).toBe(`"'@evil"`);
    expect(escapeCsvCell('Say "Hi"')).toBe('"Say ""Hi"""');

    const csv = buildOrdersCsv(ordersFixture);
    expect(csv).toContain('ORD-001');
    expect(csv).toContain('Chờ thanh toán');
  });

  it('skips sharing on empty orders and shares UTF-8 BOM CSV file when non-empty', async () => {
    expect(await exportOrdersCsv([])).toEqual({ exported: false, count: 0 });
    expect(Sharing.shareAsync).not.toHaveBeenCalled();

    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    const res = await exportOrdersCsv(ordersFixture);
    expect(res).toEqual({ exported: true, count: 3 });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('emukey-orders.csv'),
      expect.objectContaining({ mimeType: 'text/csv' }),
    );
  });

  it('filters orders by search query and quick status tab on OrdersScreen', async () => {
    await render(
      <OrdersScreen
        onOpenNotifications={jest.fn()}
        onOpenOrderDetail={jest.fn()}
        onOpenPayment={jest.fn()}
        onOpenTerms={jest.fn()}
      />,
    );

    expect(await screen.findByText('ORD-001')).toBeOnTheScreen();
    expect(screen.getByText('Desktop Pro')).toBeOnTheScreen();
    expect(screen.getByText('ORD-002')).toBeOnTheScreen();
    expect(screen.getByText('3 đơn hàng')).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByRole('tab', { name: 'Đã thanh toán' })));
    expect(screen.queryByText('ORD-001')).toBeNull();
    expect(screen.getByText('ORD-002')).toBeOnTheScreen();
    expect(screen.getByText('1/3 đơn · Đã thanh toán')).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByLabelText('Mở tùy chọn đơn hàng')));
    expect(await screen.findByText('Xuất CSV (1 đơn đang lọc)')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Đóng')));

    await act(async () => fireEvent.press(screen.getByRole('tab', { name: 'Tất cả' })));
    await act(async () =>
      fireEvent.changeText(
        screen.getByLabelText('Tìm mã đơn, sản phẩm hoặc gói'),
        'Desktop',
      ),
    );
    expect(screen.getByText('ORD-001')).toBeOnTheScreen();
    expect(screen.queryByText('ORD-002')).toBeNull();
  });

  it('does not display misleading 0/0 order stats while initial load is in flight', async () => {
    jest.mocked(listOrders).mockImplementation(() => new Promise(() => {}));
    await render(
      <OrdersScreen
        onOpenNotifications={jest.fn()}
        onOpenOrderDetail={jest.fn()}
        onOpenPayment={jest.fn()}
        onOpenTerms={jest.fn()}
      />,
    );
    expect(screen.getByText('Đang tải danh sách đơn hàng...')).toBeOnTheScreen();
    expect(screen.queryByText(/0\/0/)).toBeNull();
    expect(screen.queryByText('0 đơn hàng')).toBeNull();
  });

  it('replaces quick-tab filter cleanly when choosing another status from FilterSheet (no hidden filter leak)', async () => {
    await render(
      <OrdersScreen
        onOpenNotifications={jest.fn()}
        onOpenOrderDetail={jest.fn()}
        onOpenPayment={jest.fn()}
        onOpenTerms={jest.fn()}
      />,
    );

    expect(await screen.findByText('ORD-003')).toBeOnTheScreen();

    // Step 1: Select quick tab "Chờ thanh toán"
    await act(async () => fireEvent.press(screen.getByRole('tab', { name: 'Chờ thanh toán' })));
    expect(screen.getByText('ORD-001')).toBeOnTheScreen();
    expect(screen.queryByText('ORD-003')).toBeNull();

    // Step 2: Open FilterSheet and choose "Đã hủy"
    await act(async () => fireEvent.press(screen.getByLabelText('Lọc thêm trạng thái đơn hàng')));
    await act(async () => fireEvent.press(await screen.findByRole('radio', { name: 'Đã hủy' })));

    // Cancelled order must appear (1/3), not 0/3 from hidden WAITING_PAYMENT condition.
    expect(screen.getByText('ORD-003')).toBeOnTheScreen();
    expect(screen.queryByText('ORD-001')).toBeNull();
    expect(screen.getByText('1/3 đơn · Đã hủy')).toBeOnTheScreen();

    // Step 3: Reset clears everything back to 3 orders.
    await act(async () => fireEvent.press(screen.getByText('Đặt lại')));
    expect(screen.getByText('3 đơn hàng')).toBeOnTheScreen();
    expect(screen.getByText('ORD-001')).toBeOnTheScreen();
    expect(screen.getByText('ORD-003')).toBeOnTheScreen();
  });

  it('cancels an eligible order via confirm dialog and refetches on 409 conflict', async () => {
    jest.mocked(getOrder).mockResolvedValueOnce(detailFixture).mockResolvedValueOnce({
      ...detailFixture,
      orderStatus: 'PAYMENT_ACCEPTED',
    });
    jest.mocked(cancelOrder).mockRejectedValueOnce(new MobileApiError(409, 'Conflict'));

    await render(
      <OrderDetailScreen
        navigation={{ navigate: jest.fn(), goBack: jest.fn() } as never}
        route={{ params: { id: 'o1' } }}
      />,
    );

    await act(async () => fireEvent.press(await screen.findByText('Hủy đơn hàng')));
    await act(async () => fireEvent.press(await screen.findByText('Hủy đơn')));

    await waitFor(() => expect(cancelOrder).toHaveBeenCalledWith('o1'));
    expect(
      await screen.findByText(
        'Trạng thái đơn hàng đã thay đổi. Đang cập nhật lại trạng thái mới nhất.',
      ),
    ).toBeOnTheScreen();
    expect(getOrder).toHaveBeenCalledTimes(2);
  });

  it('keeps existing orders visible and shows warning refreshError when pull-to-refresh fails', async () => {
    jest
      .mocked(listOrders)
      .mockResolvedValueOnce(ordersFixture)
      .mockRejectedValueOnce(new TypeError('Network request failed'));

    await render(
      <OrdersScreen
        onOpenNotifications={jest.fn()}
        onOpenOrderDetail={jest.fn()}
        onOpenPayment={jest.fn()}
        onOpenTerms={jest.fn()}
      />,
    );

    expect(await screen.findByText('ORD-001')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('orders-refresh-control'), 'refresh');

    expect(
      await screen.findByText('Không thể kết nối máy chủ. Kiểm tra kết nối mạng và thử lại.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('ORD-001')).toBeOnTheScreen();

    jest.mocked(listOrders).mockResolvedValueOnce(ordersFixture);
    await act(async () => fireEvent.press(screen.getByText('Thử lại')));
    await waitFor(() =>
      expect(
        screen.queryByText('Không thể kết nối máy chủ. Kiểm tra kết nối mạng và thử lại.'),
      ).toBeNull(),
    );
  });
});
