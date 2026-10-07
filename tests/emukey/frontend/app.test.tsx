import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';
import { AuthProvider } from '../../../EmuKey/frontend/src/application/auth/authContext';
import { AuthScreen } from '../../../EmuKey/frontend/src/presentation/screens/AuthScreen';

afterEach(cleanup);

describe('Emukey public web screens', () => {
  it.each([
    ['/buyer', 'Bản quyền và đơn hàng của bạn'],
    ['/provider', 'Tổng quan nhà cung cấp'],
    ['/system/console', 'Tổng quan hệ thống'],
  ])('hides unfinished page content while initial data loads at %s', async (path, heading) => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    vi.mocked(fetch).mockImplementation(async (input, init) => { await pending; return original(input, init); });
    try {
      render(<App initialEntries={[path]} />);
      expect(screen.queryByRole('heading', { name: heading })).toBeNull();
      expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toBeTruthy();
      await act(async () => { release(); });
      expect(await screen.findByRole('heading', { name: heading })).toBeTruthy();
      expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).toBeNull();
    } finally {
      cleanup();
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it.each([
    ['CUSTOMER', '/buyer/checkout?product=DEMO_CLASSROOM_PRO&planId=classroom-plan', '/buyer/checkout?product=DEMO_CLASSROOM_PRO&planId=classroom-plan'],
    ['CUSTOMER', '', '/'],
    ['CUSTOMER', 'https://example.com', '/'],
    ['CUSTOMER', '//example.com', '/'],
    ['PROVIDER_ADMIN', '/buyer/checkout?product=DEMO_CLASSROOM_PRO&planId=classroom-plan', '/provider'],
  ])('resumes an authenticated %s at the appropriate destination for redirect %s', async (role, redirect, expected) => {
    function Destination() {
      const location = useLocation();
      return <output aria-label="Destination">{location.pathname}{location.search}</output>;
    }
    render(
      <AuthProvider skipBootstrap initialUser={{ id: 'test-user', email: 'test@example.com', displayName: 'Test User', role, status: 'ACTIVE' }}>
        <MemoryRouter initialEntries={[`/auth?mode=login&redirect=${encodeURIComponent(redirect)}`]}>
          <Routes>
            <Route path="/auth" element={<AuthScreen />} />
            <Route path="*" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );
    expect((await screen.findByLabelText('Destination')).textContent).toBe(expected);
  });

  it('provides public guides without requiring login to read them', () => {
    render(<App initialEntries={['/help']} />);
    expect(screen.getByRole('heading', { name: 'Hướng dẫn sử dụng EmuKey' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '3. Nhận mã và kích hoạt phần mềm' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '5. Xác minh công khai' })).toBeTruthy();
  });

  it('prefills the reset token and confirms successful password reset', async () => {
    render(<App initialEntries={['/auth?mode=reset&token=reset-token-example']} />);
    expect(screen.getByLabelText('Mã đặt lại mật khẩu')).toHaveProperty('value', 'reset-token-example');
    fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: 'SecurePassword@123' } });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu mới'), { target: { value: 'SecurePassword@123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));
    expect(await screen.findByText('Đã đặt lại mật khẩu')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Đăng nhập bằng mật khẩu mới' })).toBeTruthy();
  });
  it('keeps the AI assistant launcher available across routes', async () => {
    render(<App initialEntries={['/verify']} />);
    const launcher = screen.getByRole('button', { name: 'Mở chat chăm sóc khách hàng' });
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(launcher);
    expect(await screen.findByRole('region', { name: 'Trợ lý AI Emukey' })).toBeTruthy();
  });

  it('offers customer registration and navigates to the catalog', async () => {
    render(<App initialEntries={['/auth']} />);
    expect(screen.getByRole('heading', { name: 'Quản lý bản quyền phần mềm đa Provider bằng Blockchain' })).toBeTruthy();
    expect(screen.getByText('Quản lý License và thiết bị')).toBeTruthy();
    expect(screen.getByText('Theo dõi đơn hàng và thanh toán')).toBeTruthy();
    expect(screen.getByText('Xác minh công khai trên Blockchain')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng ký' })).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Về trang chủ EmuKey' }));
    expect(await screen.findByText('SecureDesk Pro')).toBeTruthy();
  });

  it('keeps a license action token through customer login and opens License Hub', async () => {
    render(<App initialEntries={['/auth?mode=licensing-action&token=action-token-123']} />);

    expect(screen.getByRole('heading', { name: 'Xác nhận thao tác License' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'customer@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Emu@1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập và tiếp tục' }));

    expect(await screen.findByRole('heading', { name: 'Bản quyền & thiết bị' })).toBeTruthy();
    expect(screen.getByLabelText('Mã xác nhận khôi phục')).toHaveProperty('value', 'action-token-123');
  });

  it('rejects a weak password for login', async () => {
    render(<App initialEntries={['/auth']} />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'provider@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'emu@1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Chào mừng trở lại' })).toBeTruthy();
  });

  it('registers a Customer account without sending a backup key', async () => {
    render(<App initialEntries={['/auth']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));
    fireEvent.change(screen.getByLabelText('Họ và tên'), { target: { value: 'Khách hàng mới' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'buyer@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Emu@1234' } });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), { target: { value: 'Emu@1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    expect(await screen.findByRole('heading', { name: 'Xác minh email' })).toBeTruthy();
    const registrationCall = vi.mocked(fetch).mock.calls.find(
      ([input, init]) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        return url.endsWith('/auth/register') && init?.method === 'POST';
      },
    );
    const body = registrationCall?.[1]?.body;
    if (typeof body !== 'string') throw new Error('Registration body missing');
    expect(JSON.parse(body)).toEqual({
      customerType: 'INDIVIDUAL',
      displayName: 'Khách hàng mới',
      email: 'buyer@example.com',
      password: 'Emu@1234',
    });
  });

  it('renders the public catalog API and filters by search text', async () => {
    render(<App initialEntries={['/products']} />);
    expect(await screen.findByText('SecureDesk Pro')).toBeTruthy();
    expect(await screen.findByText('CloudStudio AI')).toBeTruthy();
    expect(await screen.findByText('DataGuard SDK')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tìm sản phẩm'), { target: { value: 'cloud' } });
    expect(screen.getByText('CloudStudio AI')).toBeTruthy();
    expect(screen.queryByText('DataGuard SDK')).toBeNull();
  });

  it('shows the generic forgot-password response for internal accounts', async () => {
    render(<App initialEntries={['/auth']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }));
    expect(await screen.findByRole('heading', { name: 'Quên mật khẩu' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'unknown@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi hướng dẫn' }));
    expect(await screen.findByText('Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu đã được gửi.')).toBeTruthy();
    expect(screen.queryByText('unknown@example.com')).toBeNull();
  });

  it('opens a product and renders published plan data', async () => {
    render(<App initialEntries={['/products/securedesk']} />);
    expect(await screen.findByRole('heading', { name: 'SecureDesk Pro' })).toBeTruthy();
    const artwork = screen.getByRole('img', { name: 'Minh họa SecureDesk Pro' });
    expect(artwork.tagName).toBe('IMG');
    expect(artwork.getAttribute('src')).toBe('https://picsum.photos/seed/emukey-securedesk/1200/800');
    expect(screen.getByRole('combobox', { name: 'Gói' })).toBeTruthy();
    expect(screen.getAllByText('10 thiết bị').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Mua ngay' })).toBeTruthy();
  });

  it('compares published plans through the canonical comparison API', async () => {
    render(<App initialEntries={['/compare?ids=securedesk-10,securedesk-25']} />);

    expect(await screen.findByRole('heading', { name: 'So sánh gói bản quyền' })).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'Bảng so sánh gói' })).toBeTruthy();
    expect(screen.getByText('1.266.500 ₫')).toBeTruthy();
    expect(screen.getAllByText('25 thiết bị').length).toBeGreaterThan(0);
  });
});
