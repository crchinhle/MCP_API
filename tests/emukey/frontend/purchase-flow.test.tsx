import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../../../EmuKey/frontend/src/application/auth/authContext';
import {
  PurchaseFlowModal,
  submitSignedCheckout,
} from '../../../EmuKey/frontend/src/presentation/components/PurchaseFlowModal';
import type { Product } from '../../../EmuKey/frontend/src/domain/product';
import type { CheckoutSessionDto } from '../../../EmuKey/frontend/src/infrastructure/api/generated';
import { writeCheckoutIntent } from '../../../EmuKey/frontend/src/application/orders/checkoutIntent';

const testOrderId = '00000000-0000-4000-8000-000000000501';

afterEach(cleanup);

const customer = {
  id: 'test-user',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'CUSTOMER',
  status: 'ACTIVE',
};

const testProduct: Product = {
  imageUrl: null,
  slug: 'test-product',
  name: 'Test Product',
  summary: 'Test summary',
  tone: 'neutral',
  plans: [
    { id: 'plan-starter', devices: 1, label: 'Starter', priceVnd: 300000, durationMonths: 1 },
    { id: 'plan-business', devices: 5, label: 'Business', priceVnd: 1800000, durationMonths: 12 },
  ],
};

const singleOfferProduct: Product = { ...testProduct, plans: [testProduct.plans[0]!] };

function requests() {
  return vi.mocked(fetch).mock.calls.map(([input, init]) => ({
    method: (init?.method ?? 'GET').toUpperCase(),
    path: new URL(
      input instanceof Request ? input.url : String(input),
      'http://localhost',
    ).pathname.replace('/api/v1', ''),
    body: typeof init?.body === 'string' ? init.body : null,
  }));
}

function orderCreates() {
  return requests().filter((call) => call.method === 'POST' && call.path === '/orders');
}

function renderModal(props: Partial<React.ComponentProps<typeof PurchaseFlowModal>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const onClose = vi.fn();
  const view = render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider skipBootstrap initialUser={customer}>
          <PurchaseFlowModal onClose={onClose} open product={testProduct} {...props} />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...view, onClose };
}

beforeEach(() => {
  // The fetch mock is installed once for the whole file, so each test must
  // start from an empty call log for call-count assertions to be meaningful.
  vi.mocked(fetch).mockClear();
  document.body.querySelectorAll('form').forEach((form) => form.remove());
});

