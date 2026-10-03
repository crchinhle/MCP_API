import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  CatalogScreen,
  CheckoutScreen,
  ComparePlansScreen,
  PaymentScreen,
  ProfileScreen,
  RenewalScreen,
} from '../../../../EmuKey/mobile/src/presentation/EmuKeyMobileApp';
import {
  acceptServiceTerms,
  comparePlans,
  createOrder,
  createCheckout,
getOrder,
  getOrderTerms,
  getRenewalPreview,
  getProfile,
  listNotifications,
  listProducts,
  updateProfile,
  type MobileOrderDetail,
} from '../../../../EmuKey/mobile/src/infrastructure/api/client';

jest.mock('../../../../EmuKey/mobile/src/infrastructure/api/client', () => ({
  acceptServiceTerms: jest.fn(),
  closeConversation: jest.fn(),
  comparePlans: jest.fn(),
  createCheckout: jest.fn(),
  createOrder: jest.fn(),
  getOrder: jest.fn(),
  getOrderTerms: jest.fn(),
  getRenewalPreview: jest.fn(),
  getProfile: jest.fn(),
  listNotifications: jest.fn(),
  listProducts: jest.fn(),
  updateProfile: jest.fn(),
}));

const listProductsMock = listProducts as jest.MockedFunction<typeof listProducts>;
const listNotificationsMock = listNotifications as jest.MockedFunction<typeof listNotifications>;
const getProfileMock = getProfile as jest.MockedFunction<typeof getProfile>;
const updateProfileMock = updateProfile as jest.MockedFunction<typeof updateProfile>;
const createOrderMock = createOrder as jest.MockedFunction<typeof createOrder>;
const comparePlansMock = comparePlans as jest.MockedFunction<typeof comparePlans>;
const createCheckoutMock = createCheckout as jest.MockedFunction<typeof createCheckout>;
const getOrderMock = getOrder as jest.MockedFunction<typeof getOrder>;
const getOrderTermsMock = getOrderTerms as jest.MockedFunction<typeof getOrderTerms>;
const acceptServiceTermsMock = acceptServiceTerms as jest.MockedFunction<typeof acceptServiceTerms>;

const order: MobileOrderDetail = {
  billingCycleSnapshot: 'YEARLY',
  createdAt: '2026-09-15T00:00:00.000Z',
  currency: 'VND',
  customerUserId: 'customer-1',
  durationMonthsSnapshot: 12,
  entitlementsSnapshot: {},
  id: 'order-1',
  maxActiveDevicesSnapshot: 2,
  orderNumber: 'ORD-MOBILE-1',
  orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE',
  orderType: 'NEW_PURCHASE',
  paymentDueAt: '2026-09-16T00:00:00.000Z',
  planCommitmentSnapshot: `0x${'11'.repeat(32)}`,
  planId: 'plan-1',
  planNameSnapshot: 'Pro',
  planVersionSnapshot: 1,
  priceVndSnapshot: 990_000,
  productId: 'product-1',
  productNameSnapshot: 'Emukey Desktop',
  providerNameSnapshot: 'Emukey',
  providerUserId: 'provider-1',
};

