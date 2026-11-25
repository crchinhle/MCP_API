import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { CustomerSessionProvider } from '../../../../EmuKey/mobile/src/application/auth/useCustomerSession';
import { CartProvider, useCart } from '../../../../EmuKey/mobile/src/application/cart/cartContext';
import { cartReducer, initialCartState } from '../../../../EmuKey/mobile/src/application/cart/cartReducer';
import { useCheckoutOrder } from '../../../../EmuKey/mobile/src/application/orders/useCheckout';
import { selectBuyerHomeMetrics } from '../../../../EmuKey/mobile/src/application/home/homeSelectors';
import { AppButton } from '../../../../EmuKey/mobile/src/presentation/components/ui/AppButton';
import { AppText } from '../../../../EmuKey/mobile/src/presentation/components/ui/AppText';
import { CheckoutReviewScreen } from '../../../../EmuKey/mobile/src/presentation/screens/commerce/CheckoutReviewScreen';
import { PurchaseConfigurationScreen } from '../../../../EmuKey/mobile/src/presentation/screens/commerce/PurchaseConfigurationScreen';
import { ServiceTermsScreen } from '../../../../EmuKey/mobile/src/presentation/screens/commerce/ServiceTermsScreen';
import { HomeScreen } from '../../../../EmuKey/mobile/src/presentation/screens/home/HomeScreen';
import {
  MobileApiError,
  acceptServiceTerms,
  createOrder,
  getOrder,
  getOrderTerms,
  listProducts,
  listLicenses,
  listOrders,
  restoreSession,
  subscribeSession,
  type MobileProduct,
} from '../../../../EmuKey/mobile/src/infrastructure/api/client';
import { clearCheckoutIntent, readCheckoutIntent, writeCheckoutIntent } from '../../../../EmuKey/mobile/src/infrastructure/checkout-intent';

jest.mock('../../../../EmuKey/mobile/src/infrastructure/api/client', () => {
  const actual = jest.requireActual<
    typeof import('../../../../EmuKey/mobile/src/infrastructure/api/client')
  >('../../../../EmuKey/mobile/src/infrastructure/api/client');
  return {
    MobileApiError: actual.MobileApiError,
    subscribeSession: jest.fn(() => () => {}),
    restoreSession: jest.fn().mockResolvedValue(null),
    logout: jest.fn().mockResolvedValue(undefined),
    listProducts: jest.fn().mockResolvedValue([]),
    listLicenses: jest.fn().mockResolvedValue([]),
    listOrders: jest.fn().mockResolvedValue([]),
    createOrder: jest.fn(),
    getOrder: jest.fn(),
    getOrderTerms: jest.fn(),
    acceptServiceTerms: jest.fn(),
  };
});

