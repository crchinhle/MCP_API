import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(cleanup);

describe('Provider workspace', () => {
  it('keeps notification pagination available in other workspaces', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = new URL(String(input), 'http://localhost');
      if (url.pathname.endsWith('/notifications')) {
        if (url.searchParams.has('limit')) return Promise.resolve(Response.json({ message: 'limit must be an integer number' }, { status: 400 }));
        const next = url.searchParams.has('cursor');
        return Promise.resolve(Response.json({ items: [{ id: next ? 'notice-2' : 'notice-1', title: next ? 'Thông báo tiếp theo' : 'Thông báo mới', content: 'Nội dung thông báo', isRead: true }], nextCursor: next ? null : 'next-page' }));
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/support']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Thông báo', exact: true }));
      expect(await screen.findByText('Thông báo mới')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Xem thêm thông báo' }));
      expect(await screen.findByText('Thông báo tiếp theo')).toBeTruthy();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });
  it('does not offer editing a published product', async () => {
    render(<App initialEntries={['/provider/catalog']} />);
    const row = (await screen.findByRole('button', { name: 'SecureDesk Pro' })).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /Thao tác/ }));
    expect((await screen.findByRole('menuitem', { name: 'Sửa' })).getAttribute('aria-disabled')).toBe('true');
  });
  it('confirms deleting a draft and refreshes the product list', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let deleted = false;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/products/product-2') && init?.method === 'DELETE') {
        deleted = true;
        return Response.json({ deleted: true });
      }
      const response = await original(input, init);
      if (deleted && String(input).endsWith('/products/admin') && (!init?.method || init.method === 'GET')) {
        return Response.json((await response.json()).filter((item: { id: string }) => item.id !== 'product-2'));
      }
      return response;
    });
    try {
      render(<App initialEntries={['/provider/catalog?status=DRAFT']} />);
      const row = (await screen.findByRole('button', { name: 'Draft Tool' })).closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Thao tác/ }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Xóa bản nháp' }));
      // Ant Design's test runtime reuses `test-id` for Select and dialog labels.
      // Browser tests check accessible names with the runtime's real unique IDs.
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Xóa sản phẩm nháp?')).toBeTruthy();
      expect(deleted).toBe(false);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa' }));
      await waitFor(() => expect(deleted).toBe(true));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Draft Tool' })).toBeNull());
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('applies the license status from dashboard links', async () => {
    render(<App initialEntries={['/provider/licenses?status=PENDING_ONCHAIN']} />);
    await screen.findByRole('heading', { name: 'Bản quyền', exact: true });
    expect(await screen.findByText('Không tìm thấy bản quyền phù hợp')).toBeTruthy();
    expect(screen.queryByText('EMU-TEST-LICENSE')).toBeNull();
  });

  it('opens license details without exposing activation keys or device identifiers', async () => {
    render(<App initialEntries={['/provider/licenses']} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Chi tiết bản quyền')).toBeTruthy();
    expect(within(dialog).getAllByText('EMU-TEST-LICENSE')[0]).toBeTruthy();
    expect(within(dialog).queryByText(/activationKey|fingerprint/)).toBeNull();
  });

  it('filters matched payments out of the dashboard exceptions link', async () => {
    render(<App initialEntries={['/provider/operations?classification=exceptions']} />);
    expect(await screen.findByText('Không có giao dịch đối soát phù hợp.')).toBeTruthy();
    expect(screen.queryByText('ORD-2026-0218')).toBeNull();
  });

  it('excludes resolved and closed exceptions from the review queue', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const response = await original(input, init);
      if (String(input).endsWith('/payments/history')) {
        const [payment] = await response.json();
        return Response.json(['RESOLVED', 'CLOSED_NO_ACTION', 'OPEN'].map((reviewStatus, index) => ({ ...payment, transactionId: `review-${index}`, orderNumber: `REVIEW-${index}`, classification: 'AMOUNT_MISMATCH', reviewStatus })));
      }
      return response;
    });
    try {
      render(<App initialEntries={['/provider/operations?classification=exceptions']} />);
      expect(await screen.findByText('REVIEW-2')).toBeTruthy();
      expect(screen.queryByText('REVIEW-0')).toBeNull();
      expect(screen.queryByText('REVIEW-1')).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('distinguishes older document versions from a new version awaiting approval', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => String(input).endsWith('/knowledge/documents')
      ? Promise.resolve(Response.json([1, 2, 3].map((version) => ({ id: `document-${version}`, title: `Hướng dẫn v${version}`, logicalDocumentKey: 'guide', version, status: 'READY', isCurrent: version === 2 }))))
      : original(input, init));
    try {
      render(<App initialEntries={['/provider/knowledge']} />);
      const previous = (await screen.findByRole('button', { name: 'Hướng dẫn v1' })).closest('tr')!;
      const current = screen.getByRole('button', { name: 'Hướng dẫn v2' }).closest('tr')!;
      const waiting = screen.getByRole('button', { name: 'Hướng dẫn v3' }).closest('tr')!;
      expect(within(previous).getByText('Phiên bản cũ')).toBeTruthy();
      expect(within(current).getByText('Đã công bố')).toBeTruthy();
      expect(within(waiting).getByText('Chờ duyệt')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Công bố' })).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });
  it('submits an HTTPS product image on the existing draft', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let submitted: Record<string, unknown> | undefined;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/products/product-2') && init?.method === 'PUT') {
        submitted = JSON.parse(String(init.body));
        return Response.json(submitted);
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/provider/catalog']} />);
      const row = (await screen.findByRole('button', { name: 'Draft Tool' })).closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: /Thao tác/ }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Sửa', exact: true }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Sửa sản phẩm')).toBeTruthy();
      fireEvent.change(within(dialog).getByLabelText('Ảnh sản phẩm (URL HTTPS)'), { target: { value: 'https://example.com/product.png' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
      await waitFor(() => expect(submitted?.imageUrl).toBe('https://example.com/product.png'));
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('preserves advanced entitlements when saving without expanding the editor', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let submitted: Record<string, unknown> | undefined;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/plans') && (!init?.method || init.method === 'GET')) {
        const plans = await (await original(input, init)).json();
        return Response.json(plans.map((plan: Record<string, unknown>) => ({ ...plan, status: 'DRAFT', entitlements: { desktop: true, seats: 5, support: { tier: 'priority', regions: ['vn', null] } } })));
      }
      if (String(input).endsWith('/plans/plan-1') && init?.method === 'PUT') {
        submitted = JSON.parse(String(init.body));
        return Response.json(submitted);
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/provider/catalog']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'SecureDesk Pro' }));
      const row = (await screen.findByText('Gói tháng')).closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: 'Sửa' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Sửa gói')).toBeTruthy();
      expect(within(dialog).getByRole('switch').getAttribute('aria-checked')).toBe('true');
      expect(within(dialog).getByLabelText('Thời hạn (tháng)')).toHaveProperty('readOnly', true);
      expect(within(dialog).getByLabelText('Thời hạn (tháng)')).toHaveProperty('value', '1');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu' }));
      await waitFor(() => expect(submitted?.entitlements).toEqual({ desktop: true, seats: 5, support: { tier: 'priority', regions: ['vn', null] } }));
      await waitFor(() => expect(dialog.closest('.ant-modal')?.className).toContain('ant-zoom-leave'));
      expect(screen.queryByText('Bỏ thay đổi chưa lưu?')).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('shows searchable transaction evidence in reconciliation without admin actions', async () => {
    render(<App initialEntries={['/provider/operations']} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem', exact: true }));
    const panel = screen.getByRole('main');
    const detail = await screen.findByRole('dialog');
    expect(within(detail).getByText('Chi tiết giao dịch')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(within(detail).getByText(/SEPAY-TX-1/)).toBeTruthy();
    expect(within(detail).getByText(/sepay-event-1/)).toBeTruthy();
    fireEvent.click(within(detail).getByRole('button', { name: /Close|Đóng/ }));
    expect(within(panel).queryByRole('button', { name: /Xử lý|Chấp nhận/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Tìm dữ liệu vận hành'), { target: { value: 'missing-event' } });
    expect(await within(panel).findByText('Không có giao dịch đối soát phù hợp.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tìm dữ liệu vận hành'), { target: { value: 'sepay-event-1' } });
    expect(await within(panel).findByText('ORD-2026-0218')).toBeTruthy();
  });

  it.each([0, 2])('shows device usage %s on the license row', async (activeDeviceCount) => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const response = await original(input, init);
      if (String(input).endsWith('/licenses')) {
        const licenses = await response.json();
        return Response.json(licenses.map((license: Record<string, unknown>) => ({ ...license, activeDeviceCount, maxActiveDevices: 5 })));
      }
      return response;
    });
    try {
      render(<App initialEntries={['/provider/licenses']} />);
      expect(await screen.findByText(`${activeDeviceCount}/5`)).toBeTruthy();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('retries loading provider plan data independently from products', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let fail = true;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (fail && url.endsWith('/plans') && (!init?.method || init.method === 'GET')) {
        fail = false;
        return Response.json({ message: 'Unavailable' }, { status: 500 });
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/provider/catalog']} />);
      expect(await screen.findByText('Không thể tải danh sách gói.')).toBeTruthy();
      fireEvent.click(screen.getAllByRole('button', { name: 'Thử lại' }).at(-1)!);
      expect((await screen.findAllByRole('table')).length).toBeGreaterThan(0);
      await waitFor(() => expect(screen.queryByText('Không thể tải danh sách gói.')).toBeNull());
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });
  it('renders the provider dashboard without fabricated aggregates', async () => {
    render(<App initialEntries={['/provider']} />);

    expect(
      await screen.findByRole('heading', { name: 'Tổng quan nhà cung cấp' }),
    ).toBeTruthy();
    expect(screen.getByText('EmuKey').className).toContain('brand-wordmark');
    fireEvent.click(screen.getByRole('button', { name: /Mở menu tài khoản/ }));
    expect(await screen.findByRole('menuitem', { name: /Hồ sơ tài khoản/ })).toBeTruthy();
    expect(screen.queryByText(/canonical Phase 1-7 API/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'Sản phẩm & gói' })).toBeTruthy();
  });

  it('does not display a local-only knowledge file as uploaded', async () => {
    render(<App initialEntries={['/provider/knowledge']} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Tải tài liệu lên' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Tải tài liệu sản phẩm')).toBeTruthy();
    const file = new File(['demo'], 'huong-dan-demo.pdf', {
      type: 'application/pdf',
    });
    const picker = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(picker).toBeTruthy();
    fireEvent.change(picker!, { target: { files: [file] } });
    expect(await screen.findByText('Đã chọn: huong-dan-demo.pdf')).toBeTruthy();
    expect(screen.getByText('Chưa có tài liệu kiến thức phù hợp.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Công bố' })).toBeNull();
  });

  it('retries loading provider payment history after a temporary failure', async () => {
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
      render(<App initialEntries={['/provider/operations']} />);
      expect(await screen.findByText('Không thể tải lịch sử thanh toán.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByText(/ORD-2026-0218/)).toBeTruthy();
      expect(screen.getByText('Đã khớp')).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('retries loading AI knowledge documents after a temporary failure', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let fail = true;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (fail && new URL(url, 'http://localhost').pathname.endsWith('/api/v1/knowledge/documents') && (!init?.method || init.method === 'GET')) {
        fail = false;
        return Response.json({ message: 'Unavailable' }, { status: 500 });
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/provider/knowledge']} />);
      expect(await screen.findByText('Không thể tải tài liệu kiến thức.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByText('Chưa có tài liệu kiến thức phù hợp.')).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('exposes license lifecycle controls in the Provider workspace', async () => {
    vi.mocked(fetch).mockClear();
    render(<App initialEntries={['/provider/licenses']} />);

    expect(await screen.findByRole('heading', { name: 'Bản quyền', exact: true })).toBeTruthy();
    expect(await screen.findByText(/EMU-/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Thao tác bản quyền/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Tạm ngưng bản quyền' }));
    fireEvent.change(await screen.findByLabelText('Lý do tạm ngưng'), { target: { value: 'Bảo trì định kỳ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạm ngưng' }));
    expect(await screen.findByText(/Đang chờ xử lý/)).toBeTruthy();
    await waitFor(() => expect(
      vi.mocked(fetch).mock.calls.some(([input]) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        return url.endsWith('/commands/00000000-0000-4000-8000-000000000902');
      }),
    ).toBe(true));
    expect(await screen.findByText('Đã xác nhận')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Có hiệu lực')).toBeTruthy());
    const licenseReads = () => vi.mocked(fetch).mock.calls.filter(([input, init]) => String(input).endsWith('/licenses') && (!init?.method || init.method === 'GET')).length;
    await waitFor(() => expect(licenseReads()).toBeGreaterThanOrEqual(3));
    fireEvent.change(screen.getByLabelText('Tìm bản quyền'), { target: { value: 'missing-license' } });
    expect(await screen.findByText('Không tìm thấy bản quyền phù hợp')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tìm bản quyền'), { target: { value: '' } });
    expect(await screen.findByText('Có hiệu lực')).toBeTruthy();
    expect(licenseReads()).toBeGreaterThanOrEqual(3);
  }, 60_000);
});
