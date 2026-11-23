import { webcrypto } from 'node:crypto';

import { configure } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

configure({ asyncUtilTimeout: 5_000 });
vi.stubGlobal('crypto', webcrypto);
// jsdom has no layout/scroll engine; exercise consent focus without a browser scroll.
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });

const testOrderId = '00000000-0000-4000-8000-000000000501';
const acceptedOrderId = '00000000-0000-4000-8000-000000000502';
let createdOrder: { id: string; orderNumber: string; planId: string; planNameSnapshot: string; productNameSnapshot: string; orderStatus: string; priceVndSnapshot: number; paymentDueAt: string; createdAt: string } | undefined;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  createdOrder = undefined;
});

const publicProducts = [
  {
    slug: 'securedesk',
    imageUrl: 'https://picsum.photos/seed/emukey-securedesk/1200/800',
    name: 'SecureDesk Pro',
    summary:
      'Bảo vệ phần mềm desktop, quản lý thiết bị và xác minh giấy phép theo thời gian thực.',
    plans: [
      {
        id: 'securedesk-10',
        name: '10 thiết bị',
        priceVnd: 1_266_500,
        maxActiveDevices: 10,
      },
      {
        id: 'securedesk-25',
        name: '25 thiết bị',
        priceVnd: 2_082_500,
        maxActiveDevices: 25,
      },
    ],
  },
  {
    slug: 'cloudstudio-ai',
    name: 'CloudStudio AI',
    summary: 'Bộ công cụ sáng tạo có trợ lý AI theo ngữ cảnh.',
    plans: [
      {
        id: 'cloudstudio-10',
        name: '10 thiết bị',
        priceVnd: 1_890_000,
        maxActiveDevices: 10,
      },
    ],
  },
  {
    slug: 'dataguard-sdk',
    name: 'DataGuard SDK',
    summary: 'SDK xác thực license cho ứng dụng và API.',
    plans: [
      {
        id: 'dataguard-5',
        name: '5 thiết bị',
        priceVnd: 990_000,
        maxActiveDevices: 5,
      },
    ],
  },
] as const;

const providerProducts = [
  {
    id: 'product-1',
    code: 'securedesk',
    name: 'SecureDesk Pro',
    description: 'Bảo vệ desktop',
    status: 'PUBLISHED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'product-2',
    code: 'draft-tool',
    name: 'Draft Tool',
    description: null,
    status: 'DRAFT',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    publishedAt: null,
  },
] as const;

const providerPlans = [
  {
    id: 'plan-1',
    productId: 'product-1',
    code: 'MONTHLY',
    name: 'Gói tháng',
    billingCycle: 'MONTHLY',
    durationMonths: 1,
    priceVnd: 120_000,
    maxActiveDevices: 2,
    entitlements: { desktop: true },
    status: 'PUBLISHED',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
  },
] as const;

const orders = [
  {
    id: testOrderId,
    orderNumber: 'ORD-2026-0218',
    planId: 'securedesk-25',
    planNameSnapshot: 'Business',
    productNameSnapshot: 'SecureDesk Pro',
    orderStatus: 'WAITING_PAYMENT',
    priceVndSnapshot: 2_082_500,
    paymentDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: '2026-09-30T00:00:00.000Z',
  },
] as const;

const license = {
  activationKeyAvailable: true,
  activationKeyTrustStatus: 'TRUSTED',
  blockNumber: 42,
  confirmationCount: 2,
  createdAt: '2026-09-08T00:00:00.000Z',
  entitlementVersion: 1,
  expiresAt: '2027-09-08T00:00:00.000Z',
  finality: 'CONFIRMED',
  id: '00000000-0000-4000-8000-000000000401',
  keyVersion: 1,
  maxActiveDevices: 3,
  originOrderId: testOrderId,
  periodStart: '2026-09-08T00:00:00.000Z',
  plan: { commitment: `0x${'ab'.repeat(32)}`, name: 'Business', version: 1 },
  productName: 'SecureDesk Pro',
  provider: {
    displayName: 'Emukey Provider',
    organizationName: 'Emukey Software',
  },
  publicLicenseId: 'EMU-TEST-LICENSE',
  status: 'ACTIVE',
  transactionHash: `0x${'cd'.repeat(32)}`,
  updatedAt: '2026-09-08T00:00:00.000Z',
} as const;