describe('mobile Phase 3 and Phase 4 screens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listNotificationsMock.mockResolvedValue([]);
  });

  it('renders the published catalog and opens checkout with the selected plan', async () => {
    listProductsMock.mockResolvedValue([
      {
        name: 'Emukey Desktop',
        plans: [{
          billingCycle: 'YEARLY',
          code: 'PRO',
          durationMonths: 12,
          entitlements: {},
          id: 'plan-1',
          maxActiveDevices: 2,
          name: 'Pro',
          priceVnd: 990_000,
        }],
        slug: 'emukey-desktop',
        summary: 'Bản quyền desktop',
      },
    ]);
    const navigate = jest.fn();
    await render(<CatalogScreen navigation={{ navigate } as never} route={{} as never} />);

    expect(await screen.findByText('Emukey Desktop')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Mua')));
    expect(navigate).toHaveBeenCalledWith('Checkout', expect.objectContaining({ planId: 'plan-1' }));
  });

  it('loads and updates the Customer profile', async () => {
    const profile = { id: 'customer-1', email: 'buyer@emukey.app', displayName: 'Buyer', role: 'CUSTOMER', status: 'ACTIVE' };
    getProfileMock.mockResolvedValue(profile);
    updateProfileMock.mockResolvedValue({ ...profile, displayName: 'Buyer Updated' });
    const onProfileUpdated = jest.fn();
    await render(<ProfileScreen onProfileUpdated={onProfileUpdated} />);

    await act(async () => fireEvent.changeText(await screen.findByLabelText('Tên hiển thị'), 'Buyer Updated'));
    await act(async () => fireEvent.press(screen.getByText('Lưu thay đổi')));
    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledWith({ displayName: 'Buyer Updated' }));
    expect(onProfileUpdated).toHaveBeenCalled();
  });

  it('creates a server order before showing the Terms acceptance step', async () => {
    createOrderMock.mockResolvedValue(order);
    getOrderTermsMock.mockResolvedValue({ content: 'Điều khoản dịch vụ', version: 'v1', hash: 'a'.repeat(64) });
    acceptServiceTermsMock.mockResolvedValue({ ...order, orderStatus: 'WAITING_PAYMENT' });
    const navigation = { replace: jest.fn() };
    const route = { params: { planId: 'plan-1', planName: 'Pro', priceVnd: 990_000, productName: 'Emukey Desktop' } };
    await render(<CheckoutScreen navigation={navigation as never} route={route as never} />);

    await act(async () => fireEvent.press(screen.getByText('Tạo đơn hàng')));
    expect(await screen.findByText('Điều khoản dịch vụ')).toBeOnTheScreen();
    expect(createOrderMock).toHaveBeenCalledWith({ planId: 'plan-1' });
  });

  it('blocks accepting terms when loading fails and retries the same order', async () => {
    createOrderMock.mockResolvedValue(order);
    getOrderTermsMock.mockRejectedValueOnce(new Error('terms unavailable')).mockResolvedValueOnce({ content: 'Điều khoản dịch vụ', version: 'v1', hash: 'a'.repeat(64) });
    const navigation = { replace: jest.fn() };
    const route = { params: { planId: 'plan-1', planName: 'Pro', priceVnd: 990_000, productName: 'Emukey Desktop' } };
    await render(<CheckoutScreen navigation={navigation as never} route={route as never} />);
    await act(async () => fireEvent.press(screen.getByText('Tạo đơn hàng')));
    expect(await screen.findByText('Chưa tải được điều khoản cấp phép.')).toBeOnTheScreen();
    expect(screen.getByText('Tiếp tục thanh toán')).toBeDisabled();
    await act(async () => fireEvent.press(screen.getByText('Tải lại điều khoản')));
    expect(await screen.findByText('Điều khoản dịch vụ')).toBeOnTheScreen();
    expect(getOrderTermsMock).toHaveBeenLastCalledWith(order.id);
    expect(createOrderMock).toHaveBeenCalledTimes(1);
  });

  it('blocks renewal consent after terms failure and retries the existing order', async () => {
    getOrderMock.mockResolvedValue(order);
    jest.mocked(getRenewalPreview).mockResolvedValue({ licenseId: 'license-1', planId: 'plan-1', planName: 'Pro', productName: 'Desktop', durationMonths: 12, priceVnd: 990_000, currentExpiresAt: '2027-01-01', estimatedExpiresAt: '2028-01-01', canRenew: true, pendingOrder: null });
    createOrderMock.mockResolvedValue({ ...order, priceVndSnapshot: 1_200_000 });
    const terms = { content: 'Điều khoản gia hạn đã tải', version: 'v2', hash: 'b'.repeat(64) };
    getOrderTermsMock.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(terms);
    acceptServiceTermsMock.mockResolvedValue({ ...order, orderStatus: 'WAITING_PAYMENT' });
    await render(<RenewalScreen navigation={{ replace: jest.fn() } as never} route={{ params: { originOrderId: order.id, licenseId: 'license-1', productName: 'Desktop' } } as never} />);
    await waitFor(() => expect(screen.getByText('Tạo đơn gia hạn')).not.toBeDisabled());
    await act(async () => fireEvent.press(screen.getByText('Tạo đơn gia hạn')));
    expect(screen.getByText('Tiếp tục thanh toán')).toBeDisabled();
    expect(screen.queryByRole('checkbox')).toBeNull();
    await act(async () => fireEvent.press(screen.getByText('Tải lại điều khoản')));
    expect(await screen.findByText(terms.content)).toBeOnTheScreen();
    expect(screen.getByText('1.200.000 ₫')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('checkbox')));
    await act(async () => fireEvent.press(screen.getByText('Tiếp tục thanh toán')));
    expect(acceptServiceTermsMock).toHaveBeenCalledWith(expect.objectContaining({ id: order.id }), terms);
    expect(createOrderMock).toHaveBeenCalledTimes(1);
  });

  it('uses the server order snapshot price instead of the route quote', async () => {
    createOrderMock.mockResolvedValue({ ...order, priceVndSnapshot: 1_200_000 });
    getOrderTermsMock.mockResolvedValue({ content: 'Điều khoản dịch vụ', version: 'v1', hash: 'a'.repeat(64) });
    const navigation = { replace: jest.fn() };
    const route = { params: { planId: 'plan-1', planName: 'Pro', priceVnd: 990_000, productName: 'Emukey Desktop' } };
    await render(<CheckoutScreen navigation={navigation as never} route={route as never} />);
    await act(async () => fireEvent.press(screen.getByText('Tạo đơn hàng')));
    expect(await screen.findByText('1.200.000 ₫')).toBeOnTheScreen();
    expect(screen.getByText(/Giá server đã thay đổi/)).toBeOnTheScreen();
  });

  it('renders the signed SePay POST fields inside the native checkout WebView', async () => {
    getOrderMock.mockResolvedValue({ ...order, orderStatus: 'WAITING_PAYMENT' });
    createCheckoutMock.mockResolvedValue({
      amountVnd: order.priceVndSnapshot,
      attemptId: 'attempt-1',
      checkoutFields: { order_invoice_number: 'EMU-MOBILE-1', signature: 'signed-value' },
      checkoutMethod: 'POST',
      checkoutReference: 'EMU-MOBILE-1',
      checkoutUrl: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
      expiresAt: order.paymentDueAt,
      expiresWithOrder: true,
    });
    const result = await render(
      <PaymentScreen
        navigation={{} as never}
        route={{ params: { orderId: order.id } } as never}
      />,
    );

    await act(async () => fireEvent.press(await screen.findByText('Thanh toán trên SePay')));
    const webView = await screen.findByTestId('payment-webview');
    expect((webView.props.source as { html: string }).html).toContain('name="signature" value="signed-value"');
    await result.unmount();
  });

  it('offers a direct purchase CTA from every compared plan and hides false entitlements', async () => {
    comparePlansMock.mockResolvedValue({
      dimensions: [
        { key: 'priceVnd', label: 'Giá', values: { 'plan-1': 990_000, 'plan-2': 1_990_000 } },
        { key: 'maxActiveDevices', label: 'Thiết bị', values: { 'plan-1': 2, 'plan-2': 25 } },
        { key: 'entitlements', label: 'Quyền lợi', values: { 'plan-1': { offline: true, priority: false }, 'plan-2': { offline: true, priority: true } } },
      ],
      plans: [
        { billingCycle: 'YEARLY', id: 'plan-1', name: 'Pro', productId: 'product-1', productName: 'Emukey Desktop', version: 1 },
        { billingCycle: 'YEARLY', id: 'plan-2', name: 'Ultra', productId: 'product-1', productName: 'Emukey Desktop', version: 1 },
      ],
    });
    const navigate = jest.fn();
    await render(<ComparePlansScreen navigation={{ navigate } as never} route={{ params: { ids: ['plan-1', 'plan-2'] } } as never} />);

    expect(screen.getByText(/Ultra/)).toBeOnTheScreen();
    expect(screen.getAllByText('Mua gói này')).toHaveLength(2);
    expect(screen.queryByText('false')).toBeNull();
    expect(screen.getByText(/priority: Không/)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getAllByText('Mua gói này')[1]));
    expect(navigate).toHaveBeenCalledWith('Checkout', expect.objectContaining({ planId: 'plan-2', priceVnd: 1_990_000 }));
  });

  it('filters the catalog and explains the four-plan comparison limit', async () => {
    listProductsMock.mockResolvedValue([
      {
        name: 'Emukey Desktop',
        plans: [{ billingCycle: 'YEARLY', code: 'PRO', durationMonths: 12, entitlements: {}, id: 'plan-1', maxActiveDevices: 2, name: 'Pro', priceVnd: 990_000 }],
        slug: 'emukey-desktop',
        summary: 'Bản quyền desktop',
      },
      {
        name: 'Emukey Mobile',
        plans: [{ billingCycle: 'YEARLY', code: 'MOB', durationMonths: 12, entitlements: {}, id: 'plan-2', maxActiveDevices: 1, name: 'Mobile', priceVnd: 490_000 }],
        slug: 'emukey-mobile',
        summary: 'Bản quyền di động',
      },
    ]);
    const navigate = jest.fn();
    await render(<CatalogScreen navigation={{ navigate } as never} route={{} as never} />);

    await screen.findByText('Emukey Mobile');
    await act(async () => fireEvent.changeText(screen.getByLabelText('Tìm sản phẩm hoặc gói'), 'desktop'));
    await waitFor(() => expect(screen.queryByText('Emukey Mobile')).toBeNull());
    await act(async () => fireEvent.changeText(screen.getByLabelText('Tìm sản phẩm hoặc gói'), 'không tồn tại'));
    expect(await screen.findByText('Không tìm thấy sản phẩm hoặc gói phù hợp.')).toBeOnTheScreen();
    await act(async () => fireEvent.changeText(screen.getByLabelText('Tìm sản phẩm hoặc gói'), ''));
    const toggles = await screen.findAllByLabelText(/ - So sánh$/);
    for (const toggle of toggles.slice(0, 2)) await act(async () => fireEvent.press(toggle));
    expect(screen.getAllByLabelText(/ - So sánh$/)).toHaveLength(2);
  });
});
