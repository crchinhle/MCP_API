import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';
import { AuthProvider } from '../../../EmuKey/frontend/src/application/auth/authContext';
import { AuthScreen } from '../../../EmuKey/frontend/src/presentation/screens/AuthScreen';
import { MemoryRouter } from 'react-router-dom';

afterEach(cleanup);

describe('W17-W18 Internal consoles', () => {
  it.each(['users', 'payments', 'blockchain'])('keeps %s independent of health endpoints and duplicate navigation', async (view) => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const healthRequests: string[] = [];
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes('/health/')) { healthRequests.push(url); return new Promise(() => {}); }
      return original(input, init);
    });
    try {
      render(<App initialEntries={[`/system/console?view=${view}`]} />);
      expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
      expect(screen.queryByRole('navigation', { name: 'Điều hướng quản trị hệ thống' })).toBeNull();
      expect(screen.queryByRole('region', { name: 'Sức khỏe hệ thống' })).toBeNull();
      expect(healthRequests).toEqual([]);
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('offers the system account actions in one accessible menu', async () => {
    render(<App initialEntries={['/system/console']} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở menu tài khoản Test User' }));
    expect(await screen.findByRole('menuitem', { name: /Hồ sơ tài khoản/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: /Đổi mật khẩu/ }));
    expect(await screen.findByRole('dialog', { name: 'Đổi mật khẩu' })).toBeTruthy();
  });

  it('does not submit an unchanged system profile and retains edits after failure', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => String(input).endsWith('/auth/profile') && init?.method === 'PUT'
      ? Promise.resolve(Response.json({}, { status: 500 })) : original(input, init));
    try {
      render(<App initialEntries={['/system/console/profile']} />);
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Lưu thay đổi' }).disabled).toBe(true);
      fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Changed Admin' } });
      await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Lưu thay đổi' }).disabled).toBe(false));
      fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(screen.getByLabelText<HTMLInputElement>('Tên hiển thị').value).toBe('Changed Admin');
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Lưu thay đổi' }).disabled).toBe(false);
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });
  it('can switch from an existing admin session to provider login after activation', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let signedOut = false;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/auth/provider-invitations/accept')) return Response.json({ id: 'provider-1', role: 'PROVIDER_ADMIN', status: 'ACTIVE' });
      if (url.endsWith('/auth/logout')) { signedOut = true; return new Response(null, { status: 204 }); }
      return original(input, init);
    });
    try {
      render(<MemoryRouter initialEntries={[`/auth?mode=provider-invite&token=${'a'.repeat(43)}`]}><AuthProvider skipBootstrap initialUser={{ id: 'admin-1', email: 'admin@example.test', displayName: 'Admin', role: 'SYSTEM_ADMIN', status: 'ACTIVE' }}><AuthScreen /></AuthProvider></MemoryRouter>);
      fireEvent.change(await screen.findByLabelText('Mật khẩu mới'), { target: { value: 'Provider-test@123' } });
      fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), { target: { value: 'Provider-test@123' } });
      fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt tài khoản Provider' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Đăng nhập bằng tài khoản Provider' }));
      expect(await screen.findByRole('heading', { name: 'Chào mừng trở lại' })).toBeTruthy();
      expect(signedOut).toBe(true);
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });
  it('lets the System Admin email a provider invitation without setting a password', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let payload: Record<string, unknown> | undefined;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/auth/provider-invitations')) {
        if (init?.method === 'POST') { payload = JSON.parse(String(init.body)); return Response.json({ id: 'invite-1', email: payload!.email }); }
        return Response.json([]);
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console?view=users']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Mời nhà cung cấp' }));
      const dialog = screen.getByRole('dialog');
      for (const [label, value] of [
        ['Email nhà cung cấp', 'provider@example.test'], ['Tên người đại diện', 'Provider Owner'],
        ['Tên tổ chức', 'Provider Ltd'], ['Địa chỉ EVM công khai', `0x${'ab'.repeat(20)}`], ['Namespace nhà cung cấp', 'provider-ltd'],
      ]) fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
      expect(within(dialog).queryByLabelText('Mật khẩu')).toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Gửi lời mời' }));
      await waitFor(() => expect(payload?.email).toBe('provider@example.test'));
      expect(payload).not.toHaveProperty('password');
      expect(payload).not.toHaveProperty('role');
      expect(await screen.findByText('Đã gửi email mời nhà cung cấp.')).toBeTruthy();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('lets an invited provider set a password and activate without an existing session', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let activation: unknown;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/auth/provider-invitations/accept')) {
        activation = JSON.parse(String(init?.body));
        return Response.json({ id: 'provider-1', role: 'PROVIDER_ADMIN', status: 'ACTIVE' });
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={[`/auth?mode=provider-invite&token=${'a'.repeat(43)}`]} />);
      fireEvent.change(await screen.findByLabelText('Mật khẩu mới'), { target: { value: 'Provider-test@123' } });
      fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), { target: { value: 'Provider-test@123' } });
      fireEvent.click(screen.getByRole('button', { name: 'Kích hoạt tài khoản Provider' }));
      await waitFor(() => expect(activation).toEqual({ token: 'a'.repeat(43), password: 'Provider-test@123' }));
      expect(await screen.findByText('Tài khoản Provider đã được kích hoạt. Bạn có thể đăng nhập.')).toBeTruthy();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });
  it('renders an empty support queue when the real API has no conversations', () => {
    render(<App initialEntries={['/support']} />);
    expect(screen.queryByText('Người mua #B204')).toBeNull();
  });

  it('does not display fabricated audit entries', () => {
    render(<App initialEntries={['/system/console']} />);
    expect(screen.queryByText('BLOCKCHAIN_RETRY')).toBeNull();
  });

  it('separates open payment work from closed review evidence on the overview', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => String(input).endsWith('/payments/review')
      ? Promise.resolve(Response.json([{ id: 'open', reviewStatus: 'OPEN' }, { id: 'closed', reviewStatus: 'RESOLVED' }])) : original(input, init));
    try {
      render(<App initialEntries={['/system/console']} />);
      const work = await screen.findByRole('region', { name: 'Công việc cần xử lý' });
      await waitFor(() => expect(within(work).getByText('1')).toBeTruthy());
      expect(within(work).getByRole('link', { name: 'Kiểm tra thanh toán' })).toHaveProperty('search', '?view=payments');
      expect(screen.queryByText('ok')).toBeNull();
      expect(screen.queryByText('up')).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('keeps closed payment reviews available as evidence without presenting them as open work', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => String(input).endsWith('/payments/review')
      ? Promise.resolve(Response.json([{ id: 'closed', providerEventId: 'CLOSED-EVENT', amountVnd: 10000, classification: 'AMOUNT_MISMATCH', reviewStatus: 'RESOLVED', reviewReason: 'Đã đối chiếu ngân hàng', receivedAt: '2026-10-21T00:00:00Z', providerOccurredAt: '2026-10-21T00:00:00Z' }])) : original(input, init));
    try {
      render(<App initialEntries={['/system/console?view=payments']} />);
      expect(await screen.findByText('Không có giao dịch cần kiểm tra')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Kiểm tra giao dịch' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Lịch sử rà soát' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết rà soát' }));
      expect(await screen.findByText('Đã đối chiếu ngân hàng')).toBeTruthy();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('marks only the selected query-string section active', async () => {
    const { container } = render(<App initialEntries={['/system/console?view=users']} />);
    await screen.findByRole('heading', { name: 'Quản lý người dùng' });
    const active = container.querySelectorAll('.role-desktop-nav a.active');
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toBe('Người dùng');
  });

  it('retries loading the System Admin account list after a temporary failure', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let fail = true;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (fail && url.endsWith('/auth/users') && (!init?.method || init.method === 'GET')) {
        fail = false;
        return Response.json({ message: 'Unavailable' }, { status: 500 });
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console?view=users']} />);
      expect(await screen.findByText('Máy chủ đang gặp sự cố. Vui lòng thử lại sau.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByRole('heading', { name: 'Quản lý người dùng' })).toBeTruthy();
      expect(await screen.findByRole('table')).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('refreshes account state after a failed mutation instead of resubmitting it', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let locked = false;
    let mutationAttempts = 0;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/auth/users') && (!init?.method || init.method === 'GET')) {
        return Response.json([{ id: 'account-1', email: 'buyer@example.com', displayName: 'Buyer One', role: 'CUSTOMER', status: locked ? 'LOCKED' : 'ACTIVE' }]);
      }
      if (url.endsWith('/auth/users/account-1/lock') && init?.method === 'POST') {
        mutationAttempts++;
        locked = true;
        return Response.json({ message: 'Response lost' }, { status: 500 });
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console?view=users']} />);
      const row = await screen.findByRole('row', { name: /buyer@example.com/ });
      fireEvent.click(within(row).getByRole('button', { name: /Thao tác tài khoản/ }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Khóa' }));
      expect(mutationAttempts).toBe(0);
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Khóa', exact: true }));
      expect(await screen.findByText('Máy chủ đang gặp sự cố. Vui lòng thử lại sau.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Làm mới trạng thái' }));
      await waitFor(() => expect(within(row).getByText('Đã khóa')).toBeTruthy());
      expect(mutationAttempts).toBe(1);
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('retries loading System account details after a temporary failure', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let fail = true;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/auth/users')) {
        return Response.json([{ id: 'account-1', email: 'buyer@example.com', displayName: 'Buyer One', role: 'CUSTOMER', status: 'ACTIVE' }]);
      }
      if (fail && url.endsWith('/auth/users/account-1') && (!init?.method || init.method === 'GET')) {
        fail = false;
        return Response.json({ message: 'Unavailable' }, { status: 500 });
      }
      if (url.endsWith('/auth/users/account-1')) {
        return Response.json({ id: 'account-1', email: 'buyer@example.com', displayName: 'Buyer One', role: 'CUSTOMER', status: 'ACTIVE' });
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console?view=users']} />);
      fireEvent.click(within(await screen.findByRole('row', { name: /buyer@example.com/ })).getByRole('button', { name: 'Xem chi tiết' }));
      expect(await screen.findByText('Không thể tải chi tiết tài khoản.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await within(screen.getByRole('dialog')).findByText('Buyer One')).toBeTruthy();
      expect(screen.getAllByText('buyer@example.com')).toHaveLength(2);
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('retries System readiness checks after a temporary failure', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let fail = true;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (fail && url.endsWith('/health/ready') && (!init?.method || init.method === 'GET')) {
        fail = false;
        return Response.json({ message: 'Unavailable' }, { status: 500 });
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console']} />);
      expect(await screen.findByText('Không thể truy vấn tình trạng dịch vụ.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByText('Tình trạng dịch vụ')).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('retries a failed System blockchain reconciliation on explicit request', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let attempts = 0;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/operations/blockchain/reconcile') && init?.method === 'POST' && ++attempts === 1) {
        return Response.json({ message: 'Unavailable' }, { status: 500 });
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console?view=blockchain']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Chạy đối soát' }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Chạy đối soát', exact: true }));
      expect(await screen.findByText('Không thể chạy đối soát blockchain.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Chạy đối soát', exact: true }));
      await waitFor(() => expect(attempts).toBe(2));
      expect(await screen.findByRole('region', { name: 'Kết quả đối soát' })).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('retries loading System payment history after a temporary failure', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let fail = true;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (fail && new URL(url, 'http://localhost').pathname.endsWith('/api/v1/payments/history') && (!init?.method || init.method === 'GET')) {
        fail = false;
        return Response.json({ message: 'Unavailable' }, { status: 500 });
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console?view=payments']} />);
      expect(await screen.findByText('Không thể tải lịch sử thanh toán.')).toBeTruthy();
      fireEvent.click(screen.getAllByRole('button', { name: 'Thử lại' }).at(-1)!);
      expect(await screen.findByText('ORD-2026-0218')).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('retries loading System assistance health after a temporary failure', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let fail = true;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (fail && url.endsWith('/operations/health/assistance') && (!init?.method || init.method === 'GET')) {
        fail = false;
        return Response.json({ message: 'Unavailable' }, { status: 500 });
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console']} />);
      expect(await screen.findByText('Không thể tải tình trạng thông báo và hỗ trợ.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByText('Tình trạng dịch vụ')).toBeTruthy();
      await waitFor(() => expect(screen.queryByText('Không thể tải tình trạng thông báo và hỗ trợ.')).toBeNull());
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('makes provider licenses reachable from navigation', async () => {
    render(<App initialEntries={['/provider']} />);
    expect(await screen.findByRole('link', { name: 'Bản quyền' })).toHaveProperty('pathname', '/provider/licenses');
  });
});
