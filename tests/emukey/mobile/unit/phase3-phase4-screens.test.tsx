import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';

import { useConversationThread } from '../../../../EmuKey/mobile/src/application/assistance/useConversationThread';
import { usePaymentStatus } from '../../../../EmuKey/mobile/src/application/orders/usePaymentStatus';

import {
  CatalogScreen,
  CheckoutScreen,
  ComparePlansScreen,
  ConversationThreadScreen,
  OrderDetailScreen,
  PaymentGatewayScreen,
  PaymentScreen,
  ProfileScreen,
  RenewalScreen,
  matchesPaymentReturn,
} from '../../../../EmuKey/mobile/src/presentation/EmuKeyMobileApp';
import {
  acceptServiceTerms,
  askConversationAi,
  comparePlans,
  createCheckout,
  createConversation,
  createOrder,
  getConversation,
  getLicense,
  getOrder,
  getOrderTerms,
  getPaymentRetryDecision,
  getProfile,
  getRenewalPreview,
  listConversationMessages,
  listConversations,
  listNotifications,
  listPaymentHistory,
  listProducts,
  updateProfile,
  type MobileOrderDetail,
} from '../../../../EmuKey/mobile/src/infrastructure/api/client';

it('recognizes only the configured checkout return origin and exact order', () => {
  expect(
    matchesPaymentReturn(
      'https://shop.example/buyer/orders/o1/payment?sepay=success',
      'o1',
      'https://shop.example/buyer/orders/o1/payment?sepay=success',
    ),
  ).toBe(true);
  expect(
    matchesPaymentReturn(
      'https://evil.example/buyer/orders/o1/payment',
      'o1',
      'https://shop.example/buyer/orders/o1/payment',
    ),
  ).toBe(false);
  expect(matchesPaymentReturn('emukey://payment/o2', 'o1')).toBe(false);
});