const assistanceConversation = {
  assignedSupportUserId: null,
  contextId: null,
  contextType: 'GENERAL',
  customerUserId: 'test-user',
  id: '00000000-0000-4000-8000-000000000701',
  status: 'AI_ACTIVE',
  title: 'Hội thoại hỗ trợ',
};

const assistanceMessages: Array<{
  clientMessageId: string;
  content: string;
  conversationId: string;
  id: string;
  senderType: 'CUSTOMER' | 'SUPPORT' | 'AI';
  serverSequence: number;
}> = [];

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  });
}

vi.stubGlobal(
  'fetch',
  vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.href
          : String(input);
    const path = new URL(url, 'http://localhost').pathname.replace(
      '/api/v1',
      '',
    );
    const method = init?.method?.toUpperCase() ?? 'GET';

    if (path === '/auth/refresh') return jsonResponse(undefined, 401);
    if (path === '/auth/users' && method === 'GET') return jsonResponse([]);
    if (path === '/auth/provider-invitations' && method === 'GET') return jsonResponse([]);
    if (path === '/auth/provider-invitations/inspect' && method === 'POST') return jsonResponse({ email: 'provider@example.test', expiresAt: '2026-10-22T00:00:00Z' });
    if (method === 'GET' && path === '/notifications') return jsonResponse({ items: [], nextCursor: null, unreadCount: 0 });
    if (method === 'GET' && path === '/knowledge/capabilities') return jsonResponse({ maxFileBytes: 10_485_760, allowedMimeTypes: ['application/pdf', 'text/plain'] });
    if (method === 'GET' && path === '/knowledge/documents') return jsonResponse([]);
    if (method === 'GET' && path === '/payments/review') return jsonResponse([]);
    if (method === 'GET' && path === '/health/ready') return jsonResponse({ status: 'ok', dependencies: { postgres: 'up', redis: 'up', blockchain: 'up' } });
    if (method === 'GET' && path === '/operations/health/assistance') return jsonResponse({ conversations: { supportActive: 0, waitingSupport: 0 }, notifications: { deadLetter: 0, pending: 0, retryableFailed: 0 } });
    if (method === 'GET' && path === '/operations/blockchain/status') return jsonResponse({ active_without_finality: 0, pending_events: 0, reorged_events: 0, unknown_commands: 0 });
    if (method === 'POST' && path === '/operations/blockchain/reconcile') return jsonResponse({ health: { active_without_finality: 0, pending_events: 0, reorged_events: 0, unknown_commands: 0 }, indexedEvents: 0, processed: true, projection: { commandRepairs: 0, licenseRepairs: 0, remainingMismatches: 0 }, reconciledCommandIds: [] });
    if (path === '/auth/profile' && method === 'PUT') {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {};
      return jsonResponse({
        id: 'test-user',
        email: 'test@example.com',
        displayName: body.displayName ?? 'Test User',
        phone: body.phone ?? null,
        address: body.address ?? null,
        organizationName: body.organizationName ?? null,
        role: 'CUSTOMER',
        status: 'ACTIVE',
      });
    }
    if (method === 'GET' && path === '/conversations') {
      return jsonResponse([assistanceConversation]);
    }
    if (method === 'GET' && path === `/conversations/${assistanceConversation.id}`) {
      return jsonResponse(assistanceConversation);
    }
    if (method === 'GET' && path === `/conversations/${assistanceConversation.id}/messages`) {
      return jsonResponse(assistanceMessages);
    }
    if (method === 'POST' && path === `/conversations/${assistanceConversation.id}/messages`) {
      const body = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { clientMessageId: string; content: string }
        : { clientMessageId: crypto.randomUUID(), content: '' };
      const message = {
        clientMessageId: body.clientMessageId,
        content: body.content,
        conversationId: assistanceConversation.id,
        id: `message-${assistanceMessages.length + 1}`,
        senderType: 'CUSTOMER' as const,
        serverSequence: assistanceMessages.length + 1,
      };
      assistanceMessages.push(message);
      return jsonResponse(message, 201);
    }
    if (method === 'POST' && path === '/conversations') {
      return jsonResponse(assistanceConversation, 201);
    }
    if (method === 'POST' && path.endsWith('/ai-ask')) {
      return jsonResponse({ answer: 'Không đủ nguồn chính thức để trả lời câu hỏi này.', citedSourceIds: [], grounded: false });
    }
    if (path.startsWith('/auth/')) {
      const authBody = typeof init?.body === 'string'
        ? JSON.parse(init.body) as { email?: string }
        : {};
      return jsonResponse({
        accessToken: 'test-access-token',
        user: {
          id: 'test-user',
          email: authBody.email ?? 'test@example.com',
          displayName: 'Test User',
          role: authBody.email === 'customer@example.com' ? 'CUSTOMER' : 'PROVIDER_ADMIN',
          status: 'ACTIVE',
        },
      });
    }
    if (method === 'GET' && path === '/products')
      return jsonResponse(publicProducts);
    if (
      method === 'GET' &&
      path.startsWith('/products/') &&
      !path.startsWith('/products/admin')
    ) {
      const product = publicProducts.find(
        (item) =>
          item.slug === decodeURIComponent(path.split('/').at(-1) ?? ''),
      );
      return jsonResponse(product, product ? 200 : 404);
    }
    if (method === 'GET' && path === '/products/admin')
      return jsonResponse(providerProducts);
    if (method === 'GET' && path === '/plans')
      return jsonResponse(providerPlans);
    if (method === 'GET' && path === '/plans/compare') {
      const ids = new URL(url, 'http://localhost').searchParams.get('ids')?.split(',') ?? [];
      const catalogPlans: Array<{ id: string; maxActiveDevices: number; name: string; priceVnd: number }> = [];
      for (const product of publicProducts) {
        for (const plan of product.plans) catalogPlans.push(plan);
      }
      const selected = publicProducts.flatMap((product) =>
        product.plans
          .filter((plan) => ids.includes(plan.id))
          .map((plan) => ({
            billingCycle: 'YEARLY',
            id: plan.id,
            name: plan.name,
            productId: `${product.slug}-id`,
            productName: product.name,
            version: 1,
          })),
      );
      return jsonResponse({
        dimensions: [
          {
            key: 'priceVnd',
            label: 'Giá (VND)',
            values: Object.fromEntries(catalogPlans.filter((plan) => ids.includes(plan.id)).map((plan) => [plan.id, plan.priceVnd])),
          },
          {
            key: 'maxActiveDevices',
            label: 'Thiết bị tối đa',
            values: Object.fromEntries(catalogPlans.filter((plan) => ids.includes(plan.id)).map((plan) => [plan.id, plan.maxActiveDevices])),
          },
        ],
        plans: selected,
      });
    }
    if (method === 'GET' && path.endsWith('/service-terms'))
      return jsonResponse({ content: '# EmuKey Service Terms\n\nThese are the platform Service Terms.', version: 'v1', hash: 'a'.repeat(64) });
    if (method === 'GET' && path === '/orders') return jsonResponse(createdOrder ? [createdOrder] : orders);
    if (method === 'GET' && path === '/payments/history') {
      return jsonResponse([
        {
          amountVnd: 2_082_500,
          classification: 'MATCHED',
          orderId: testOrderId,
          orderNumber: 'ORD-2026-0218',
          orderType: 'NEW_PURCHASE',
          planNameSnapshot: 'Business',
          productNameSnapshot: 'SecureDesk Pro',
          providerEventId: 'sepay-event-1',
          providerOccurredAt: '2026-09-30T00:00:00.000Z',
          providerTransactionReference: 'SEPAY-TX-1',
          receivedAt: '2026-09-30T00:00:00.000Z',
          reviewStatus: null,
          transactionId: 'payment-transaction-1',
        },
      ]);
    }
    if (method === 'GET' && path.startsWith('/orders/renewal-preview/'))
      return jsonResponse({ licenseId: license.id, planId: orders[0].planId, planName: 'Business', productName: license.productName,
        durationMonths: 12, priceVnd: 2_500_000, currentExpiresAt: license.expiresAt, estimatedExpiresAt: '2028-09-08T00:00:00.000Z', canRenew: true, pendingOrder: null });
    if (method === 'GET' && path.endsWith('/payment-retry'))
      return jsonResponse({ allowed: true, reason: 'READY' });
    if (method === 'GET' && path.startsWith('/orders/'))
      return jsonResponse(path.endsWith(acceptedOrderId)
        ? { ...orders[0], id: acceptedOrderId, licenseId: license.id, orderStatus: 'PAYMENT_ACCEPTED' }
        : path.endsWith(testOrderId) && createdOrder ? createdOrder : orders[0]);
    if (method === 'POST' && path === '/orders') {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as { planId?: string } : {};
      const plan = publicProducts.flatMap((product) => product.plans).find((item) => item.id === body.planId);
      createdOrder = {
        ...orders[0],
        planId: body.planId ?? orders[0].planId,
        planNameSnapshot: plan?.name ?? orders[0].planNameSnapshot,
        priceVndSnapshot: plan?.priceVnd ?? ({ 'plan-starter': 300_000, 'plan-business': 1_800_000 }[body.planId ?? ''] ?? orders[0].priceVndSnapshot),
        orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE',
      };
      return jsonResponse(createdOrder, 201);
    }
    if (method === 'POST' && path.endsWith('/accept-service-terms'))
      return jsonResponse({ ...(createdOrder ?? orders[0]), orderStatus: 'WAITING_PAYMENT' });
    if (method === 'POST' && path.endsWith('/checkout'))
      return jsonResponse(
        {
          amountVnd: (createdOrder ?? orders[0]).priceVndSnapshot,
          attemptId: 'payment-attempt-1',
          checkoutFields: {
            currency: 'VND',
            merchant: 'SP-TEST-EMUKEY',
            operation: 'PURCHASE',
            order_amount: String(orders[0].priceVndSnapshot),
            order_invoice_number: 'EMU-TEST-CHECKOUT',
            signature: 'sandbox-signature',
          },
          checkoutMethod: 'POST',
          checkoutReference: 'EMU-TEST-CHECKOUT',
          checkoutUrl: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
          expiresAt: orders[0].paymentDueAt,
          expiresWithOrder: true,
        },
        200,
      );
    if (method === 'POST' && path.endsWith('/cancel')) {
      return jsonResponse({ ...orders[0], orderStatus: 'CANCELLED' });
    }
    if (method === 'POST' && path === '/licenses/action-verification/resolve') return jsonResponse({ action: 'KEY_RECOVERY', licenseId: license.id, deviceId: null, expiresAt: new Date(Date.now() + 900_000).toISOString() });
    if (method === 'POST' && path === '/licenses/action-verification') return jsonResponse({ accepted: true });
    if (method === 'POST' && path === `/licenses/${license.id}/activation-key/recover`) return jsonResponse({ commandId: '00000000-0000-4000-8000-000000000903', deviceId: null, licenseId: license.id, status: 'PENDING' }, 201);
    if (method === 'GET' && path === '/commands/00000000-0000-4000-8000-000000000903') return jsonResponse({ commandId: '00000000-0000-4000-8000-000000000903', commandType: 'ROTATE_KEY', confirmedAt: null, deviceId: null, licenseId: license.id, status: 'PENDING', transactionHash: null });
    if (method === 'GET' && path === '/licenses') return jsonResponse([license]);
    if (method === 'GET' && path === `/licenses/${license.id}`) return jsonResponse(license);
    if (method === 'GET' && path === `/licenses/${license.id}/devices`) return jsonResponse([]);
    if (method === 'POST' && path.endsWith('/lifecycle')) return jsonResponse({ commandId: '00000000-0000-4000-8000-000000000902', deviceId: null, licenseId: license.id, status: 'PENDING' }, 201);
    if (method === 'GET' && path === '/commands/00000000-0000-4000-8000-000000000902') {
      return jsonResponse({
        commandId: '00000000-0000-4000-8000-000000000902',
        commandType: 'SUSPEND_LICENSE',
        confirmedAt: '2026-09-15T00:00:00.000Z',
        deviceId: null,
        licenseId: license.id,
        status: 'CONFIRMED',
        transactionHash: '0x' + '34'.repeat(32),
      });
    }
    if (method === 'POST' && path.endsWith('/activation-key/retrieve')) {
      return jsonResponse(
        { activationKey: '0x' + '12'.repeat(32), keyVersion: 1 },
        201,
      );
    }
    if (method === 'GET' && path.startsWith('/public/licenses/')) {
      const publicId = decodeURIComponent(path.split('/')[3] ?? '');
      if (publicId === 'EMU-FULL-LIFECYCLE-001') {
        return jsonResponse({
          state: 'CHAIN_CONFIRMED',
          licenseId: 'EMU-FULL-LIFECYCLE-001',
          status: 'ACTIVE',
          productName: 'Classroom Hub Business',
          plan: { name: 'Enterprise', version: 1, commitment: `0x${'ab'.repeat(32)}` },
          provider: { displayName: 'Classroom Hub', organizationName: 'Classroom Hub Corp' },
          periodStart: '2026-11-10T02:30:00.000Z',
          expiresAt: '2028-11-10T02:30:00.000Z',
          maxActiveDevices: 5,
          activeDeviceCount: 2,
          keyVersion: 3,
          matchedBy: 'HISTORICAL_ROTATED_KEY',
          matchedKeyVersion: 1,
          finality: 'CONFIRMED',
          confirmationCount: 18,
          blockNumber: 11842900,
          transactionHash: `0x${'e5'.repeat(32)}`,
          network: 'sepolia',
          chainId: 11155111,
          contractAddress: '0x4d30200f3d0791e0ae34fa6075a4e4b03f4d1cbc',
          rpcStatus: 'VERIFIED',
          historySource: 'ONCHAIN_VERIFIED',
          historyComplete: true,
          history: [
            {
              id: 'evt-1',
              eventType: 'LICENSE_ISSUED',
              title: 'Kích hoạt bản quyền',
              description: 'License được kích hoạt lần đầu.',
              status: 'CONFIRMED',
              occurredAt: '2026-11-10T02:30:00.000Z',
              blockTimestamp: '2026-11-10T02:30:12.000Z',
              transactionHash: `0x${'11'.repeat(32)}`,
              blockNumber: 11842400,
              logIndex: 0,
              confirmationCount: 50,
              commandId: 'cmd-1',
              commandSequence: 1,
              network: 'sepolia',
              chainId: 11155111,
              contractAddress: '0x4d30200f3d0791e0ae34fa6075a4e4b03f4d1cbc',
              explorerTxUrl: `https://sepolia.etherscan.io/tx/0x${'11'.repeat(32)}`,
              changes: [
                {
                  field: 'status',
                  label: 'Trạng thái bản quyền',
                  previousValue: 'Đang chờ xác nhận (PENDING_ONCHAIN)',
                  currentValue: 'Đang hoạt động (ACTIVE)',
                },
              ],
            },
            {
              id: 'evt-2',
              eventType: 'ACTIVE_DEVICE_COUNT_SYNCED',
              title: 'Cập nhật thiết bị kích hoạt',
              description: 'Đồng bộ tăng số lượng thiết bị đang hoạt động trên Blockchain: 0/5 → 2/5 thiết bị.',
              status: 'CONFIRMED',
              occurredAt: '2026-11-12T07:15:00.000Z',
              blockTimestamp: '2026-11-12T07:15:12.000Z',
              transactionHash: `0x${'22'.repeat(32)}`,
              blockNumber: 11842500,
              logIndex: 2,
              confirmationCount: 40,
              commandId: 'cmd-2',
              commandSequence: 2,
              changes: [
                {
                  field: 'activeDeviceCount',
                  label: 'Số lượng thiết bị hoạt động',
                  previousValue: '0/5 thiết bị',
                  currentValue: '2/5 thiết bị',
                },
              ],
            },
            {
              id: 'evt-3',
              eventType: 'KEY_ROTATED',
              title: 'Cấp lại License Key',
              description: 'Khóa cũ v1 đã bị vô hiệu hóa và thay bằng Key v2.',
              status: 'CONFIRMED',
              occurredAt: '2026-11-15T03:20:00.000Z',
              blockTimestamp: '2026-11-15T03:20:12.000Z',
              transactionHash: `0x${'33'.repeat(32)}`,
              blockNumber: 11842600,
              logIndex: 1,
              confirmationCount: 30,
              commandId: 'cmd-3',
              commandSequence: 3,
              changes: [
                {
                  field: 'keyVersion',
                  label: 'Phiên bản License Key',
                  previousValue: 'Phiên bản Key v1',
                  currentValue: 'Phiên bản Key v2',
                },
              ],
            },
            {
              id: 'evt-4',
              eventType: 'LICENSE_RENEWED',
              title: 'Gia hạn bản quyền',
              description: 'Gia hạn thêm 12 tháng.',
              status: 'CONFIRMED',
              occurredAt: '2026-11-16T07:05:00.000Z',
              blockTimestamp: '2026-11-16T07:05:12.000Z',
              transactionHash: `0x${'44'.repeat(32)}`,
              blockNumber: 11842800,
              logIndex: 0,
              confirmationCount: 20,
              commandId: 'cmd-4',
              commandSequence: 4,
              changes: [
                {
                  field: 'expiresAt',
                  label: 'Ngày hết hạn',
                  previousValue: '2027-11-10T02:30:00.000Z',
                  currentValue: '2028-11-10T02:30:00.000Z',
                },
              ],
            },
            {
              id: 'evt-5',
              eventType: 'LICENSE_SUSPENDED',
              title: 'Tạm khóa bản quyền',
              description: 'Tạm khóa theo yêu cầu bảo trì.',
              status: 'CONFIRMED',
              occurredAt: '2026-11-17T01:00:00.000Z',
              blockTimestamp: '2026-11-17T01:00:12.000Z',
              transactionHash: `0x${'55'.repeat(32)}`,
              blockNumber: 11842850,
              logIndex: 1,
              confirmationCount: 15,
              commandId: 'cmd-5',
              commandSequence: 5,
              changes: [],
            },
            {
              id: 'evt-6',
              eventType: 'LICENSE_RESUMED',
              title: 'Khôi phục bản quyền',
              description: 'Khôi phục hoạt động bản quyền.',
              status: 'PENDING',
              occurredAt: '2026-11-18T04:00:00.000Z',
              blockTimestamp: null,
              transactionHash: `0x${'66'.repeat(32)}`,
              blockNumber: null,
              logIndex: null,
              confirmationCount: 0,
              commandId: 'cmd-6',
              commandSequence: 6,
              changes: [],
            },
          ],
        });
      }
      return jsonResponse(
        publicId === license.publicLicenseId
          ? {
              blockNumber: license.blockNumber,
              confirmationCount: license.confirmationCount,
              expiresAt: license.expiresAt,
              finality: license.finality,
              licenseId: license.publicLicenseId,
              plan: license.plan,
              productName: license.productName,
              provider: license.provider,
              state: 'CHAIN_CONFIRMED',
              status: license.status,
              transactionHash: license.transactionHash,
            }
          : { state: 'NOT_FOUND' },
      );
    }
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      return jsonResponse(providerProducts[0]);
    }
    return jsonResponse(undefined, 404);
  }),
);

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn(),
  })),
  writable: true,
});

class ResizeObserverStub implements ResizeObserver {
  disconnect = vi.fn();

  observe = vi.fn();

  unobserve = vi.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverStub,
  writable: true,
});
Object.defineProperty(globalThis, 'ResizeObserver', {
  configurable: true,
  value: ResizeObserverStub,
  writable: true,
});