describe('PurchaseFlowModal offer configuration', () => {
  it('shows a single published offer without a redundant choice control', () => {
    renderModal({ product: singleOfferProduct });

    expect(screen.queryByRole('radio')).toBeNull();
    const summary = screen.getByRole('region', { name: 'Cấu hình gói' });
    expect(within(summary).getByText('Starter')).toBeTruthy();
    expect(within(summary).getByText(/300\.000/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Tiếp tục' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('requires an explicit decision when several offers are published', () => {
    renderModal();
    expect((screen.getByRole('radio', { name: /Starter/ }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('radio', { name: /Business/ }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('button', { name: 'Tiếp tục' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('creates no order while the modal is open', async () => {
    renderModal();
    await screen.findByRole('dialog');
    expect(orderCreates()).toHaveLength(0);
  });

  it('shows the published backend price for every offer and offers no price or quota input', () => {
    renderModal();
    expect(screen.getByText(/300\.000/)).toBeTruthy();
    expect(screen.getByText(/1\.800\.000/)).toBeTruthy();
    expect(document.querySelector('input[type="number"]')).toBeNull();
  });

  it('warns instead of ordering when the product has no published offer', () => {
    renderModal({ product: { ...testProduct, plans: [] } });
    expect(screen.getByText('Sản phẩm chưa có cấu hình được công bố')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Tiếp tục' }) as HTMLButtonElement).disabled).toBe(true);
    expect(orderCreates()).toHaveLength(0);
  });

  it('pre-selects the exact offer passed by the caller (Catalog / Compare entry)', () => {
    renderModal({ initialPlanId: 'plan-business' });
    expect((screen.getByRole('radio', { name: /Business/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('restores the exact stored offer selection when the modal reopens', async () => {
    writeCheckoutIntent(customer.id, {
      orderId: testOrderId,
      planId: 'plan-business',
      productSlug: testProduct.slug,
    });
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const onClose = vi.fn();
    const renderFlow = (open: boolean) => (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider skipBootstrap initialUser={customer}>
            <PurchaseFlowModal open={open} onClose={onClose} product={testProduct} />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
    const { rerender } = render(renderFlow(false));
    rerender(renderFlow(true));

    expect((await screen.findByRole('radio', { name: /Business/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(await screen.findByRole('region', { name: /Điều khoản dịch vụ/ })).toBeTruthy();
    expect(orderCreates()).toHaveLength(0);
  });

  it('resumes the persisted order even if the caller offers a different initial selection', async () => {
    writeCheckoutIntent(customer.id, {
      orderId: testOrderId,
      planId: 'plan-business',
      productSlug: testProduct.slug,
    });
    renderModal({ initialPlanId: 'plan-starter' });

    expect(await screen.findByRole('region', { name: /Điều khoản dịch vụ/ })).toBeTruthy();
    expect(orderCreates()).toHaveLength(0);
  });

  it('honors an explicit order deep link when storage contains another order', async () => {
    writeCheckoutIntent(customer.id, {
      orderId: 'stored-order',
      planId: 'plan-starter',
      productSlug: testProduct.slug,
    });
    renderModal({ resumeOrderId: testOrderId });

    expect(await screen.findByRole('region', { name: /Điều khoản dịch vụ/ })).toBeTruthy();
    expect(orderCreates()).toHaveLength(0);
  });
});

describe('PurchaseFlowModal order creation from Tiếp tục', () => {
  it('creates exactly one order with the selected exact plan ID', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('radio', { name: /Business/ }));
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    await screen.findByRole('region', { name: /Điều khoản dịch vụ/ });
    const creates = orderCreates();
    expect(creates).toHaveLength(1);
    expect(JSON.parse(creates[0]!.body!)).toEqual({ planId: 'plan-business' });
  });

  it('never sends a price, quota or duration chosen by the customer', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('radio', { name: /Starter/ }));
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    await screen.findByRole('region', { name: /Điều khoản dịch vụ/ });

    expect(Object.keys(JSON.parse(orderCreates()[0]!.body!))).toEqual(['planId']);
  });

  it('keeps the modal open with a retryable error when order creation fails', async () => {
    const user = userEvent.setup();
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const path = new URL(
        input instanceof Request ? input.url : String(input),
        'http://localhost',
      ).pathname.replace('/api/v1', '');
      if ((init?.method ?? 'GET').toUpperCase() === 'POST' && path === '/orders') {
        return Promise.resolve({
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ code: 'INTERNAL', message: 'boom' }),
        } as Response);
      }
      return original(input, init);
    });

    renderModal();
    await user.click(screen.getByRole('radio', { name: /Starter/ }));
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Máy chủ đang gặp sự cố');
    // The buyer must not lose the modal, and closing it must stay possible.
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Tiếp tục' }) as HTMLButtonElement).disabled).toBe(false);
    vi.mocked(fetch).mockImplementation(original);
  });
});

async function openTermsStage(user: ReturnType<typeof userEvent.setup>) {
  renderModal();
  await user.click(screen.getByRole('radio', { name: /Business/ }));
  await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
  await screen.findByRole('region', { name: /Điều khoản dịch vụ/ });
}

describe('PurchaseFlowModal terms and payment stage', () => {
  it('loads the exact terms snapshot version and hash of the created order', async () => {
    const user = userEvent.setup();
    await openTermsStage(user);
    await waitFor(() => {
      expect(screen.getByText(/Phiên bản v1/)).toBeTruthy();
      expect(screen.getByText(/Hash a{64}/)).toBeTruthy();
    });
    expect(requests().some((call) => call.method === 'GET' && call.path.endsWith('/service-terms'))).toBe(true);
    expect(orderCreates()).toHaveLength(1);
  });

  it('blocks payment until the terms consent checkbox is checked', async () => {
    const user = userEvent.setup();
    await openTermsStage(user);

    const payButton = await screen.findByRole('button', { name: 'Thanh toán qua SePay' });
    expect((payButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect((payButton as HTMLButtonElement).disabled).toBe(false));
    expect(requests().some((call) => call.method === 'POST' && call.path.endsWith('/checkout'))).toBe(false);
  });

  it('accepts the snapshot version and hash before preparing the checkout', async () => {
    const user = userEvent.setup();
    await openTermsStage(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Thanh toán qua SePay' }));

    await waitFor(() => expect(requests().some((call) => call.method === 'POST' && call.path.endsWith('/checkout'))).toBe(true));
    const calls = requests();
    const acceptanceIndex = calls.findIndex(
      (call) => call.method === 'POST' && call.path.endsWith('/accept-service-terms'),
    );
    const checkoutIndex = calls.findIndex(
      (call) => call.method === 'POST' && call.path.endsWith('/checkout'),
    );
    expect(acceptanceIndex).toBeGreaterThanOrEqual(0);
    expect(acceptanceIndex).toBeLessThan(checkoutIndex);
    expect(JSON.parse(calls[acceptanceIndex]!.body!)).toEqual({ accepted: true, version: 'v1', hash: 'a'.repeat(64) });
    // The former "Tạo yêu cầu thanh toán" step is merged into this single CTA.
    expect(orderCreates()).toHaveLength(1);
  });

  it('never creates a second order when Tiếp tục is pressed again after reopening', async () => {
    const user = userEvent.setup();
    await openTermsStage(user);
    await user.click(screen.getByRole('button', { name: 'Quay lại' }));
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    await screen.findByRole('region', { name: /Điều khoản dịch vụ/ });
    expect(orderCreates()).toHaveLength(1);
  });

  it('does not submit a signed payment form merely by mounting the terms stage', async () => {
    const user = userEvent.setup();
    await openTermsStage(user);
    expect(document.querySelector('form[action^="https://pay-sandbox.sepay.vn"]')).toBeNull();
  });
});

describe('PurchaseFlowModal conflict handling', () => {
  it('warns and blocks payment when the snapshot price no longer matches the published offer', async () => {
    const user = userEvent.setup();
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const path = new URL(
        input instanceof Request ? input.url : String(input),
        'http://localhost',
      ).pathname.replace('/api/v1', '');
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'POST' && path === '/orders') {
        return Promise.resolve({
          ok: true,
          status: 201,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({
            billingCycleSnapshot: 'YEARLY',
            createdAt: '2026-10-01T00:00:00.000Z',
            currency: 'VND',
            customerUserId: 'test-user',
            durationMonthsSnapshot: 12,
            entitlementsSnapshot: {},
            id: '00000000-0000-4000-8000-000000000901',
            maxActiveDevicesSnapshot: 5,
            orderNumber: 'EMU-CONFLICT',
            orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE',
            orderType: 'NEW_PURCHASE',
            paymentDueAt: '2026-10-01T00:30:00.000Z',
            planCommitmentSnapshot: '0x00',
            // Same plan ID, different price: the Provider repriced the offer.
            planId: 'plan-business',
            planNameSnapshot: 'Business',
            planVersionSnapshot: 1,
            priceVndSnapshot: 999_000,
            productId: 'product-1',
            productNameSnapshot: 'Test Product',
            providerNameSnapshot: 'Provider',
            providerUserId: 'provider-1',
          }),
        } as Response);
      }
      return original(input, init);
    });

    renderModal();
    await user.click(screen.getByRole('radio', { name: /Business/ }));
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    expect(await screen.findByText('Cấu hình của đơn không còn khớp với gói đã công bố')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Thanh toán qua SePay' }) as HTMLButtonElement).disabled).toBe(true);
    expect(requests().some((call) => call.method === 'POST' && call.path.endsWith('/checkout'))).toBe(false);
    vi.mocked(fetch).mockImplementation(original);
  });
});

describe('submitSignedCheckout', () => {
  const session: CheckoutSessionDto = {
    amountVnd: 300000,
    attemptId: 'payment-attempt-1',
    checkoutFields: { signature: 'abc123', order_amount: '300000' },
    checkoutMethod: 'POST',
    checkoutReference: 'EMU-TEST-CHECKOUT',
    checkoutUrl: 'https://pay-sandbox.sepay.vn/v1/checkout/init',
    expiresAt: '2026-12-31T00:00:00.000Z',
    expiresWithOrder: true,
  };

  it('creates a hidden self-targeting POST form with exactly the backend fields', () => {
    const form = submitSignedCheckout(session);
    expect(form.method).toBe('post');
    expect(form.action).toBe('https://pay-sandbox.sepay.vn/v1/checkout/init');
    expect(form.target).toBe('_self');
    expect(form.style.display).toBe('none');
    expect(
      Array.from(form.querySelectorAll('input')).map((input) => [input.name, input.value]),
    ).toEqual([
      ['signature', 'abc123'],
      ['order_amount', '300000'],
    ]);
    expect(document.body.contains(form)).toBe(true);
    form.remove();
  });

  it('persists no payment or license secret into browser storage', () => {
    submitSignedCheckout(session);
    const stored = JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } });
    expect(stored).not.toContain('abc123');
    expect(stored).not.toContain('EMU-TEST-CHECKOUT');
    document.body.querySelectorAll('form').forEach((form) => form.remove());
  });
});