jest.mock('../../../../EmuKey/mobile/src/infrastructure/api/client', () => ({
  askConversationAi: jest.fn(),
  getConversation: jest.fn(),
  listConversations: jest.fn(),
  listConversationMessages: jest.fn(),
  acceptServiceTerms: jest.fn(),
  cancelOrder: jest.fn(),
  closeConversation: jest.fn(),
  comparePlans: jest.fn(),
  createCheckout: jest.fn(),
  getPaymentRetryDecision: jest.fn(),
  getLicense: jest.fn(),
  createOrder: jest.fn(),
  createConversation: jest.fn(),
  getOrder: jest.fn(),
  getOrderTerms: jest.fn(),
  getRenewalPreview: jest.fn(),
  getProfile: jest.fn(),
  listNotifications: jest.fn(),
  listPaymentHistory: jest.fn(),
  listProducts: jest.fn(),
  requestConversationSupport: jest.fn(),
  sendConversationMessage: jest.fn(),
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
    jest.resetAllMocks();
    jest
      .mocked(getPaymentRetryDecision)
      .mockResolvedValue({ allowed: true, canResume: false, reason: 'READY' });
    jest.mocked(listPaymentHistory).mockResolvedValue([]);
    listNotificationsMock.mockResolvedValue([]);
  });

  it('keeps payment accepted when an older refresh finishes last', async () => {
    let resolveOldOrder!: (value: MobileOrderDetail) => void;
    let resolvePaidOrder!: (value: MobileOrderDetail) => void;
    let resolveNextOrder!: (value: MobileOrderDetail) => void;
    getOrderMock
      .mockReturnValueOnce(new Promise((resolve) => { resolveOldOrder = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolvePaidOrder = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveNextOrder = resolve; }));
    const hook = await renderHook(() => usePaymentStatus(order.id, false));
    await act(async () => {
      void hook.result.current.refresh();
      void hook.result.current.refresh();
    });

    const paidOrder = { ...order, orderStatus: 'PAYMENT_ACCEPTED' as const };
    await act(async () => { resolvePaidOrder(paidOrder); });
    expect(hook.result.current.order?.orderStatus).toBe('PAYMENT_ACCEPTED');

    await act(async () => { resolveOldOrder({ ...order, orderStatus: 'WAITING_PAYMENT' }); });
    expect(hook.result.current.order?.orderStatus).toBe('PAYMENT_ACCEPTED');
    expect(hook.result.current.decision).toBeNull();

    await act(async () => { resolveNextOrder(paidOrder); });
    await hook.unmount();
  });

  it('keeps newly received messages when an older poll finishes last', async () => {
    jest.useFakeTimers();
    const conversation = {
      id: 'thread-1', customerUserId: 'customer-1', assignedSupportUserId: null,
      status: 'WAITING_SUPPORT' as const, contextType: 'GENERAL', contextId: null, title: 'Hỗ trợ',
      version: 1,
    };
    const message = {
      id: 'first', conversationId: conversation.id, clientMessageId: 'first',
      senderType: 'CUSTOMER' as const, serverSequence: 1, content: 'Tin đầu',
    };
    let finishOlderPoll!: (messages: Awaited<ReturnType<typeof listConversationMessages>>) => void;
    jest.mocked(getConversation).mockResolvedValue(conversation);
    jest.mocked(listConversationMessages)
      .mockResolvedValueOnce([message])
      .mockReturnValueOnce(new Promise((resolve) => { finishOlderPoll = resolve; }))
      .mockResolvedValue([message, { ...message, id: 'new', clientMessageId: 'new', serverSequence: 2 }]);
    const hook = await renderHook(() => useConversationThread(conversation.id));
    try {
      await act(async () => {});
      await act(async () => { jest.advanceTimersByTime(5_000); });
      await act(async () => { jest.advanceTimersByTime(5_000); });
      expect(hook.result.current.messages).toHaveLength(2);
      await act(async () => { finishOlderPoll([message]); });
      expect(hook.result.current.messages.map(({ id }) => id)).toEqual(['first', 'new']);
    } finally {
      await hook.unmount();
      jest.useRealTimers();
    }
  });

  it('keeps order details available and retries a failed support request', async () => {
    getOrderMock.mockResolvedValue(order);
    jest
      .mocked(createConversation)
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce({ id: 'support-order' } as never);
    const navigate = jest.fn();
    await render(
      <OrderDetailScreen
        navigation={{ navigate, goBack: jest.fn() } as never}
        route={{ params: { id: order.id } } as never}
      />,
    );

    await act(async () => fireEvent.press(await screen.findByText('Cần hỗ trợ về đơn này')));
    expect(screen.getByText(order.orderNumber)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Cần hỗ trợ về đơn này')));
    expect(createConversation).toHaveBeenLastCalledWith(`Hỗ trợ đơn ${order.orderNumber}`, order.id);
    expect(navigate).toHaveBeenCalledWith('Assistance', { conversationId: 'support-order' });
  });

  it('clears previous conversation AI answers when opening another conversation', async () => {
    jest.mocked(getConversation).mockImplementation(async (id) => ({
      id,
      title: id === 'a' ? 'Order A' : 'Order B',
      status: 'AI_ACTIVE',
      contextType: 'ORDER',
    } as never));
    jest.mocked(listConversations).mockResolvedValue([
      { id: 'a', title: 'Order A', status: 'AI_ACTIVE', contextType: 'ORDER' },
      { id: 'b', title: 'Order B', status: 'AI_ACTIVE', contextType: 'ORDER' },
    ] as never);
    let answeredA = false;
    jest.mocked(listConversationMessages).mockImplementation(async (id) =>
      id === 'a' && answeredA
        ? [
            {
              id: 'm1',
              conversationId: 'a',
              senderType: 'AI',
              content: 'Answer for A',
              serverSequence: 1,
              createdAt: '2026-10-01T00:00:00Z',
            } as never,
          ]
        : [],
    );
    jest.mocked(askConversationAi).mockImplementation(async () => {
      answeredA = true;
      return {
        answer: 'Answer for A',
        grounded: false,
        citedSourceIds: [],
      };
    });

    const view = await render(
      <ConversationThreadScreen conversationId="a" onBack={jest.fn()} />,
    );
    await act(async () =>
      fireEvent.changeText(await screen.findByLabelText('Tin nhắn hỗ trợ'), 'Question'),
    );
    await act(async () => fireEvent.press(screen.getByText('Hỏi AI có nguồn')));
    expect(await screen.findByText('Answer for A')).toBeOnTheScreen();

    await view.rerender(
      <ConversationThreadScreen conversationId="b" onBack={jest.fn()} />,
    );
    await waitFor(() => expect(listConversationMessages).toHaveBeenLastCalledWith('b'));
    expect(screen.queryByText('Answer for A')).toBeNull();
  });

  it('renders the published catalog and navigates to ProductDetail', async () => {
    listProductsMock.mockResolvedValue([
      {
        id: 'product-1',
        providerId: 'provider-1',
        providerDisplayName: 'Provider 1',
        code: 'DESKTOP',
        name: 'Emukey Desktop',
        plans: [
          {
            billingCycle: 'YEARLY',
            code: 'PRO',
            durationMonths: 12,
            entitlements: {},
            id: 'plan-1',
            maxActiveDevices: 2,
            name: 'Pro',
            priceVnd: 990_000,
          },
        ],
        slug: 'emukey-desktop',
        summary: 'Bản quyền desktop',
      },
    ]);
    const onOpenProduct = jest.fn();
    await render(
      <CatalogScreen onOpenCompare={jest.fn()} onOpenProduct={onOpenProduct} />,
    );

    expect(await screen.findByText('Emukey Desktop')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Xem chi tiết')));
    expect(onOpenProduct).toHaveBeenCalledWith('product-1');
  });

  it('loads and updates the Customer profile', async () => {
    const profile = {
      id: 'customer-1',
      email: 'buyer@emukey.app',
      displayName: 'Buyer',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    };
    getProfileMock.mockResolvedValue(profile);
    updateProfileMock.mockResolvedValue({ ...profile, displayName: 'Buyer Updated' });
    const onProfileUpdated = jest.fn();
    const Stack = createNativeStackNavigator();
    await render(
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Profile">
            {() => <ProfileScreen onProfileUpdated={onProfileUpdated} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>,
    );

    await act(async () =>
      fireEvent.changeText(await screen.findByLabelText('Tên hiển thị'), 'Buyer Updated'),
    );
    await act(async () => fireEvent.press(screen.getByText('Lưu thay đổi')));
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({ displayName: 'Buyer Updated' }),
    );
    expect(onProfileUpdated).toHaveBeenCalled();
  });

  it('creates a server order before showing the Terms acceptance step', async () => {
    createOrderMock.mockResolvedValue(order);
    getOrderTermsMock.mockResolvedValue({
      content: 'Điều khoản dịch vụ',
      version: 'v1',
      hash: 'a'.repeat(64),
    });
    acceptServiceTermsMock.mockResolvedValue({ ...order, orderStatus: 'WAITING_PAYMENT' });
    const navigation = { replace: jest.fn() };
    const route = {
      params: { planId: 'plan-1', planName: 'Pro', priceVnd: 990_000, productName: 'Emukey Desktop' },
    };
    await render(<CheckoutScreen navigation={navigation as never} route={route as never} />);

    await act(async () => fireEvent.press(screen.getByText('Tiếp tục')));
    expect(await screen.findByRole('header', { name: 'Điều khoản dịch vụ' })).toBeOnTheScreen();
    expect(createOrderMock).toHaveBeenCalledWith({ planId: 'plan-1' });
  });

  it('blocks accepting terms when loading fails and retries the same order', async () => {
    createOrderMock.mockResolvedValue(order);
    getOrderTermsMock
      .mockRejectedValueOnce(new Error('terms unavailable'))
      .mockResolvedValueOnce({
        content: 'Điều khoản dịch vụ',
        version: 'v1',
        hash: 'a'.repeat(64),
      });
    const navigation = { replace: jest.fn() };
    const route = {
      params: { planId: 'plan-1', planName: 'Pro', priceVnd: 990_000, productName: 'Emukey Desktop' },
    };
    await render(<CheckoutScreen navigation={navigation as never} route={route as never} />);
    await act(async () => fireEvent.press(screen.getByText('Tiếp tục')));
    expect(await screen.findByText('Chưa tải được điều khoản dịch vụ.')).toBeOnTheScreen();
    expect(screen.getByText('Tiếp tục thanh toán')).toBeDisabled();
    await act(async () => fireEvent.press(screen.getByText('Tải lại điều khoản')));
    expect(await screen.findByRole('header', { name: 'Điều khoản dịch vụ' })).toBeOnTheScreen();
    expect(getOrderTermsMock).toHaveBeenLastCalledWith(order.id);
    expect(createOrderMock).toHaveBeenCalledTimes(1);
  });

  it('blocks renewal consent after terms failure and retries the existing order', async () => {
    getOrderMock.mockResolvedValue(order);
    jest.mocked(getRenewalPreview).mockResolvedValue({
      licenseId: 'license-1',
      planId: 'plan-1',
      planName: 'Pro',
      productName: 'Desktop',
      durationMonths: 12,
      priceVnd: 990_000,
      currentExpiresAt: '2027-01-01',
      estimatedExpiresAt: '2028-01-01',
      canRenew: true,
      pendingOrder: null,
    });
    createOrderMock.mockResolvedValue({ ...order, priceVndSnapshot: 1_200_000 });
    const terms = { content: 'Điều khoản gia hạn đã tải', version: 'v2', hash: 'b'.repeat(64) };
    getOrderTermsMock.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce(terms);
    acceptServiceTermsMock.mockResolvedValue({ ...order, orderStatus: 'WAITING_PAYMENT' });

    await render(
      <RenewalScreen
        navigation={{ replace: jest.fn(), goBack: jest.fn() } as never}
        route={{ params: { originOrderId: order.id, licenseId: 'license-1', productName: 'Desktop' } } as never}
      />,
    );
    await waitFor(() => expect(screen.getByText('Tạo đơn gia hạn')).not.toBeDisabled());
    await act(async () => fireEvent.press(screen.getByText('Tạo đơn gia hạn')));
    expect(screen.getByText('Tiếp tục thanh toán')).toBeDisabled();
    expect(screen.queryByRole('checkbox')).toBeNull();
    await act(async () => fireEvent.press(screen.getByText('Tải lại điều khoản')));
    expect(await screen.findByText(terms.content)).toBeOnTheScreen();
    expect(screen.getByText('1.200.000 ₫')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('checkbox')));
    await act(async () => fireEvent.press(screen.getByText('Tiếp tục thanh toán')));
    expect(acceptServiceTermsMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: order.id }),
      terms,
    );
    expect(createOrderMock).toHaveBeenCalledTimes(1);
  });

  it('uses the server order snapshot price instead of the route quote', async () => {
    createOrderMock.mockResolvedValue({ ...order, priceVndSnapshot: 1_200_000 });
    getOrderTermsMock.mockResolvedValue({
      content: 'Điều khoản dịch vụ',
      version: 'v1',
      hash: 'a'.repeat(64),
    });
    const navigation = { replace: jest.fn() };
    const route = {
      params: { planId: 'plan-1', planName: 'Pro', priceVnd: 990_000, productName: 'Emukey Desktop' },
    };
    await render(<CheckoutScreen navigation={navigation as never} route={route as never} />);
    await act(async () => fireEvent.press(screen.getByText('Tiếp tục')));
    expect(await screen.findByText('1.200.000 ₫')).toBeOnTheScreen();
    expect(screen.getByText(/Tổng thanh toán đã cập nhật theo đơn hàng/)).toBeOnTheScreen();
  });

  it.each([
    ['PENDING_ONCHAIN', 'PENDING_FINALITY', null, 'Đang xác nhận blockchain'],
    ['ACTIVE', 'TRUSTED', 'PENDING', 'Đang bàn giao cho nhà cung cấp'],
    ['ACTIVE', 'TRUSTED', 'DELIVERED', 'Nhà cung cấp đã nhận bản quyền'],
    ['ACTIVE', 'TRUSTED', 'FAILED', 'Bàn giao bản quyền cần xử lý. Không thanh toán lại.'],
    ['SUSPENDED', 'TRUSTED', 'DELIVERED', 'Bản quyền tạm ngưng'],
    ['EXPIRED', 'TRUSTED', 'DELIVERED', 'Bản quyền đã hết hạn'],
  ])('shows provider-managed payment progress for %s/%s/%s', async (status, trust, delivery, label) => {
    getOrderMock.mockResolvedValue({
      ...order,
      orderStatus: 'PAYMENT_ACCEPTED',
      licenseId: 'license-progress',
    });
    jest.mocked(getLicense).mockResolvedValue({
      id: 'license-progress',
      fulfillmentMode: 'PROVIDER_HANDOFF',
      status,
      activationKeyTrustStatus: trust,
      finality: status === 'PENDING_ONCHAIN' ? 'PENDING_FINALITY' : 'CHAIN_CONFIRMED',
      providerDeliveryStatus: delivery,
      activationKeyAvailable: true,
      expiresAt: '2030-01-01T00:00:00Z',
    } as never);
    await render(
      <PaymentScreen
        navigation={{ navigate: jest.fn(), goBack: jest.fn() } as never}
        route={{ params: { orderId: order.id } } as never}
      />,
    );
    expect(await screen.findByText(label)).toBeOnTheScreen();
    expect(screen.queryByText('Thanh toán trên SePay')).toBeNull();
    expect(
      screen.queryByText('Đã nhận thanh toán. Hệ thống đang chờ xác nhận bản quyền; không thanh toán lại.'),
    ).toBeNull();
    if (status !== 'ACTIVE' || delivery !== 'DELIVERED') {
      expect(screen.queryByText('Mở danh sách bản quyền để nhận mã hoặc xem mã đã lưu.')).toBeNull();
    }
  });

  it('waits instead of paying again when the previous attempt is uncertain', async () => {
    getOrderMock.mockResolvedValue({ ...order, orderStatus: 'WAITING_PAYMENT' });
    jest
      .mocked(getPaymentRetryDecision)
      .mockResolvedValue({ allowed: false, canResume: false, reason: 'ATTEMPT_PENDING' });
    await render(
      <PaymentScreen
        navigation={{ navigate: jest.fn(), goBack: jest.fn() } as never}
        route={{ params: { orderId: order.id } } as never}
      />,
    );
    expect(
      await screen.findByText('Đang chờ xác nhận hoặc đối soát thanh toán. Không chuyển tiền thêm.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Thanh toán trên SePay')).toBeNull();
    expect(createCheckoutMock).not.toHaveBeenCalled();
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
        navigation={{ goBack: jest.fn() } as never}
        route={{ params: { orderId: order.id } } as never}
      />,
    );

    await act(async () => fireEvent.press(await screen.findByText('Thanh toán trên SePay')));
    const webView = await screen.findByTestId('payment-webview');
    expect((webView.props.source as { html: string }).html).toContain(
      'name="signature" value="signed-value"',
    );
    await result.unmount();
  });

  it('offers a direct purchase CTA from every compared plan, hides false entitlements, and enforces the 4-plan limit', async () => {
    listProductsMock.mockResolvedValue([
      {
        id: 'product-1',
        providerId: 'provider-1',
        providerDisplayName: 'Provider 1',
        code: 'DESKTOP',
        name: 'Emukey Desktop',
        slug: 'emukey-desktop',
        summary: 'Bản quyền desktop',
        plans: [
          { id: 'plan-1', name: 'Pro', code: 'PRO', billingCycle: 'YEARLY', durationMonths: 12, maxActiveDevices: 2, priceVnd: 990_000, entitlements: {} },
          { id: 'plan-2', name: 'Ultra', code: 'ULTRA', billingCycle: 'YEARLY', durationMonths: 12, maxActiveDevices: 25, priceVnd: 1_990_000, entitlements: {} },
          { id: 'plan-3', name: 'Team', code: 'TEAM', billingCycle: 'YEARLY', durationMonths: 12, maxActiveDevices: 50, priceVnd: 2_990_000, entitlements: {} },
          { id: 'plan-4', name: 'Max', code: 'MAX', billingCycle: 'YEARLY', durationMonths: 12, maxActiveDevices: 100, priceVnd: 3_990_000, entitlements: {} },
          { id: 'plan-5', name: 'Extra', code: 'EXT', billingCycle: 'YEARLY', durationMonths: 12, maxActiveDevices: 200, priceVnd: 4_990_000, entitlements: {} },
        ],
      },
    ]);
    comparePlansMock.mockResolvedValue({
      dimensions: [
        { key: 'priceVnd', label: 'Giá', values: { 'plan-1': 990_000, 'plan-2': 1_990_000 } },
        { key: 'maxActiveDevices', label: 'Thiết bị', values: { 'plan-1': 2, 'plan-2': 25 } },
        {
          key: 'entitlements',
          label: 'Quyền lợi',
          values: {
            'plan-1': { offline: true, priority: false },
            'plan-2': { offline: true, priority: true },
          },
        },
      ],
      plans: [
        { billingCycle: 'YEARLY', id: 'plan-1', name: 'Pro', productId: 'product-1', productName: 'Emukey Desktop', version: 1 },
        { billingCycle: 'YEARLY', id: 'plan-2', name: 'Ultra', productId: 'product-1', productName: 'Emukey Desktop', version: 1 },
      ],
    });
    const onSelectPlanForPurchase = jest.fn();
    await render(
      <ComparePlansScreen
        initialIds={['plan-1', 'plan-2']}
        onBack={jest.fn()}
        onSelectPlanForPurchase={onSelectPlanForPurchase}
      />,
    );

    expect((await screen.findAllByText(/Ultra \(v1\)/)).length).toBeGreaterThan(0);
    expect(screen.queryByText('false')).toBeNull();
    expect(screen.getByText(/priority: Không/)).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByText('Chọn gói Ultra')));
    expect(onSelectPlanForPurchase).toHaveBeenCalledWith('product-1', 'plan-2');
  });

  it('filters the catalog and supports clearing empty filter', async () => {
    listProductsMock.mockResolvedValue([
      {
        id: 'product-1',
        providerId: 'provider-1',
        providerDisplayName: 'Provider 1',
        code: 'DESKTOP',
        name: 'Emukey Desktop',
        plans: [
          { billingCycle: 'YEARLY', code: 'PRO', durationMonths: 12, entitlements: {}, id: 'plan-1', maxActiveDevices: 2, name: 'Pro', priceVnd: 990_000 },
        ],
        slug: 'emukey-desktop',
        summary: 'Bản quyền desktop',
      },
      {
        id: 'product-2',
        providerId: 'provider-1',
        providerDisplayName: 'Provider 1',
        code: 'MOBILE',
        name: 'Emukey Mobile',
        plans: [
          { billingCycle: 'YEARLY', code: 'MOB', durationMonths: 12, entitlements: {}, id: 'plan-2', maxActiveDevices: 1, name: 'Mobile', priceVnd: 490_000 },
        ],
        slug: 'emukey-mobile',
        summary: 'Bản quyền di động',
      },
    ]);
    await render(
      <CatalogScreen onOpenCompare={jest.fn()} onOpenProduct={jest.fn()} />,
    );

    await screen.findByText('Emukey Mobile');
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Tìm sản phẩm hoặc gói'), 'desktop'),
    );
    await waitFor(() => expect(screen.queryByText('Emukey Mobile')).toBeNull());
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Tìm sản phẩm hoặc gói'), 'không tồn tại'),
    );
    expect(await screen.findByText('Không tìm thấy sản phẩm hoặc gói phù hợp.')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Xóa bộ lọc')));
    expect(await screen.findByText('Emukey Mobile')).toBeOnTheScreen();
  });

  it('surfaces origin-order failure with retry on RenewalScreen instead of silently locking renewal', async () => {
    jest.mocked(getRenewalPreview).mockResolvedValue({
      licenseId: 'license-1',
      planId: 'plan-1',
      planName: 'Pro',
      productName: 'Desktop',
      durationMonths: 12,
      priceVnd: 990_000,
      currentExpiresAt: '2027-01-01',
      estimatedExpiresAt: '2028-01-01',
      canRenew: true,
      pendingOrder: null,
    });
    getOrderMock.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(order);

    await render(
      <RenewalScreen
        navigation={{ replace: jest.fn(), goBack: jest.fn() } as never}
        route={{ params: { originOrderId: order.id, licenseId: 'license-1', productName: 'Desktop' } } as never}
      />,
    );

    expect(await screen.findByText('Chưa đối chiếu được đơn hàng gốc')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tạo đơn gia hạn' })).toBeDisabled();

    await act(async () => fireEvent.press(screen.getByText('Thử lại')));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tạo đơn gia hạn' })).not.toBeDisabled(),
    );
    expect(screen.queryByText('Chưa đối chiếu được đơn hàng gốc')).toBeNull();
  });

  it('surfaces preview reload error and blocks renewal start when stale preview exists after retry failure', async () => {
    jest
      .mocked(getRenewalPreview)
      .mockResolvedValueOnce({
        canRenew: true,
        currentExpiresAt: '2026-12-01T00:00:00Z',
        durationMonths: 12,
        estimatedExpiresAt: '2027-12-01T00:00:00Z',
        licenseId: 'lic-1',
        pendingOrder: null,
        planId: 'plan-1',
        planName: 'Pro',
        priceVnd: 990_000,
        productName: 'Emukey Desktop',
      })
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({
        canRenew: true,
        currentExpiresAt: '2026-12-01T00:00:00Z',
        durationMonths: 12,
        estimatedExpiresAt: '2027-12-01T00:00:00Z',
        licenseId: 'lic-1',
        pendingOrder: null,
        planId: 'plan-1',
        planName: 'Pro',
        priceVnd: 990_000,
        productName: 'Emukey Desktop',
      });
    getOrderMock
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce(order);

    await render(
      <RenewalScreen
        navigation={{ replace: jest.fn(), goBack: jest.fn() }}
        route={{ params: { licenseId: 'lic-1', originOrderId: 'order-1' } }}
      />,
    );

    expect(await screen.findByText('Chưa đối chiếu được đơn hàng gốc')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tạo đơn gia hạn' })).toBeDisabled();

    // Retry: sourceOrder succeeds, preview fails -> stale preview stays visible, but error notice appears and button stays disabled!
    await act(async () => fireEvent.press(screen.getByText('Thử lại')));
    expect(await screen.findByText('Không thể làm mới thông tin gia hạn')).toBeOnTheScreen();
    expect(screen.queryByText('Chưa đối chiếu được đơn hàng gốc')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tạo đơn gia hạn' })).toBeDisabled();

    // Second retry: both succeed -> error clears and button enables.
    await act(async () => fireEvent.press(screen.getByText('Thử lại')));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tạo đơn gia hạn' })).not.toBeDisabled(),
    );
    expect(screen.queryByText('Không thể làm mới thông tin gia hạn')).toBeNull();
  });

  it('shows WebView load/HTTP errors safely on PaymentGatewayScreen and allows reloading the existing checkout', async () => {
    const onBack = jest.fn();
    await render(
      <PaymentGatewayScreen
        checkout={{
          amountVnd: 990_000,
          attemptId: 'att-1',
          checkoutFields: { signature: 'sig' },
          checkoutMethod: 'POST',
          checkoutReference: 'REF-1',
          checkoutUrl: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
          expiresAt: '2026-12-01T00:00:00Z',
          expiresWithOrder: true,
        }}
        onBack={onBack}
        onShouldStartLoadUrl={() => false}
      />,
    );

    const webView = screen.getByTestId('payment-webview');
    await act(async () => {
      webView.props.onHttpError?.({ nativeEvent: { statusCode: 502 } });
    });

    expect(await screen.findByText('Chưa tải được trang cổng thanh toán')).toBeOnTheScreen();
    expect(
      screen.getByText(/Lỗi hiển thị trang không đồng nghĩa thanh toán thất bại/),
    ).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByText('Tải lại trang thanh toán')));
    expect(screen.getByTestId('payment-webview')).toBeOnTheScreen();
  });

  it('shows catalog error and retry on ComparePlansScreen when plans fail to load', async () => {
    listProductsMock
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce([
        {
          id: 'product-1',
          providerId: 'provider-1',
          providerDisplayName: 'Provider 1',
          code: 'DESKTOP',
          name: 'Emukey Desktop',
          slug: 'emukey-desktop',
          summary: 'Bản quyền desktop',
          plans: [
            { id: 'plan-1', name: 'Pro', code: 'PRO', billingCycle: 'YEARLY', durationMonths: 12, maxActiveDevices: 2, priceVnd: 990_000, entitlements: {} },
          ],
        },
      ]);

    await render(
      <ComparePlansScreen
        initialIds={[]}
        onBack={jest.fn()}
        onSelectPlanForPurchase={jest.fn()}
      />,
    );

    expect((await screen.findAllByText('Không thể tải danh mục sản phẩm.')).length).toBeGreaterThan(0);
    await act(async () => fireEvent.press(screen.getAllByText('Thử lại')[0]));
    expect(await screen.findByText('Gói Pro')).toBeOnTheScreen();
  });
});
