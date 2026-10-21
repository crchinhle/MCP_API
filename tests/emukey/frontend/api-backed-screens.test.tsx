import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(cleanup);

describe('API-backed workspace screens', () => {
  it('loads Provider knowledge documents from the API', async () => {
    render(<App initialEntries={['/provider/knowledge']} />);

    expect(await screen.findByText('Chưa có tài liệu kiến thức phù hợp.')).toBeTruthy();
    expect(screen.queryByLabelText('Sản phẩm của tài liệu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tải tài liệu lên' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Tải tài liệu sản phẩm')).toBeTruthy();
    expect(screen.getByLabelText('Sản phẩm của tài liệu')).toBeTruthy();
  });

  it('loads System work counts without querying infrastructure readiness', async () => {
    render(<App initialEntries={['/system/console']} />);

    expect(await screen.findByText('Không có công việc đang chờ xử lý')).toBeTruthy();
    expect(await screen.findByText('Chưa có lời mời đang chờ.')).toBeTruthy();
    expect(screen.queryByText('Yêu cầu hỗ trợ')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Sức khỏe hệ thống' })).toBeNull();
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes('/health/'))).toBe(false);
  });

  it('counts complete accounts, active Provider admins and distinct current published documents', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const accounts = [
      { id: 'p1', email: 'active@example.com', displayName: 'Active Provider', role: 'PROVIDER_ADMIN', status: 'ACTIVE' },
      { id: 'p2', email: 'locked@example.com', displayName: 'Locked Provider', role: 'PROVIDER_ADMIN', status: 'LOCKED' },
      { id: 'c1', email: 'buyer@example.com', displayName: 'Buyer', role: 'CUSTOMER', status: 'ACTIVE' },
    ];
    const documents = [
      { id: 'old', providerUserId: 'p1', productId: 'product-1', logicalDocumentKey: 'guide', title: 'Old guide', version: 1, status: 'READY', isCurrent: false },
      { id: 'current', providerUserId: 'p1', productId: 'product-1', logicalDocumentKey: 'guide', title: 'Published guide', version: 2, status: 'READY', isCurrent: true },
      { id: 'duplicate', providerUserId: 'p1', productId: 'product-1', logicalDocumentKey: 'guide', title: 'Duplicate current guide', version: 2, status: 'READY', isCurrent: true },
      { id: 'other-provider', providerUserId: 'p2', productId: 'product-1', logicalDocumentKey: 'guide', title: 'Other published guide', version: 1, status: 'READY', isCurrent: true },
      { id: 'pending', providerUserId: 'p1', productId: 'product-1', logicalDocumentKey: 'guide', title: 'Pending guide', version: 3, status: 'READY', isCurrent: false },
      { id: 'processing', providerUserId: 'p1', productId: 'product-1', logicalDocumentKey: 'new', title: 'Processing guide', version: 1, status: 'PROCESSING', isCurrent: false },
    ];
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/users')) return Promise.resolve(Response.json(accounts));
      if (url.endsWith('/knowledge/documents')) return Promise.resolve(Response.json(documents));
      if (url.endsWith('/payments/review')) return Promise.resolve(Response.json([{ id: 'r1', reviewStatus: 'OPEN' }, { id: 'r2', reviewStatus: 'CLOSED' }]));
      if (url.endsWith('/auth/provider-invitations')) return Promise.resolve(Response.json([
        { id: 'i1', email: 'one@example.com', status: 'PENDING', sentAt: null, createdAt: '2026-10-21T00:00:00Z', expiresAt: '2026-10-22T00:00:00Z' },
        { id: 'i2', email: 'two@example.com', status: 'EXPIRED', sentAt: null, createdAt: '2026-10-19T00:00:00Z', expiresAt: '2026-10-20T00:00:00Z' },
        { id: 'i3', email: 'three@example.com', status: 'ACCEPTED', sentAt: null, createdAt: '2026-10-19T00:00:00Z', expiresAt: '2026-10-20T00:00:00Z' },
      ]));
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console']} />);
      expect(await screen.findByLabelText('Tổng tài khoản: 3')).toBeTruthy();
      expect(await screen.findByLabelText('Tài khoản quản trị nhà cung cấp: 1')).toBeTruthy();
      expect(await screen.findByLabelText('Tài liệu đã công bố: 2')).toBeTruthy();
      expect(await screen.findByLabelText('Tài liệu chờ duyệt: 1')).toBeTruthy();
      expect(await screen.findByLabelText('Thanh toán cần kiểm tra: 1')).toBeTruthy();
      expect(await screen.findByLabelText('Đang chờ chấp nhận: 1')).toBeTruthy();
      expect(await screen.findByLabelText('Hết hạn: 1')).toBeTruthy();
      expect(await screen.findByLabelText('Đã chấp nhận: 1')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Quản lý lời mời →' }).getAttribute('href')).toBe('/system/console?view=users#provider-invitations');
      fireEvent.click(screen.getByRole('link', { name: 'Xem nhà cung cấp →' }));
      const users = await screen.findByRole('region', { name: 'Danh sách người dùng' });
      expect(await within(users).findByText('Active Provider')).toBeTruthy();
      expect(within(users).queryByText('Locked Provider')).toBeNull();
      expect(within(users).queryByText('Buyer')).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('shows source failures with retry instead of zero or a successful empty state', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let failing = true;
    vi.mocked(fetch).mockImplementation((input, init) => /\/(auth\/users|knowledge\/documents|payments\/review|auth\/provider-invitations)$/.test(String(input))
      ? Promise.resolve(failing ? Response.json({}, { status: 500 }) : Response.json([])) : original(input, init));
    try {
      render(<App initialEntries={['/system/console']} />);
      expect(await screen.findByLabelText('Tổng tài khoản: —')).toBeTruthy();
      expect(await screen.findByLabelText('Tài liệu đã công bố: —')).toBeTruthy();
      expect(await screen.findByText('Không thể tải lời mời nhà cung cấp.')).toBeTruthy();
      expect(screen.getAllByRole('button', { name: /Thử lại/ }).length).toBeGreaterThanOrEqual(4);
      expect(screen.queryByText('Không có công việc đang chờ xử lý')).toBeNull();
      expect(screen.queryByText('Chưa có lời mời đang chờ.')).toBeNull();
      expect(screen.queryByLabelText('Tổng tài khoản: 0')).toBeNull();
      failing = false;
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại: Tổng tài khoản' }));
      expect(await screen.findByLabelText('Tổng tài khoản: 0')).toBeTruthy();
      expect(screen.queryByText('Không có công việc đang chờ xử lý')).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('keeps skeletons and withholds successful empty states while sources are loading', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => /\/(auth\/users|knowledge\/documents|payments\/review|auth\/provider-invitations)$/.test(String(input))
      ? new Promise(() => {}) : original(input, init));
    try {
      render(<App initialEntries={['/system/console']} />);
      expect(await screen.findByRole('status', { name: 'Đang tải tổng tài khoản' })).toBeTruthy();
      expect(screen.getByRole('status', { name: 'Đang tải lời mời' })).toBeTruthy();
      expect(screen.queryByText('Không có công việc đang chờ xử lý')).toBeNull();
      expect(screen.queryByText('Chưa có lời mời đang chờ.')).toBeNull();
      expect(screen.queryByLabelText('Tổng tài khoản: 0')).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('opens the published document filter from its dashboard link', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => String(input).endsWith('/knowledge/documents') ? Promise.resolve(Response.json([
      { id: 'published', providerUserId: 'p1', logicalDocumentKey: 'guide', title: 'Published guide', version: 1, status: 'READY', isCurrent: true },
      { id: 'pending', providerUserId: 'p1', logicalDocumentKey: 'next', title: 'Pending guide', version: 1, status: 'READY', isCurrent: false },
    ])) : original(input, init));
    try {
      render(<App initialEntries={['/system/console']} />);
      fireEvent.click(await screen.findByRole('link', { name: 'Xem tài liệu →' }));
      expect(await screen.findByRole('button', { name: 'Published guide' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Pending guide' })).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });
});
