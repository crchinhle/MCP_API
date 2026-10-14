import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(cleanup);

describe('Provider workspace', () => {
  it('does not offer editing a published product', async () => {
    render(<App initialEntries={['/provider/catalog']} />);
    const row = (await screen.findAllByRole('button', { name: 'Sửa' }))[0]!;
    expect((row as HTMLButtonElement).disabled).toBe(true);
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
      const edits = await screen.findAllByRole('button', { name: 'Sửa', exact: true });
      fireEvent.click(edits.find((button) => !(button as HTMLButtonElement).disabled)!);
      const dialog = await screen.findByRole('dialog', { name: 'Sửa sản phẩm' });
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
      const row = (await screen.findByText('Gói tháng')).closest('tr')!;
      fireEvent.click(within(row).getByRole('button', { name: 'Sửa' }));
      const dialog = await screen.findByRole('dialog', { name: 'Sửa gói' });
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
    await screen.findByText(/SEPAY-TX-1/);
    const panel = screen.getByRole('main');
    expect(screen.queryByRole('tab')).toBeNull();
    expect(within(panel).getByText(/SEPAY-TX-1/)).toBeTruthy();
    expect(within(panel).getByText(/sepay-event-1/)).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: /Xử lý|Chấp nhận/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Tìm dữ liệu vận hành'), { target: { value: 'missing-event' } });
    expect(await within(panel).findByText('Không có giao dịch đối chiếu phù hợp.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tìm dữ liệu vận hành'), { target: { value: 'sepay-event-1' } });
    expect(await within(panel).findByText(/SEPAY-TX-1/)).toBeTruthy();
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
      expect(await screen.findByText(`Thiết bị đang dùng: ${activeDeviceCount}/5`)).toBeTruthy();
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
    expect(screen.getByRole('link', { name: 'Hồ sơ' })).toBeTruthy();
    expect(screen.queryByText(/canonical Phase 1-7 API/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'Sản phẩm & gói' })).toBeTruthy();
  });

  it('does not display a local-only knowledge file as uploaded', async () => {
    render(<App initialEntries={['/provider/knowledge']} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Tải tài liệu' }));
    expect(await screen.findByRole('dialog', { name: 'Tải tài liệu kiến thức' })).toBeTruthy();
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

    expect(await screen.findByRole('heading', { name: 'Bản quyền nhà cung cấp' })).toBeTruthy();
    expect(await screen.findByText(/EMU-/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tạm ngưng' }));
    fireEvent.change(await screen.findByLabelText('Lý do thay đổi trạng thái license'), { target: { value: 'Bảo trì định kỳ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText(/Đang chờ xử lý/)).toBeTruthy();
    await waitFor(() => expect(
      vi.mocked(fetch).mock.calls.some(([input]) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        return url.endsWith('/commands/00000000-0000-4000-8000-000000000902');
      }),
    ).toBe(true));
    expect(await screen.findByText('Đã xác nhận')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Hoạt động')).toBeTruthy());
    const licenseReads = () => vi.mocked(fetch).mock.calls.filter(([input, init]) => String(input).endsWith('/licenses') && (!init?.method || init.method === 'GET')).length;
    await waitFor(() => expect(licenseReads()).toBe(3));
    fireEvent.change(screen.getByLabelText('Tìm bản quyền'), { target: { value: 'missing-license' } });
    expect(await screen.findByText('Không có bản quyền phù hợp.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tìm bản quyền'), { target: { value: '' } });
    expect(await screen.findByText('Hoạt động')).toBeTruthy();
    expect(licenseReads()).toBe(3);
  });
});
