import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';
import { orderStatusLabel } from '../../../EmuKey/frontend/src/application/orders/orderQueries';
import { OrderSummary } from '../../../EmuKey/frontend/src/presentation/components/OrderSummary';

afterEach(cleanup);

describe('Customer commerce', () => {
  it('shows a retryable error without placeholder metrics when initial home data fails', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let fail = true;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (fail && url.endsWith('/orders') && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ message: 'Unavailable' }), { status: 500 });
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/buyer']} />);
      expect(await screen.findByText('Không thể tải dữ liệu trang chủ.')).toBeTruthy();
      expect(screen.queryByRole('region', { name: 'Tóm tắt tài khoản' })).toBeNull();
      fail = false;
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByRole('region', { name: 'Tóm tắt tài khoản' })).toBeTruthy();
    } finally {
      cleanup();
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('keeps disabled, zero and structured entitlements in the purchase snapshot', () => {
    render(<OrderSummary order={{ total: 100000, entitlements: { desktop: false, quota: 0, limits: { seats: 2 } } }} />);
    expect(screen.getByText(/Ứng dụng máy tính: Không/)).toBeTruthy();
    expect(screen.getByText(/quota: 0/)).toBeTruthy();
    expect(screen.getByText(/limits: \{"seats":2\}/)).toBeTruthy();
  });
  it('reuses the order idempotency key when retrying a lost response', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const keys: (string | null)[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/orders') && init?.method === 'POST') {
        keys.push(new Headers(init.headers).get('Idempotency-Key'));
        if (keys.length === 1) throw new TypeError('Response lost');
      }
      return original(input, init);
    });
