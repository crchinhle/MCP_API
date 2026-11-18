import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

import {
  AssistanceScreen,
  CatalogScreen,
  CheckoutScreen,
  ComparePlansScreen,
  PaymentScreen,
  OrderDetailScreen,
  ProfileScreen,
  RenewalScreen,
  VerifyLicenseScreen,
  matchesPaymentReturn,
} from '../../../../EmuKey/mobile/src/presentation/EmuKeyMobileApp';

it('recognizes only the configured checkout return origin and exact order', () => {
  expect(matchesPaymentReturn('https://shop.example/buyer/orders/o1/payment?sepay=success','o1','https://shop.example/buyer/orders/o1/payment?sepay=success')).toBe(true);
  expect(matchesPaymentReturn('https://evil.example/buyer/orders/o1/payment','o1','https://shop.example/buyer/orders/o1/payment')).toBe(false);
  expect(matchesPaymentReturn('emukey://payment/o2','o1')).toBe(false);
});
import {
  askConversationAi,
  appendConversationMessage,
  requestConversationSupport,
  listConversations,
  listConversationMessages,
  acceptServiceTerms,
  comparePlans,
  createOrder,
  createConversation,
  createCheckout,
  getPaymentRetryDecision,
  getLicense,
getOrder,
  getOrderTerms,
  getRenewalPreview,
  getProfile,
  listNotifications,
  listProducts,
  updateProfile,
  verifyPublicLicense,
  type MobileConversationMessage,
  type MobileOrderDetail,
} from '../../../../EmuKey/mobile/src/infrastructure/api/client';