describe('mobile home selectors, cart persistence, purchase config & checkout review', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.mocked(subscribeSession).mockImplementation(() => () => {});
    jest.mocked(restoreSession).mockResolvedValue(null);
    jest.mocked(listProducts).mockResolvedValue([]);
    jest.mocked(listLicenses).mockResolvedValue([]);
    jest.mocked(listOrders).mockResolvedValue([]);
  });

  it('opens with six A–Z products before account sections and preserves product, search and catalog navigation', async () => {
    const products: MobileProduct[] = ['G', 'C', 'A', 'F', 'B', 'E', 'D'].map((name) => ({
      id: name, code: name, slug: name.toLowerCase(), providerId: 'provider',
      name: `Sản phẩm ${name}`, summary: `Mô tả ${name}`, plans: [],
    }));
    jest.mocked(listProducts).mockResolvedValue(products);
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'test', refreshToken: 'test',
      user: { id: 'customer', email: 'customer@example.test', displayName: 'Khách hàng', role: 'CUSTOMER', status: 'ACTIVE' },
    });
    const onOpenProduct = jest.fn();
    const onOpenCatalog = jest.fn();
    await render(
      <CustomerSessionProvider>
        <HomeScreen onOpenProduct={onOpenProduct} onOpenCatalog={onOpenCatalog}
          onOpenNotifications={jest.fn()} onOpenLicenses={jest.fn()} onOpenOrder={jest.fn()}
          onOpenOrdersTab={jest.fn()} onOpenAssistant={jest.fn()} onOpenSupport={jest.fn()} onOpenHelp={jest.fn()} />
      </CustomerSessionProvider>,
    );
    await screen.findByText('Sản phẩm A');
    expect(screen.getAllByText(/^Sản phẩm [A-G]$/).map((node) => node.props.children)).toEqual(
      ['A', 'B', 'C', 'D', 'E', 'F'].map((name) => `Sản phẩm ${name}`),
    );
    expect(screen.queryByText(/Xin chào/)).toBeNull();
    await screen.findByRole('header', { name: 'Bản quyền của tôi' });
    const headings = screen.getAllByRole('header').map((node) => node.props.children);
    expect(headings).toContain('Sản phẩm đang phát hành');
    expect(headings.indexOf('Sản phẩm đang phát hành')).toBeLessThan(headings.indexOf('Bản quyền của tôi'));
    await fireEvent.press(screen.getByRole('button', { name: 'Xem gói & chi tiết: Sản phẩm A' }));
    expect(onOpenProduct).toHaveBeenCalledWith('A');
    await fireEvent.changeText(screen.getByLabelText('Tìm sản phẩm hoặc gói'), '  Desktop  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Tìm' }));
    expect(onOpenCatalog).toHaveBeenLastCalledWith('Desktop');
    await fireEvent.press(screen.getByRole('button', { name: 'Xem tất cả sản phẩm' }));
    expect(onOpenCatalog).toHaveBeenLastCalledWith();
    expect(products.map((product) => product.id)).toEqual(['G', 'C', 'A', 'F', 'B', 'E', 'D']);
  });

  it('allows retrying a failed Home catalog request and shows a real empty state', async () => {
    jest.mocked(listProducts).mockRejectedValueOnce(new Error('offline')).mockResolvedValue([]);
    await render(
      <CustomerSessionProvider>
        <HomeScreen onOpenProduct={jest.fn()} onOpenCatalog={jest.fn()}
          onOpenNotifications={jest.fn()} onOpenLicenses={jest.fn()} onOpenOrder={jest.fn()}
          onOpenOrdersTab={jest.fn()} onOpenAssistant={jest.fn()} onOpenSupport={jest.fn()} onOpenHelp={jest.fn()} />
      </CustomerSessionProvider>,
    );
    await screen.findByText('Không thể tải danh mục sản phẩm.');
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chưa có sản phẩm được công bố.')).toBeOnTheScreen();
  });

  it('computes buyer home KPIs matching Web rules including PROVIDER_HANDOFF null devices', () => {
    const now = new Date('2026-10-01T00:00:00Z');
    const metrics = selectBuyerHomeMetrics(
      [{ id: 'o1' }, { id: 'o2' }],
      [
        {
          expiresAt: '2026-10-15T00:00:00Z',
          status: 'ACTIVE',
          activeDeviceCount: 2,
          fulfillmentMode: 'DIRECT',
        },
        {
          expiresAt: '2026-12-01T00:00:00Z',
          status: 'ACTIVE',
          activeDeviceCount: 1,
          fulfillmentMode: 'DIRECT',
        },
        {
          expiresAt: '2026-10-10T00:00:00Z',
          status: 'ACTIVE',
          activeDeviceCount: 1,
          activationKeyTrustStatus: 'UNTRUSTED_REORG',
        },
      ],
      now,
    );
    expect(metrics).toEqual({
      activeLicenses: 2,
      activeDevices: 3,
      licensesExpiringWithin30Days: 1,
      recentOrders: 2,
    });

    const handoffMetrics = selectBuyerHomeMetrics(
      [],
      [
        {
          expiresAt: '2026-12-01T00:00:00Z',
          status: 'ACTIVE',
          activeDeviceCount: 0,
          fulfillmentMode: 'PROVIDER_HANDOFF',
        },
      ],
      now,
    );
    expect(handoffMetrics.activeDevices).toBeNull();
  });

  it('deduplicates identical draft configs in cartReducer instead of incrementing deviceQuantity', () => {
    const first = {
      id: 'd1',
      ownerUserId: 'u1',
      productId: 'p1',
      productName: 'Desktop',
      planId: 'pl1',
      planName: 'Pro',
      deviceQuantity: 3,
      durationMonths: 12 as const,
      referencePriceVnd: 990_000,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };
    let state = cartReducer(initialCartState, { type: 'UPSERT', draft: first });
    state = cartReducer(state, {
      type: 'UPSERT',
      draft: {
        ...first,
        id: 'd2',
        referencePriceVnd: 1_050_000,
        updatedAt: '2026-10-01T01:00:00Z',
      },
    });
    expect(state.items).toHaveLength(1);
    expect(state.items[0].deviceQuantity).toBe(3);
    expect(state.items[0].referencePriceVnd).toBe(1_050_000);
  });

  it('isolates cart storage by userId and surfaces read errors explicitly', async () => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 't',
      refreshToken: 'r',
      user: {
        id: 'user-A',
        email: 'a@emukey.app',
        displayName: 'A',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk error'));

    function CartProbe() {
      const { storageError, count, saveDraft } = useCart();
      return (
        <>
          <AppText>{storageError ?? `ok:${count}`}</AppText>
          <AppButton
            label="Save"
            onPress={() =>
              void saveDraft({
                productId: 'p1',
                productName: 'Desktop',
                planId: 'pl1',
                planName: 'Pro',
                deviceQuantity: 2,
                durationMonths: 6,
                referencePriceVnd: 500_000,
              })
            }
          />
        </>
      );
    }

    await render(
      <CustomerSessionProvider>
        <CartProvider>
          <CartProbe />
        </CartProvider>
      </CustomerSessionProvider>,
    );

    expect(
      await screen.findByText('Chưa tải được giỏ hàng đã lưu trên thiết bị.'),
    ).toBeOnTheScreen();
  });

  it('validates custom deviceQuantity and durationMonths in PurchaseConfigurationScreen before continuing', async () => {
    jest.mocked(listProducts).mockResolvedValue([
      {
        id: 'prod-1',
        providerId: 'prov-1',
        providerDisplayName: 'EmuKey',
        code: 'DESK',
        slug: 'desk',
        name: 'EmuKey Desktop',
        summary: 'Summary',
        plans: [
          {
            id: 'plan-1',
            name: 'Pro',
            code: 'PRO',
            billingCycle: 'YEARLY',
            durationMonths: 12,
            maxActiveDevices: 2,
            priceVnd: 990_000,
            entitlements: {},
          },
        ],
      },
    ]);
    const onContinueReview = jest.fn();

    await render(
      <PurchaseConfigurationScreen
        initialPlanId="plan-1"
        onBack={jest.fn()}
        onContinueReview={onContinueReview}
        onSavedToCart={jest.fn()}
        productId="prod-1"
      />,
    );

    const deviceInput = await screen.findByLabelText('Số thiết bị');
    await act(async () => fireEvent.changeText(deviceInput, '0'));
    expect(screen.getByText(/Số thiết bị phải là số nguyên từ 1/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Xem lại & tạo đơn' })).toBeDisabled();

    // Clearing the field stays empty during typing and guides user on blur.
    await act(async () => fireEvent.changeText(deviceInput, ''));
    expect(screen.getByLabelText('Số thiết bị').props.value).toBe('');
    await act(async () => fireEvent(screen.getByLabelText('Số thiết bị'), 'blur'));
    expect(screen.getByText('Vui lòng nhập số thiết bị (tối thiểu 1).')).toBeOnTheScreen();

    await act(async () => fireEvent.changeText(deviceInput, '5'));
    await act(async () => fireEvent.press(screen.getByText('6 tháng')));
    await act(async () => fireEvent.press(screen.getByText('Xem lại & tạo đơn')));

    expect(onContinueReview).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'prod-1',
        planId: 'plan-1',
        deviceQuantity: 5,
        durationMonths: 6,
        customized: true,
      }),
    );
  });

  it('keeps cart intent through PurchaseConfigurationScreen by making Lưu vào giỏ primary', async () => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: {
        id: 'cust-cart-1',
        email: 'c@emukey.app',
        displayName: 'C',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });
    jest.mocked(listProducts).mockResolvedValue([
      {
        id: 'prod-1',
        slug: 'desktop',
        name: 'EmuKey Desktop',
        summary: 'Desktop license',
        imageUrl: null,
        providerDisplayName: 'EmuKey',
        plans: [
          {
            id: 'plan-1',
            name: 'Pro',
            billingCycle: 'YEARLY',
            priceVnd: 990_000,
            maxActiveDevices: 2,
            durationMonths: 12,
            entitlements: {},
          },
        ],
      },
    ]);
    const onSavedToCart = jest.fn();

    await render(
      <CustomerSessionProvider>
        <CartProvider>
          <PurchaseConfigurationScreen
            initialAction="cart"
            initialPlanId="plan-1"
            onBack={jest.fn()}
            onContinueReview={jest.fn()}
            onSavedToCart={onSavedToCart}
            productId="prod-1"
          />
        </CartProvider>
      </CustomerSessionProvider>,
    );

    expect(await screen.findByText('Cấu hình lưu vào giỏ')).toBeOnTheScreen();
    expect(await screen.findByText('EmuKey Desktop')).toBeOnTheScreen();
    expect(
      screen.getByText(/Bạn đã chọn thêm vào giỏ hàng/),
    ).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Lưu vào giỏ')));
    await waitFor(() => expect(onSavedToCart).toHaveBeenCalledTimes(1));
  });

  it('creates order only when user clicks submit in CheckoutReviewScreen and handles custom snapshot price', async () => {
    jest.mocked(getOrderTerms).mockResolvedValue({
      content: 'Điều khoản dịch vụ',
      version: 'v1',
      hash: 'a'.repeat(64),
    });
    jest.mocked(createOrder).mockResolvedValue({
      id: 'order-custom-1',
      orderNumber: 'ORD-CUST-1',
      orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE',
      orderType: 'NEW_PURCHASE',
      productId: 'prod-1',
      planId: 'plan-1',
      productNameSnapshot: 'EmuKey Desktop',
      planNameSnapshot: 'Pro',
      planVersionSnapshot: 1,
      planCommitmentSnapshot: `0x${'11'.repeat(32)}`,
      billingCycleSnapshot: 'HALF_YEARLY',
      durationMonthsSnapshot: 6,
      maxActiveDevicesSnapshot: 5,
      priceVndSnapshot: 1_250_000,
      currency: 'VND',
      customerUserId: 'cust-1',
      providerUserId: 'prov-1',
      providerNameSnapshot: 'EmuKey',
      entitlementsSnapshot: {},
      createdAt: '2026-10-01T00:00:00Z',
      paymentDueAt: '2026-10-02T00:00:00Z',
    });
    const onOpenTerms = jest.fn();

    await render(
      <CheckoutReviewScreen
        customized
        deviceQuantity={5}
        durationMonths={6}
        onBack={jest.fn()}
        onOpenPayment={jest.fn()}
        onOpenTerms={onOpenTerms}
        planId="plan-1"
        planName="Pro"
        priceVnd={990_000}
        productId="prod-1"
        productName="EmuKey Desktop"
      />,
    );

    expect(createOrder).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText('Xác nhận cấu hình')));

    await waitFor(() =>
      expect(createOrder).toHaveBeenCalledWith({
        planId: 'plan-1',
        deviceQuantity: 5,
        durationMonths: 6,
      }),
    );
    expect(onOpenTerms).not.toHaveBeenCalled();
    expect((await screen.findAllByText('1.250.000 ₫')).length).toBeGreaterThan(0);
    expect(screen.getByText('Đã tính giá theo cấu hình')).toBeOnTheScreen();
  });

  it('keeps legacy and new pending checkout intents separate, including different configurations', async () => {
    await AsyncStorage.setItem('emukey_checkout_intent_v1_buyer', JSON.stringify({
      orderId: 'order-a', planId: 'plan-a', productId: 'product-a',
    }));
    await Promise.all([
      writeCheckoutIntent('buyer', { orderId: 'order-b', planId: 'plan-b', productId: 'product-b' }),
      writeCheckoutIntent('buyer', { orderId: 'order-custom', planId: 'plan-a', productId: 'product-a', deviceQuantity: 5 }),
    ]);

    await expect(readCheckoutIntent('buyer', { planId: 'plan-a' })).resolves.toMatchObject({ orderId: 'order-a' });
    await expect(readCheckoutIntent('buyer', { planId: 'plan-b' })).resolves.toMatchObject({ orderId: 'order-b' });
    await expect(readCheckoutIntent('buyer', { planId: 'plan-a', deviceQuantity: 5 })).resolves.toMatchObject({ orderId: 'order-custom' });

    await clearCheckoutIntent('buyer', 'order-b');
    await expect(readCheckoutIntent('buyer', { planId: 'plan-b' })).resolves.toBeNull();
    await expect(readCheckoutIntent('buyer', { planId: 'plan-a' })).resolves.toMatchObject({ orderId: 'order-a' });
  });

  it('recovers a pending checkout intent order via GET without calling createOrder again', async () => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: {
        id: 'cust-recover',
        email: 'c@emukey.app',
        displayName: 'C',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });
    await writeCheckoutIntent('cust-recover', {
      orderId: 'ord-existing',
      planId: 'plan-1',
      productId: 'prod-1',
    });
    jest.mocked(getOrder).mockResolvedValue({
      id: 'ord-existing',
      orderNumber: 'ORD-REC-1',
      orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE',
      orderType: 'NEW_PURCHASE',
      productId: 'prod-1',
      planId: 'plan-1',
      productNameSnapshot: 'EmuKey Desktop',
      planNameSnapshot: 'Pro',
      planVersionSnapshot: 1,
      planCommitmentSnapshot: `0x${'11'.repeat(32)}`,
      billingCycleSnapshot: 'YEARLY',
      durationMonthsSnapshot: 12,
      maxActiveDevicesSnapshot: 2,
      priceVndSnapshot: 990_000,
      currency: 'VND',
      customerUserId: 'cust-recover',
      providerUserId: 'prov-1',
      providerNameSnapshot: 'EmuKey',
      entitlementsSnapshot: {},
      createdAt: '2026-10-01T00:00:00Z',
      paymentDueAt: '2026-10-02T00:00:00Z',
    });
    jest.mocked(getOrderTerms).mockResolvedValue({
      content: 'Điều khoản dịch vụ',
      version: 'v1',
      hash: 'a'.repeat(64),
    });

    await render(
      <CustomerSessionProvider>
        <CheckoutReviewScreen
          onBack={jest.fn()}
          onOpenPayment={jest.fn()}
          onOpenTerms={jest.fn()}
          planId="plan-1"
          planName="Pro"
          priceVnd={990_000}
          productId="prod-1"
          productName="EmuKey Desktop"
        />
      </CustomerSessionProvider>,
    );

    expect(await screen.findByText('ORD-REC-1')).toBeOnTheScreen();
    expect(getOrder).toHaveBeenCalledWith('ord-existing');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('distinguishes an actual base plan price update from custom configuration pricing on CheckoutReviewScreen', async () => {
    jest.mocked(getOrderTerms).mockResolvedValue({
      content: 'Điều khoản dịch vụ',
      version: 'v1',
      hash: 'a'.repeat(64),
    });
    jest.mocked(createOrder).mockResolvedValue({
      id: 'order-price-up-1',
      orderNumber: 'ORD-PRICE-1',
      orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE',
      orderType: 'NEW_PURCHASE',
      productId: 'prod-1',
      planId: 'plan-1',
      productNameSnapshot: 'EmuKey Desktop',
      planNameSnapshot: 'Pro',
      planVersionSnapshot: 1,
      planCommitmentSnapshot: `0x${'11'.repeat(32)}`,
      billingCycleSnapshot: 'YEARLY',
      durationMonthsSnapshot: 12,
      maxActiveDevicesSnapshot: 2,
      priceVndSnapshot: 1_100_000,
      currency: 'VND',
      customerUserId: 'cust-1',
      providerUserId: 'prov-1',
      providerNameSnapshot: 'EmuKey',
      entitlementsSnapshot: {},
      createdAt: '2026-10-01T00:00:00Z',
      paymentDueAt: '2026-10-02T00:00:00Z',
    });

    await render(
      <CheckoutReviewScreen
        customized={false}
        deviceQuantity={2}
        durationMonths={12}
        onBack={jest.fn()}
        onOpenPayment={jest.fn()}
        onOpenTerms={jest.fn()}
        planId="plan-1"
        planName="Pro"
        priceVnd={990_000}
        productId="prod-1"
        productName="EmuKey Desktop"
      />,
    );

    expect(screen.getByText('Giá gói tham khảo')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Xác nhận cấu hình')));
    expect(await screen.findByText('Giá gói đã cập nhật')).toBeOnTheScreen();
    expect(screen.queryByText('Đã tính giá theo cấu hình')).toBeNull();
  });

  it('normalizes Gói plan labels and avoids presenting base price as confirmed custom total before order creation', async () => {
    jest.mocked(listProducts).mockResolvedValue([
      {
        id: 'prod-biz',
        providerId: 'prov-1',
        providerDisplayName: 'Minh Tâm',
        code: 'CLASS_BIZ',
        slug: 'class-biz',
        name: 'Classroom Hub Business',
        summary: 'Quản lý lớp học',
        plans: [
          {
            id: 'plan-biz',
            name: 'Gói Doanh nghiệp',
            code: 'BIZ',
            billingCycle: 'YEARLY',
            durationMonths: 12,
            maxActiveDevices: 10,
            priceVnd: 2_322_000,
            entitlements: {},
          },
        ],
      },
    ]);

    await render(
      <PurchaseConfigurationScreen
        initialPlanId="plan-biz"
        onBack={jest.fn()}
        onContinueReview={jest.fn()}
        onSavedToCart={jest.fn()}
        productId="prod-biz"
      />,
    );

    const input = await screen.findByLabelText('Số thiết bị');
    await act(async () => fireEvent.changeText(input, '11'));

    expect(screen.queryByText(/gói Gói/)).toBeNull();
    expect(
      screen.getByText(/Giá gốc Gói Doanh nghiệp: 2\.322\.000 ₫ · Tổng \(11 thiết bị · 12 tháng\) xác nhận ở bước sau/),
    ).toBeOnTheScreen();
  });

  it('reloads updated terms and resets acceptance checkbox after 409 conflict on ServiceTermsScreen', async () => {
    const waitingOrder = {
      id: 'order-terms-1',
      orderNumber: 'ORD-TERMS-1',
      orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE',
      orderType: 'NEW_PURCHASE' as const,
      productId: 'prod-1',
      planId: 'plan-1',
      productNameSnapshot: 'EmuKey Desktop',
      planNameSnapshot: 'Pro',
      planVersionSnapshot: 1,
      planCommitmentSnapshot: `0x${'11'.repeat(32)}`,
      billingCycleSnapshot: 'YEARLY' as const,
      durationMonthsSnapshot: 12,
      maxActiveDevicesSnapshot: 2,
      priceVndSnapshot: 990_000,
      currency: 'VND',
      customerUserId: 'cust-1',
      providerUserId: 'prov-1',
      providerNameSnapshot: 'EmuKey',
      entitlementsSnapshot: {},
      createdAt: '2026-10-01T00:00:00Z',
      paymentDueAt: '2026-10-02T00:00:00Z',
    };
    jest.mocked(getOrder).mockResolvedValue(waitingOrder);
    jest
      .mocked(getOrderTerms)
      .mockResolvedValueOnce({ content: 'Điều khoản cũ v1', version: 'v1', hash: 'a'.repeat(64) })
      .mockResolvedValueOnce({ content: 'Điều khoản mới v2', version: 'v2', hash: 'b'.repeat(64) });
    jest
      .mocked(acceptServiceTerms)
      .mockRejectedValueOnce(new MobileApiError(409, 'Terms version changed'));

    await render(
      <CustomerSessionProvider>
        <ServiceTermsScreen orderId="order-terms-1" onAccepted={jest.fn()} onBack={jest.fn()} />
      </CustomerSessionProvider>,
    );

    expect(await screen.findByText('Điều khoản cũ v1')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('checkbox')));
    expect(screen.getByRole('checkbox').props.accessibilityState).toEqual({
      checked: true,
      disabled: false,
    });

    await act(async () => fireEvent.press(screen.getByText('Đồng ý và tiếp tục')));
    expect(await screen.findByText('Điều khoản mới v2')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Trạng thái đơn hoặc phiên bản điều khoản đã thay đổi. Đã tải lại thông tin mới nhất.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('checkbox').props.accessibilityState).toEqual({
      checked: false,
      disabled: false,
    });
  });

  it('blocks createOrder and prepareOrder while getOrder for pending intent A is still resolving, then continues with A', async () => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: { id: 'cust-slow', email: 'c@emukey.app', displayName: 'C', role: 'CUSTOMER', status: 'ACTIVE' },
    });
    await writeCheckoutIntent('cust-slow', {
      orderId: 'ord-a-slow',
      planId: 'plan-1',
      productId: 'prod-1',
    });

    let resolveOrder!: (value: Awaited<ReturnType<typeof getOrder>>) => void;
    jest.mocked(getOrder).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOrder = resolve;
        }),
    );

    const onOpenPayment = jest.fn();
    await render(
      <CustomerSessionProvider>
        <CheckoutReviewScreen
          onBack={jest.fn()}
          onOpenPayment={onOpenPayment}
          onOpenTerms={jest.fn()}
          planId="plan-1"
          planName="Pro"
          priceVnd={990_000}
          productId="prod-1"
          productName="EmuKey Desktop"
        />
      </CustomerSessionProvider>,
    );

    await waitFor(() => expect(getOrder).toHaveBeenCalledWith('ord-a-slow'));

    // Button must be disabled / busy and pressing it must NOT call createOrder
    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận cấu hình' });
    expect(confirmBtn.props.accessibilityState?.disabled || confirmBtn.props.accessibilityState?.busy).toBeTruthy();
    await act(async () => fireEvent.press(confirmBtn));
    expect(createOrder).not.toHaveBeenCalled();

    // Now resolve A as WAITING_PAYMENT
    await act(async () => {
      resolveOrder({
        id: 'ord-a-slow',
        orderNumber: 'ORD-A-SLOW',
        orderStatus: 'WAITING_PAYMENT',
        orderType: 'NEW_PURCHASE',
        productId: 'prod-1',
        planId: 'plan-1',
        productNameSnapshot: 'EmuKey Desktop',
        planNameSnapshot: 'Pro',
        planVersionSnapshot: 1,
        planCommitmentSnapshot: `0x${'11'.repeat(32)}`,
        billingCycleSnapshot: 'YEARLY',
        durationMonthsSnapshot: 12,
        maxActiveDevicesSnapshot: 2,
        priceVndSnapshot: 990_000,
        currency: 'VND',
        customerUserId: 'cust-slow',
        providerUserId: 'prov-1',
        providerNameSnapshot: 'EmuKey',
        entitlementsSnapshot: {},
        createdAt: '2026-10-01T00:00:00Z',
        paymentDueAt: '2026-10-02T00:00:00Z',
      });
    });

    expect(await screen.findByText('ORD-A-SLOW')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Xem thanh toán' })));
    expect(onOpenPayment).toHaveBeenCalledWith('ord-a-slow');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('blocks prepareOrder at hook level during pending storage read and pending getOrder', async () => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: { id: 'cust-hook', email: 'c@emukey.app', displayName: 'C', role: 'CUSTOMER', status: 'ACTIVE' },
    });
    await writeCheckoutIntent('cust-hook', {
      orderId: 'ord-hook-a',
      planId: 'plan-1',
      productId: 'prod-1',
    });

    let resolveStorage!: (value: string | null) => void;
    const prevGetItemImpl = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
    jest.mocked(AsyncStorage.getItem).mockImplementation((key: string) => {
      if (key.includes('emukey_checkout_intent_v1_cust-hook')) {
        return new Promise((resolve) => {
          resolveStorage = resolve;
        });
      }
      return prevGetItemImpl(key);
    });

    let hookApi!: ReturnType<typeof useCheckoutOrder>;
    function HookProbe() {
      hookApi = useCheckoutOrder();
      return null;
    }

    await render(
      <CustomerSessionProvider>
        <HookProbe />
      </CustomerSessionProvider>,
    );

    try {
      let recoverPromise!: Promise<unknown>;
      let prepareResult: unknown;
      await act(async () => {
        recoverPromise = hookApi.recoverPendingIntent('plan-1');
        // Call prepareOrder immediately while storage read is still pending
        prepareResult = await hookApi.prepareOrder({ planId: 'plan-1' });
      });
      expect(prepareResult).toBeNull();
      expect(createOrder).not.toHaveBeenCalled();

      await act(async () => {
        resolveStorage(null);
        await recoverPromise;
      });
    } finally {
      jest.mocked(AsyncStorage.getItem).mockImplementation(prevGetItemImpl);
    }
  });

  it.each(['network', 'storage'])('keeps the pending order and blocks creation after a %s failure', async (failure) => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: { id: 'cust-err', email: 'c@emukey.app', displayName: 'C', role: 'CUSTOMER', status: 'ACTIVE' },
    });
    await writeCheckoutIntent('cust-err', {
      orderId: 'ord-err-a',
      planId: 'plan-1',
      productId: 'prod-1',
    });

    const getExistingOrder = jest.mocked(getOrder);
    if (failure === 'storage') {
      jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage unavailable'));
    } else {
      getExistingOrder.mockRejectedValueOnce(new Error('network timeout'));
    }
    getExistingOrder.mockResolvedValueOnce({
        id: 'ord-err-a',
        orderNumber: 'ORD-ERR-A',
        orderStatus: 'WAITING_PAYMENT',
        orderType: 'NEW_PURCHASE',
        productId: 'prod-1',
        planId: 'plan-1',
        productNameSnapshot: 'EmuKey Desktop',
        planNameSnapshot: 'Pro',
        planVersionSnapshot: 1,
        planCommitmentSnapshot: `0x${'11'.repeat(32)}`,
        billingCycleSnapshot: 'YEARLY',
        durationMonthsSnapshot: 12,
        maxActiveDevicesSnapshot: 2,
        priceVndSnapshot: 990_000,
        currency: 'VND',
        customerUserId: 'cust-err',
        providerUserId: 'prov-1',
        providerNameSnapshot: 'EmuKey',
        entitlementsSnapshot: {},
        createdAt: '2026-10-01T00:00:00Z',
        paymentDueAt: '2026-10-02T00:00:00Z',
      });

    await render(
      <CustomerSessionProvider>
        <CheckoutReviewScreen
          onBack={jest.fn()}
          onOpenPayment={jest.fn()}
          onOpenTerms={jest.fn()}
          planId="plan-1"
          planName="Pro"
          priceVnd={990_000}
          productId="prod-1"
          productName="EmuKey Desktop"
        />
      </CustomerSessionProvider>,
    );

    expect(await screen.findByText(/Không thể kiểm tra đơn hàng chưa hoàn tất/i)).toBeOnTheScreen();
    expect(createOrder).not.toHaveBeenCalled();
    if (failure === 'storage') expect(getOrder).not.toHaveBeenCalled();
    // Intent must still be preserved in storage
    expect(await readCheckoutIntent('cust-err', { planId: 'plan-1' })).toMatchObject({ orderId: 'ord-err-a' });

    // Confirm button must NOT create a new order while recovery failed
    const confirmBtn = screen.getByRole('button', { name: 'Xác nhận cấu hình' });
    expect(confirmBtn.props.accessibilityState?.disabled).toBe(true);

    // Retry recovery succeeds and loads ORD-ERR-A
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Thử lại' })));
    expect(await screen.findByText('ORD-ERR-A')).toBeOnTheScreen();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('creates at most one order on rapid double-press when no pending intent exists', async () => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: { id: 'cust-new', email: 'c@emukey.app', displayName: 'C', role: 'CUSTOMER', status: 'ACTIVE' },
    });
    let resolveCreate!: (value: Awaited<ReturnType<typeof createOrder>>) => void;
    jest.mocked(createOrder).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    await render(
      <CustomerSessionProvider>
        <CheckoutReviewScreen
          onBack={jest.fn()}
          onOpenPayment={jest.fn()}
          onOpenTerms={jest.fn()}
          planId="plan-1"
          planName="Pro"
          priceVnd={990_000}
          productId="prod-1"
          productName="EmuKey Desktop"
        />
      </CustomerSessionProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Xác nhận cấu hình' }).props.accessibilityState?.disabled).toBeFalsy(),
    );
    expect(createOrder).not.toHaveBeenCalled();

    const btn = screen.getByRole('button', { name: 'Xác nhận cấu hình' });
    await act(async () => {
      fireEvent.press(btn);
      fireEvent.press(btn);
    });
    expect(createOrder).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate({
        id: 'ord-new-1',
        orderNumber: 'ORD-NEW-1',
        orderStatus: 'WAITING_PAYMENT',
        orderType: 'NEW_PURCHASE',
        productId: 'prod-1',
        planId: 'plan-1',
        productNameSnapshot: 'EmuKey Desktop',
        planNameSnapshot: 'Pro',
        planVersionSnapshot: 1,
        planCommitmentSnapshot: `0x${'11'.repeat(32)}`,
        billingCycleSnapshot: 'YEARLY',
        durationMonthsSnapshot: 12,
        maxActiveDevicesSnapshot: 2,
        priceVndSnapshot: 990_000,
        currency: 'VND',
        customerUserId: 'cust-new',
        providerUserId: 'prov-1',
        providerNameSnapshot: 'EmuKey',
        entitlementsSnapshot: {},
        createdAt: '2026-10-01T00:00:00Z',
        paymentDueAt: '2026-10-02T00:00:00Z',
      });
    });
  });

  it('ignores stale recovery result if user switches plan before previous getOrder resolves', async () => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: { id: 'cust-switch', email: 'c@emukey.app', displayName: 'C', role: 'CUSTOMER', status: 'ACTIVE' },
    });
    await writeCheckoutIntent('cust-switch', {
      orderId: 'ord-plan-1',
      planId: 'plan-1',
      productId: 'prod-1',
    });

    let resolveSlowPlan1!: (value: Awaited<ReturnType<typeof getOrder>>) => void;
    jest.mocked(getOrder).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSlowPlan1 = resolve;
        }),
    );

    const { rerender } = await render(
      <CustomerSessionProvider>
        <CheckoutReviewScreen
          onBack={jest.fn()}
          onOpenPayment={jest.fn()}
          onOpenTerms={jest.fn()}
          planId="plan-1"
          planName="Pro"
          priceVnd={990_000}
          productId="prod-1"
          productName="EmuKey Desktop"
        />
      </CustomerSessionProvider>,
    );

    await waitFor(() => expect(getOrder).toHaveBeenCalledWith('ord-plan-1'));

    // User switches to plan-2 while ord-plan-1 is still in flight
    await rerender(
      <CustomerSessionProvider>
        <CheckoutReviewScreen
          onBack={jest.fn()}
          onOpenPayment={jest.fn()}
          onOpenTerms={jest.fn()}
          planId="plan-2"
          planName="Enterprise"
          priceVnd={2_500_000}
          productId="prod-1"
          productName="EmuKey Desktop"
        />
      </CustomerSessionProvider>,
    );

    // Late resolution of plan-1 must NOT overwrite plan-2 screen
    await act(async () => {
      resolveSlowPlan1({
        id: 'ord-plan-1',
        orderNumber: 'ORD-PLAN-1',
        orderStatus: 'WAITING_PAYMENT',
        orderType: 'NEW_PURCHASE',
        productId: 'prod-1',
        planId: 'plan-1',
        productNameSnapshot: 'EmuKey Desktop',
        planNameSnapshot: 'Pro',
        planVersionSnapshot: 1,
        planCommitmentSnapshot: `0x${'11'.repeat(32)}`,
        billingCycleSnapshot: 'YEARLY',
        durationMonthsSnapshot: 12,
        maxActiveDevicesSnapshot: 2,
        priceVndSnapshot: 990_000,
        currency: 'VND',
        customerUserId: 'cust-switch',
        providerUserId: 'prov-1',
        providerNameSnapshot: 'EmuKey',
        entitlementsSnapshot: {},
        createdAt: '2026-10-01T00:00:00Z',
        paymentDueAt: '2026-10-02T00:00:00Z',
      });
    });

    expect(screen.queryByText('ORD-PLAN-1')).toBeNull();
  });
});