try {
      render(<App initialEntries={['/buyer/checkout?product=securedesk&planId=securedesk-25']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục' }));
      await screen.findByRole('alert');
      fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
      await screen.findByRole('region', { name: /Điều khoản dịch vụ/ });
      expect(keys).toHaveLength(2);
      expect(keys[0]).toBeTruthy();
      expect(keys[1]).toBe(keys[0]);
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });
  it('labels cancelled and expired orders separately from terms acceptance', () => {
    expect(orderStatusLabel({ orderStatus: 'CANCELLED' })).toBe('Đã hủy');
    expect(orderStatusLabel({ orderStatus: 'EXPIRED' })).toBe('Đã hết hạn');
    expect(orderStatusLabel({ orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE' })).toBe('Chờ đồng ý điều khoản');
  });
  it('renders the authenticated Customer home from real API arrays', async () => {
    render(<App initialEntries={['/buyer']} />);

    expect(await screen.findByRole('region', { name: 'Tóm tắt tài khoản' })).toBeTruthy();
    expect(await screen.findByText('Đơn hàng gần đây')).toBeTruthy();
    expect(screen.getByText('Thiết bị đang dùng')).toBeTruthy();
    expect(screen.getByText('Sắp hết hạn trong 30 ngày')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Lối tắt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mở danh mục' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xác minh ngay' })).toBeTruthy();
  });

  it('creates the server snapshot only after explicit intent and asks for Terms acceptance', async () => {
    vi.mocked(fetch).mockClear();
    render(<App initialEntries={['/buyer/checkout?product=securedesk&planId=securedesk-25']} />);

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Đơn hàng chỉ được tạo sau khi bạn xác nhận cấu hình/i)).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.filter(([input, init]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return url.endsWith('/orders') && init?.method === 'POST';
    })).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(await screen.findByRole('region', { name: /Điều khoản dịch vụ/ })).toBeTruthy();
    expect(screen.getByText(/platform Service Terms/i)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /đồng ý với đúng phiên bản điều khoản/i })).toBeTruthy();
  });

  it('creates an order after explicit intent and Terms acceptance and opens payment', async () => {
    vi.mocked(fetch).mockClear();
    render(<App initialEntries={['/buyer/checkout?product=securedesk&planId=securedesk-25']} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục' }));
    fireEvent.click(
      await screen.findByRole('checkbox', {
        name: /đồng ý với đúng phiên bản điều khoản/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Thanh toán qua SePay' }),
    );

    expect(await screen.findByRole('dialog')).toBeTruthy();
    const acceptance = vi.mocked(fetch).mock.calls.find(([input]) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).endsWith('/accept-service-terms'));
    expect(JSON.parse(typeof acceptance?.[1]?.body === 'string' ? acceptance[1].body : '{}')).toEqual({ accepted: true, version: 'v1', hash: 'a'.repeat(64) });
  });

  it('renders the signed SePay checkout as a POST form', async () => {
    render(
      <App
        initialEntries={[
          '/buyer/orders/11111111-1111-4111-8111-111111111111/payment',
        ]}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Tạo yêu cầu thanh toán' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu thanh toán' }));
    const form = await screen.findByTestId('sepay-checkout-form');
    expect(form.getAttribute('action')).toBe(
      'https://pay-sandbox.sepay.vn/v1/checkout/init',
    );
    expect(form.getAttribute('method')).toBe('post');
    expect(
      screen.getByRole('button', { name: 'Thanh toán trên SePay Sandbox' }),
    ).toBeTruthy();
    expect(
      form.querySelector<HTMLInputElement>('input[name="signature"]')?.value,
    ).toBe('sandbox-signature');
  });

  it.each(['cancel', 'error'])('offers an explicit retry after SePay %s without auto checkout', async (status) => {
    vi.mocked(fetch).mockClear();
    render(<App initialEntries={['/buyer/orders/11111111-1111-4111-8111-111111111111/payment?sepay=' + status]} />);
    expect(await screen.findByRole('button', { name: 'Thanh toán lại' })).toBeTruthy();
    expect(screen.queryByText('Đang xác nhận thanh toán')).toBeNull();
    expect(vi.mocked(fetch).mock.calls.filter(([input]) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).endsWith('/checkout'))).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán lại' }));
    expect(await screen.findByRole('button', { name: 'Tạo yêu cầu thanh toán' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu thanh toán' }));
    expect(await screen.findByTestId('sepay-checkout-form')).toBeTruthy();
  });

  it('continues from accepted payment to trusted license without retrieving a key automatically', async () => {
    render(
      <App
        initialEntries={[
          '/buyer/orders/00000000-0000-4000-8000-000000000502/payment',
        ]}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Bản quyền đã sẵn sàng' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nhận mã bản quyền' })).toBeTruthy();
    expect(screen.queryByText('0x' + '12'.repeat(32))).toBeNull();
    expect(
      vi.mocked(fetch).mock.calls.filter(([input, init]) =>
        (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('/activation-key/retrieve') &&
        init?.method === 'POST',
      ),
    ).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Nhận mã bản quyền' }));
    expect(await screen.findByLabelText('Mã bản quyền')).toBeTruthy();
    const keyInput = screen.getByLabelText('Mã bản quyền') as HTMLInputElement;
    const retrievedKey = keyInput.value;
    const keyDialog = keyInput.closest('.ant-modal');
    expect(keyDialog).toBeTruthy();
    fireEvent.click((keyDialog as HTMLElement).querySelector('button.ant-btn-primary')!);
    expect(await screen.findByRole('button', { name: 'Xem mã bản quyền' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Thanh toán đơn hàng' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xem mã bản quyền' }));
    expect((await screen.findByLabelText('Mã bản quyền') as HTMLInputElement).value).toBe(retrievedKey);
  });

  it('creates a renewal order without asking for or sending the license secret', async () => {
    vi.mocked(fetch).mockClear();
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const response = await original(input, init);
      if ((typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).endsWith('/orders/00000000-0000-4000-8000-000000000501') && !init?.method) {
        return Response.json({ ...await response.json() as Record<string, unknown>, orderStatus: 'WAITING_SERVICE_TERMS_ACCEPTANCE' });
      }
      return response;
    });
    try {
    render(
      <App
        initialEntries={[
          '/buyer/licenses/00000000-0000-4000-8000-000000000401/renew',
        ]}
      />,
    );

    const create = await screen.findByRole('button', { name: 'Tạo đơn gia hạn' });
    expect(screen.getByText('2.500.000 ₫')).toBeTruthy();
    fireEvent.click(create);

    expect(
      await screen.findByRole('heading', { name: 'Điều khoản gia hạn' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Gia hạn bản quyền' })).toBeTruthy();
    const request = vi.mocked(fetch).mock.calls.find(([input, init]) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).endsWith('/orders') && init?.method === 'POST');
    expect(request).toBeTruthy();
    expect(new Headers(request?.[1]?.headers).has('X-License-Key')).toBe(false);
    expect(screen.queryByLabelText('Mã bản quyền hiện tại')).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it.each(['WAITING_PAYMENT', 'PAYMENT_ACCEPTED'])('resumes an existing renewal in %s without creating another order', async (orderStatus) => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let creates = 0;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.endsWith('/orders') && init?.method === 'POST') creates++;
      const response = await original(input, init);
      const pendingOrder = { id: '00000000-0000-4000-8000-000000000501', orderType: 'RENEWAL', orderStatus, priceVndSnapshot: 2_082_500, planNameSnapshot: 'Business', durationMonthsSnapshot: 12 };
      if (url.includes('/renewal-preview/')) return Response.json({ ...await response.json(), pendingOrder });
      if (url.endsWith('/orders/' + pendingOrder.id) && !init?.method) return Response.json({ ...await response.json(), ...pendingOrder });
      return response;
    });
    try {
      render(<App initialEntries={['/buyer/licenses/00000000-0000-4000-8000-000000000401/renew']} />);
      expect(await screen.findByRole('button', { name: orderStatus === 'WAITING_PAYMENT' ? 'Tiếp tục thanh toán' : 'Theo dõi gia hạn' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Tạo đơn gia hạn' })).toBeNull();
      expect(screen.getByText('2.082.500 ₫')).toBeTruthy();
      expect(creates).toBe(0);
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('disables creating a renewal for an unavailable offer', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const response = await original(input, init);
      return (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).includes('/renewal-preview/') ? Response.json({ ...await response.json(), canRenew: false }) : response;
    });
    try {
      render(<App initialEntries={['/buyer/licenses/00000000-0000-4000-8000-000000000401/renew']} />);
      expect((await screen.findByRole<HTMLButtonElement>('button', { name: 'Tạo đơn gia hạn' })).disabled).toBe(true);
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });
});
