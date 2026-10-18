import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';
import { AuthProvider } from '../../../EmuKey/frontend/src/application/auth/authContext';
import { AuthScreen } from '../../../EmuKey/frontend/src/presentation/screens/AuthScreen';
import { MemoryRouter } from 'react-router-dom';

afterEach(cleanup);

describe('W17-W18 Internal consoles', () => {
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
      fireEvent.click(within(row).getByRole('button', { name: 'Khóa' }));
      expect(await screen.findByText('Máy chủ đang gặp sự cố. Vui lòng thử lại sau.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Làm mới trạng thái' }));
      await waitFor(() => expect(within(row).getByText('LOCKED')).toBeTruthy());
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
      fireEvent.click(await screen.findByRole('row', { name: /buyer@example.com/ }));
      expect(await screen.findByText('Không thể tải chi tiết tài khoản.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByText('Buyer One')).toBeTruthy();
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
      expect(await screen.findByText('Một số dịch vụ đang gián đoạn hoặc chưa thể kiểm tra.')).toBeTruthy();
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
      expect(await screen.findByText('Không thể chạy đối soát blockchain.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      await waitFor(() => expect(attempts).toBe(2));
      expect(await screen.findByText('Sự kiện đã ghi nhận: 0')).toBeTruthy();
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