jest.mock('../../../../EmuKey/mobile/src/infrastructure/api/client', () => ({
  askConversationAi: jest.fn(),
  appendConversationMessage: jest.fn(),
  requestConversationSupport: jest.fn(),
  listConversations: jest.fn(),
  listConversationMessages: jest.fn(),
  acceptServiceTerms: jest.fn(),
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
  listProducts: jest.fn(),
  updateProfile: jest.fn(),
  verifyPublicLicense: jest.fn(),
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
    jest.mocked(verifyPublicLicense).mockReset();
    jest.mocked(getPaymentRetryDecision).mockResolvedValue({ allowed: true, canResume: false, reason: 'READY' });
    listNotificationsMock.mockResolvedValue([]);
  });

  it('clears a previous verification when the code changes and the next request fails', async () => {
    jest.mocked(verifyPublicLicense).mockResolvedValueOnce({ licenseId: 'EMU-VALID', productName: 'Verified product', state: 'CHAIN_CONFIRMED' } as never)
      .mockRejectedValueOnce(new Error('LICENSE_NOT_FOUND'));
    await render(<VerifyLicenseScreen />);
    await fireEvent.changeText(screen.getByLabelText('Mã License công khai'), 'EMU-VALID');
    await fireEvent.press(screen.getByText('Xác minh'));
    expect(await screen.findByText('Verified product')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Mã License công khai'), 'EMU-MISSING');
    expect(screen.queryByText('Verified product')).toBeNull();
    await fireEvent.press(screen.getByText('Xác minh'));
    expect(await screen.findByText('Không thể xác minh License lúc này.')).toBeOnTheScreen();
    expect(screen.queryByText('CHAIN_CONFIRMED')).toBeNull();
  });

  it('ignores a verification response after its input has changed', async () => {
    let finish!: (value: Awaited<ReturnType<typeof verifyPublicLicense>>) => void;
    jest.mocked(verifyPublicLicense).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await render(<VerifyLicenseScreen />);
    await fireEvent.changeText(screen.getByLabelText('Mã License công khai'), 'EMU-OLD');
    await fireEvent.press(screen.getByText('Xác minh'));
    await fireEvent.changeText(screen.getByLabelText('Mã License công khai'), 'EMU-CURRENT');
    await act(async () => finish({ licenseId: 'EMU-OLD', productName: 'Stale product', state: 'CHAIN_CONFIRMED' } as never));
    expect(screen.queryByText('Stale product')).toBeNull();
    expect(screen.queryByText('CHAIN_CONFIRMED')).toBeNull();
  });

  it('preserves the newest verification when an older request fails later', async () => {
    let fail!: (reason: Error) => void;
    jest.mocked(verifyPublicLicense).mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }))
      .mockResolvedValueOnce({ licenseId: 'EMU-CURRENT', productName: 'Current product', state: 'CHAIN_CONFIRMED' } as never);
    await render(<VerifyLicenseScreen />);
    await fireEvent.changeText(screen.getByLabelText('Mã License công khai'), 'EMU-OLD');
    await fireEvent.press(screen.getByText('Xác minh'));
    await fireEvent.changeText(screen.getByLabelText('Mã License công khai'), 'EMU-CURRENT');
    await fireEvent.press(screen.getByText('Xác minh'));
    expect(await screen.findByText('Current product')).toBeOnTheScreen();
    await act(async () => fail(new Error('old request failed')));
    expect(screen.getByText('Current product')).toBeOnTheScreen();
    expect(screen.queryByText('Không thể xác minh License lúc này.')).toBeNull();
  });

  it.each(['older-first', 'poll-first'])('keeps contiguous history when initial windows overlap (%s)', async completionOrder => {
    const conversation = { id: 'overlapping-support', status: 'WAITING_SUPPORT', title: 'Overlapping support' };
    const pending: Array<{
      query: Parameters<typeof listConversationMessages>[1];
      resolve: (items: MobileConversationMessage[]) => void;
    }> = [];
    const page = (from: number, to: number): MobileConversationMessage[] => Array.from({ length: to - from + 1 }, (_, index) => ({
      id: `message-${from + index}`, conversationId: conversation.id, clientMessageId: `intent-${from + index}`,
      serverSequence: from + index, content: `Message ${from + index}`, senderType: 'CUSTOMER',
    }));
    jest.mocked(listConversations).mockResolvedValue([conversation] as never);
    jest.mocked(listConversationMessages).mockImplementation((_id, query) => new Promise(resolve => pending.push({ query, resolve })));
    await render(<AssistanceScreen />);
    await act(async () => fireEvent.press(await screen.findByText('Đồng bộ tin nhắn')));
    expect(pending).toHaveLength(2);
    await act(async () => pending[0]!.resolve(page(51, 100)));
    await act(async () => fireEvent.changeText(screen.getByLabelText('Tin nhắn hỗ trợ'), 'Keep this draft'));
    await act(async () => fireEvent.press(screen.getByText('Tải tin nhắn cũ')));
    await act(async () => fireEvent.press(screen.getByText('Đồng bộ tin nhắn')));
    const older = pending.find(request => request.query?.before === 51)!;
    const poll = pending.find(request => request.query?.after === 100)!;
    // This late unanchored page must not advance the cursor past unseen 111–150.
    await act(async () => pending[1]!.resolve(page(151, 200)));
    if (completionOrder === 'older-first') {
      await act(async () => older.resolve(page(1, 50)));
      await act(async () => poll.resolve(page(101, 110)));
    } else {
      await act(async () => poll.resolve(page(101, 110)));
      await act(async () => older.resolve(page(1, 50)));
    }
    for (const request of pending.filter(request => request.query?.after !== undefined && request !== poll)) {
      await act(async () => request.resolve(page(request.query!.after! + 1, 200)));
    }
    const items = screen.root!.props.data as MobileConversationMessage[];
    expect(items.map(item => item.serverSequence)).toEqual(Array.from({ length: 200 }, (_, index) => index + 1));
    expect(new Set(items.map(item => item.id)).size).toBe(200);
    expect(screen.getByLabelText('Tin nhắn hỗ trợ').props.value).toBe('Keep this draft');
  }, 15_000);

  it('offers older history when the first populated window follows an empty result', async () => {
    jest.mocked(listConversations).mockResolvedValue([{ id: 'empty-support', status: 'WAITING_SUPPORT', title: 'Empty support' }] as never);
    let finish!: (items: MobileConversationMessage[]) => void;
    jest.mocked(listConversationMessages).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await render(<AssistanceScreen />);
    await screen.findByLabelText('Tin nhắn hỗ trợ');
    await act(async () => finish([]));
    await act(async () => fireEvent.press(screen.getByText('Đồng bộ tin nhắn')));
    await act(async () => finish(Array.from({ length: 50 }, (_, index) => ({
      id: `message-${index + 51}`, conversationId: 'empty-support', clientMessageId: `intent-${index + 51}`,
      serverSequence: index + 51, content: `Message ${index + 51}`, senderType: 'CUSTOMER',
    }))));
    expect(screen.getByText('Tải tin nhắn cũ')).toBeOnTheScreen();
  });

  it('loads older messages without losing the draft and resumes from the last sequence', async () => {
    const conversation = { id: 'paged-support', status: 'WAITING_SUPPORT', title: 'Paged support' };
    const page = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => ({
      id: `message-${from + index}`, serverSequence: from + index, content: `Message ${from + index}`, senderType: 'CUSTOMER',
    }));
    jest.mocked(listConversations).mockResolvedValue([conversation] as never);
    jest.mocked(listConversationMessages).mockImplementation(async (_id, query) => {
      if (query?.before === 51) return page(1, 50) as never;
      if (query?.after === 100) return page(101, 101) as never;
      return page(51, 100) as never;
    });
    await render(<AssistanceScreen />);
    await screen.findByText('Tải tin nhắn cũ');
    await act(async () => fireEvent.changeText(screen.getByLabelText('Tin nhắn hỗ trợ'), 'Keep my draft'));
    await act(async () => fireEvent.press(screen.getByText('Tải tin nhắn cũ')));
    expect(listConversationMessages).toHaveBeenCalledWith(conversation.id, { before: 51, limit: 50 });
    expect(screen.getByLabelText('Tin nhắn hỗ trợ').props.value).toBe('Keep my draft');
    await act(async () => fireEvent.press(screen.getByText('Đồng bộ tin nhắn')));
    expect(listConversationMessages).toHaveBeenCalledWith(conversation.id, { after: 100, limit: 100 });
    expect(screen.getByLabelText('Tin nhắn hỗ trợ').props.value).toBe('Keep my draft');
  });
  it('keeps text composed during a pending send and uses a new intent for the next message', async () => {
    jest.mocked(listConversations).mockResolvedValue([{ id: 'draft-race', status: 'WAITING_SUPPORT', title: 'Draft race' }] as never);
    jest.mocked(listConversationMessages).mockResolvedValue([]);
    let finish!: () => void;
    jest.mocked(appendConversationMessage).mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ serverSequence: 1, content: 'First message' }); })).mockResolvedValue({ serverSequence: 2, content: 'Next draft' });
    await render(<AssistanceScreen />);
    const input = await screen.findByLabelText('Tin nhắn hỗ trợ');
    await act(async () => fireEvent.changeText(input, 'First message'));
    await act(async () => fireEvent.press(screen.getByText('Gửi tin nhắn')));
    await act(async () => fireEvent.changeText(input, 'Next draft'));
    await act(async () => finish());
    expect(screen.getByLabelText('Tin nhắn hỗ trợ').props.value).toBe('Next draft');
    await act(async () => fireEvent.press(screen.getByText('Gửi tin nhắn')));
    expect(appendConversationMessage).toHaveBeenCalledTimes(2);
    expect(jest.mocked(appendConversationMessage).mock.calls[0]?.[1]).not.toBe(jest.mocked(appendConversationMessage).mock.calls[1]?.[1]);
  });
  it.each(['WAITING_SUPPORT', 'AI_ACTIVE'])('creates native support intents without browser crypto (%s)', async status => {
    const browserCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    try {
      jest.mocked(listConversations).mockResolvedValue([{ id: 'native-intent', status, title: 'Native intent' }] as never);
      jest.mocked(listConversationMessages).mockResolvedValue([]);
      jest.mocked(appendConversationMessage).mockReset().mockResolvedValue({ serverSequence: 1, content: 'Native message' });
      jest.mocked(askConversationAi).mockReset().mockResolvedValue({ answer: 'Unavailable', outcome: 'PROVIDER_UNAVAILABLE', grounded: false } as never);
      await render(<AssistanceScreen />);
      await fireEvent.changeText(await screen.findByLabelText('Tin nhắn hỗ trợ'), 'Native message');
      await fireEvent.press(screen.getByText(status === 'AI_ACTIVE' ? 'Hỏi AI có nguồn' : 'Gửi tin nhắn'));
      if (status === 'AI_ACTIVE') expect(askConversationAi).toHaveBeenCalledWith('native-intent', 'Native message', expect.stringMatching(/^[0-9a-f-]{36}$/));
      else expect(appendConversationMessage).toHaveBeenCalledWith('native-intent', expect.stringMatching(/^[0-9a-f-]{36}$/), 'Native message');
    } finally {
      if (browserCrypto) Object.defineProperty(globalThis, 'crypto', browserCrypto);
      else Reflect.deleteProperty(globalThis, 'crypto');
    }
  });
  it('preserves the question and request ID when the AI provider is unavailable', async () => {
    jest.mocked(listConversations).mockResolvedValue([{ id: 'ai-retry', status: 'AI_ACTIVE', title: 'AI retry' }] as never);
    jest.mocked(listConversationMessages).mockResolvedValue([]);
    jest.mocked(askConversationAi).mockResolvedValueOnce({ answer: 'Unavailable', outcome: 'PROVIDER_UNAVAILABLE', grounded: false } as never).mockResolvedValueOnce({ answer: 'Recovered', outcome: 'ANSWERED', grounded: true } as never);
    await render(<AssistanceScreen />);
    await act(async () => fireEvent.changeText(await screen.findByLabelText('Tin nhắn hỗ trợ'), 'My question'));
    await act(async () => fireEvent.press(screen.getByText('Hỏi AI có nguồn')));
    expect(screen.getByLabelText('Tin nhắn hỗ trợ').props.value).toBe('My question');
    await act(async () => fireEvent.press(screen.getByText('Hỏi AI có nguồn')));
    expect(askConversationAi).toHaveBeenCalledTimes(2);
    expect(jest.mocked(askConversationAi).mock.calls[0]?.[2]).toEqual(expect.any(String));
    expect(jest.mocked(askConversationAi).mock.calls[0]?.[2]).toBe(jest.mocked(askConversationAi).mock.calls[1]?.[2]);
  });
  it('hands an AI conversation to human support before enabling human messages', async () => {
    jest.mocked(listConversations).mockResolvedValue([{ id: 'mobile-handoff', status: 'AI_ACTIVE', title: 'Handoff' }] as never);
    jest.mocked(listConversationMessages).mockResolvedValue([]);
    jest.mocked(requestConversationSupport).mockResolvedValue({ id: 'mobile-handoff', status: 'WAITING_SUPPORT', title: 'Handoff' } as never);
    await render(<AssistanceScreen />);
    await screen.findByLabelText('Tin nhắn hỗ trợ');
    expect(screen.queryByText('Gửi tin nhắn')).toBeNull();
    await act(async () => fireEvent.press(screen.getByText('Liên hệ nhân viên hỗ trợ')));
    expect(requestConversationSupport).toHaveBeenCalledWith('mobile-handoff', expect.any(String));
    expect(await screen.findByText('Gửi tin nhắn')).toBeOnTheScreen();
  });

  it('keeps order details available and retries a failed support request', async () => {
    getOrderMock.mockResolvedValue(order);
    jest.mocked(createConversation).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce({ id: 'support-order' } as never);
    const navigate = jest.fn();
    await render(<OrderDetailScreen route={{ params: { id: order.id } } as never} navigation={{ navigate } as never} />);
    await act(async () => fireEvent.press(await screen.findByText('Cần hỗ trợ về đơn này')));
    expect(screen.getByText(order.orderNumber)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Cần hỗ trợ về đơn này')));
    expect(createConversation).toHaveBeenLastCalledWith(`Hỗ trợ đơn ${order.orderNumber}`, order.id);
    expect(navigate).toHaveBeenCalledWith('Assistance', { conversationId: 'support-order' });
  });

  it('clears previous conversation AI answers when opening support for another order', async () => {
    jest.mocked(listConversations).mockResolvedValue([
      { id: 'a', title: 'Order A', status: 'AI_ACTIVE', contextType: 'ORDER' },
      { id: 'b', title: 'Order B', status: 'AI_ACTIVE', contextType: 'ORDER' },
    ] as never);
    jest.mocked(listConversationMessages).mockResolvedValue([]);
    jest.mocked(askConversationAi).mockResolvedValue({ answer: 'Answer for A', grounded: false, citedSourceIds: [] });
    const view = await render(<AssistanceScreen route={{ params: { conversationId: 'a' } } as never} />);
    await act(async () => fireEvent.changeText(await screen.findByLabelText('Tin nhắn hỗ trợ'), 'Question'));
    await act(async () => fireEvent.press(screen.getByText('Hỏi AI có nguồn')));
    expect(await screen.findByText('Answer for A')).toBeOnTheScreen();
    await view.rerender(<AssistanceScreen route={{ params: { conversationId: 'b' } } as never} />);
    await waitFor(() => expect(listConversationMessages).toHaveBeenLastCalledWith('b'));
    expect(screen.queryByText('Answer for A')).toBeNull();
  });

  it('renders the published catalog and opens checkout with the selected plan', async () => {
    listProductsMock.mockResolvedValue([
      {
        id: 'product-1', providerId: 'provider-1', providerDisplayName: 'Provider 1', code: 'DESKTOP',
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

    await act(async () => fireEvent.press(screen.getByText('Tiếp tục')));
    expect(await screen.findByRole('header', { name: 'Điều khoản dịch vụ' })).toBeOnTheScreen();
    expect(createOrderMock).toHaveBeenCalledWith({ planId: 'plan-1' });
  });

  it('blocks accepting terms when loading fails and retries the same order', async () => {
    createOrderMock.mockResolvedValue(order);
    getOrderTermsMock.mockRejectedValueOnce(new Error('terms unavailable')).mockResolvedValueOnce({ content: 'Điều khoản dịch vụ', version: 'v1', hash: 'a'.repeat(64) });
    const navigation = { replace: jest.fn() };
    const route = { params: { planId: 'plan-1', planName: 'Pro', priceVnd: 990_000, productName: 'Emukey Desktop' } };
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
    await act(async () => fireEvent.press(screen.getByText('Tiếp tục')));
    expect(await screen.findByText('1.200.000 ₫')).toBeOnTheScreen();
    expect(screen.getByText(/Giá server đã thay đổi/)).toBeOnTheScreen();
  });

    it.each([
      ['PENDING_ONCHAIN','PENDING_FINALITY',null,'Đang xác nhận blockchain'],
      ['ACTIVE','TRUSTED','PENDING','Đang bàn giao cho nhà cung cấp'],
      ['ACTIVE','TRUSTED','DELIVERED','Nhà cung cấp đã nhận bản quyền'],
      ['ACTIVE','TRUSTED','FAILED','Bàn giao bản quyền cần xử lý. Không thanh toán lại.'],
      ['SUSPENDED','TRUSTED','DELIVERED','Bản quyền tạm ngưng'],
      ['EXPIRED','TRUSTED','DELIVERED','Bản quyền đã hết hạn'],
    ])('shows provider-managed payment progress for %s/%s/%s',async(status,trust,delivery,label)=>{
      getOrderMock.mockResolvedValue({...order,orderStatus:'PAYMENT_ACCEPTED',licenseId:'license-progress'});
      jest.mocked(getLicense).mockResolvedValue({id:'license-progress',fulfillmentMode:'PROVIDER_HANDOFF',status,activationKeyTrustStatus:trust,finality:status==='PENDING_ONCHAIN'?'PENDING_FINALITY':'CHAIN_CONFIRMED',providerDeliveryStatus:delivery,activationKeyAvailable:true,expiresAt:'2030-01-01T00:00:00Z'} as never);
      await render(<PaymentScreen navigation={{navigate:jest.fn()} as never} route={{params:{orderId:order.id}} as never}/>);
      expect(await screen.findByText(label)).toBeOnTheScreen();
      expect(screen.queryByText('Thanh toán trên SePay')).toBeNull();
      expect(screen.queryByText('Đã nhận thanh toán. Hệ thống đang chờ xác nhận bản quyền; không thanh toán lại.')).toBeNull();
      if(status!=='ACTIVE' || delivery!=='DELIVERED') expect(screen.queryByText('Mở danh sách bản quyền để nhận mã hoặc xem mã đã lưu.')).toBeNull();
    });
    it('waits instead of paying again when the previous attempt is uncertain', async () => {
    getOrderMock.mockResolvedValue({ ...order, orderStatus: 'WAITING_PAYMENT' });
    jest.mocked(getPaymentRetryDecision).mockResolvedValue({ allowed: false, canResume: false, reason: 'ATTEMPT_PENDING' });
    await render(<PaymentScreen navigation={{ navigate: jest.fn() } as never} route={{ params: { orderId: order.id } } as never} />);
    expect(await screen.findByText('Đang chờ xác nhận hoặc đối soát thanh toán. Không chuyển tiền thêm.')).toBeOnTheScreen();
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
        id: 'product-1', providerId: 'provider-1', providerDisplayName: 'Provider 1', code: 'DESKTOP',
        name: 'Emukey Desktop',
        plans: [{ billingCycle: 'YEARLY', code: 'PRO', durationMonths: 12, entitlements: {}, id: 'plan-1', maxActiveDevices: 2, name: 'Pro', priceVnd: 990_000 }],
        slug: 'emukey-desktop',
        summary: 'Bản quyền desktop',
      },
      {
        id: 'product-2', providerId: 'provider-1', providerDisplayName: 'Provider 1', code: 'MOBILE',
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
