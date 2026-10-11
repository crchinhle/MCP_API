import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(cleanup);

describe('W17-W18 Internal consoles', () => {
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
