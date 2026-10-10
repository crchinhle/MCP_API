import { webcrypto } from 'node:crypto';

import { configure } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

configure({ asyncUtilTimeout: 5_000 });
vi.stubGlobal('crypto', webcrypto);

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
    if (method === 'GET' && path === '/notifications') return jsonResponse([]);
    if (method === 'GET' && path === '/knowledge/documents') return jsonResponse([]);
    if (method === 'GET' && path === '/health/ready') return jsonResponse({ status: 'ok', dependencies: { postgres: 'up', redis: 'up', blockchain: 'up' } });
    if (method === 'GET' && path === '/operations/health/assistance') return jsonResponse({ conversations: { supportActive: 0, waitingSupport: 0 }, notifications: { deadLetter: 0, pending: 0, retryableFailed: 0 } });
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
