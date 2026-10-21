import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../EmuKey/frontend/src/presentation/app/App';
import { ProviderLicenseId } from '../../../EmuKey/frontend/src/presentation/components/ProviderLicenseSummary';

afterEach(cleanup);

function licenseResponse(transform: (rows: Record<string, unknown>[]) => unknown) {
  const original = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const response = await original(input, init);
    return String(input).endsWith('/licenses') && (!init?.method || init.method === 'GET')
      ? Response.json(transform(await response.json())) : response;
  });
  return () => vi.mocked(fetch).mockImplementation(original);
}

describe('Provider license management', () => {
  it('copies the full public ID by clicking the ID text and reports clipboard errors', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      render(<ProviderLicenseId value="EMU-PUBLIC-COMPLETE-0123456789" />);
      const id = screen.getByRole('button', { name: /EMU-PUBLIC-COMPLETE-0123456789/ });
      expect(within(id).getByText('EMU-PUBLIC-COMPLETE-0123456789')).toBeTruthy();
      expect(screen.getAllByRole('button')).toHaveLength(1);
      fireEvent.click(id);
      await waitFor(() => expect(writeText).toHaveBeenCalledWith('EMU-PUBLIC-COMPLETE-0123456789'));
      expect(await screen.findByText('Đã sao chép mã bản quyền')).toBeTruthy();
      writeText.mockRejectedValueOnce(new Error('Clipboard blocked'));
      fireEvent.click(id);
      expect(await screen.findByText('Không thể sao chép. Vui lòng sao chép mã thủ công.')).toBeTruthy();
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('does not show a notification bell in Provider desktop or mobile navigation', async () => {
    render(<App initialEntries={['/provider/licenses']} />);
    await screen.findByRole('button', { name: 'SecureDesk Pro', exact: true });
    expect(screen.queryByRole('button', { name: 'Thông báo', exact: true })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mở menu vai trò' }));
    const menu = await screen.findByRole('dialog');
    expect(within(menu).queryByRole('button', { name: 'Thông báo', exact: true })).toBeNull();
  });

  it.each([
    ['PENDING_ONCHAIN', 'PENDING', 'Đang phát hành', 'Chưa ghi nhận xác nhận', false],
    ['ACTIVE', 'CHAIN_CONFIRMED', 'Có hiệu lực', 'Đã ghi nhận trên blockchain', true],
    ['SUSPENDED', 'PENDING_FINALITY', 'Tạm ngưng', 'Chờ đủ xác nhận', true],
    ['EXPIRED', 'PROJECTION_STALE', 'Hết hạn', 'Đang chờ đồng bộ dữ liệu', false],
    ['REVOKED', 'UNTRUSTED_REORG', 'Đã thu hồi', 'Cần kiểm tra độ tin cậy', false],
    ['ACTIVE', 'REORGED', 'Có hiệu lực', 'Cần kiểm tra ghi nhận blockchain', true],
  ])('keeps %s independent of %s and retains real device usage', async (status, finality, label, chainLabel, hasActions) => {
    const restore = licenseResponse(([row]) => [{ ...row, status, finality, activeDeviceCount: 2 }]);
    try {
      render(<App initialEntries={['/provider/licenses']} />);
      const row = (await screen.findByRole('button', { name: 'SecureDesk Pro', exact: true })).closest('tr')!;
      expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Sản phẩm / mã bản quyền', 'Gói cấp phép', 'Trạng thái', 'Thiết bị', 'Thao tác']);
      expect(within(row).getByText(label)).toBeTruthy();
      expect(within(row).getByText(chainLabel)).toBeTruthy();
      expect(within(row).getByText('2/3')).toBeTruthy();
      expect(within(row).getByRole('button', { name: 'Xem chi tiết' })).toBeTruthy();
      expect(Boolean(within(row).queryByRole('button', { name: /Thao tác bản quyền/ }))).toBe(hasActions);
      expect(within(row).queryByText(/\d+ xác nhận/)).toBeNull();
    } finally { restore(); }
  });

  it('opens business-first details with safe dates and no private fields', async () => {
    const restore = licenseResponse(([row]) => [{ ...row, expiresAt: 'bad-date', createdAt: '', activeDeviceCount: 1, status: 'PENDING_ONCHAIN', finality: 'PENDING' }]);
    try {
      render(<App initialEntries={['/provider/licenses']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết' }));
      const drawer = await screen.findByRole('dialog');
      expect(within(drawer).getByText('Đang hoàn tất phát hành bản quyền')).toBeTruthy();
      expect(within(drawer).getByRole('heading', { name: 'Thông tin bản quyền' })).toBeTruthy();
      expect(within(drawer).getAllByText('Chưa có thông tin').length).toBeGreaterThan(0);
      expect(within(drawer).queryByText(/Invalid Date|fingerprint|activationKey/)).toBeNull();
      const reads = vi.mocked(fetch).mock.calls.length;
      fireEvent.click(within(drawer).getByRole('button', { name: 'Tải lại trạng thái' }));
      await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(reads));
      expect(vi.mocked(fetch).mock.calls.some(([input, init]) => String(input).endsWith('/lifecycle') && init?.method === 'POST')).toBe(false);
    } finally { restore(); }
  });

  it('loads URL search and page, resets filters, and paginates real results', async () => {
    const restore = licenseResponse(([row]) => Array.from({ length: 12 }, (_, index) => ({ ...row, id: `license-${index}`, productName: `Product ${index}`, publicLicenseId: `PUBLIC-${index}`, finality: 'PENDING', status: 'PENDING_ONCHAIN' })));
    try {
      render(<App initialEntries={['/provider/licenses?status=PENDING_ONCHAIN&q=Product&page=2']} />);
      expect(await screen.findByRole('button', { name: 'Product 10', exact: true })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Product 0', exact: true })).toBeNull();
      expect(screen.getByLabelText('Tìm bản quyền')).toHaveProperty('value', 'Product');
      fireEvent.change(screen.getByLabelText('Tìm bản quyền'), { target: { value: 'PUBLIC-0' } });
      expect(await screen.findByRole('button', { name: 'Product 0', exact: true })).toBeTruthy();
      fireEvent.change(screen.getByLabelText('Tìm bản quyền'), { target: { value: 'no-match' } });
      expect(await screen.findByText('Không tìm thấy bản quyền phù hợp')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
      expect(await screen.findByRole('button', { name: 'Product 0', exact: true })).toBeTruthy();
    } finally { restore(); }
  });

  it('does not turn an API failure into an empty list or zero count', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => String(input).endsWith('/licenses') ? Promise.resolve(Response.json({ message: 'Unavailable' }, { status: 500 })) : original(input, init));
    try {
      render(<App initialEntries={['/provider/licenses']} />);
      expect(await screen.findByText('Không thể tải danh sách bản quyền')).toBeTruthy();
      expect(screen.queryByText(/0 bản quyền|Chưa có bản quyền nào được phát hành/)).toBeNull();
      expect(screen.queryByRole('table')).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('requires confirmation and a reason, then blocks resubmission while the command is pending', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let posts = 0;
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (String(input).endsWith('/lifecycle')) posts++;
      if (String(input).includes('/commands/')) return Promise.resolve(Response.json({ commandId: '00000000-0000-4000-8000-000000000902', status: 'PENDING' }));
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/provider/licenses']} />);
      fireEvent.click(await screen.findByRole('button', { name: /Thao tác bản quyền/ }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Tạm ngưng bản quyền' }));
      const modal = await screen.findByRole('dialog');
      expect(posts).toBe(0);
      expect(within(modal).getByRole('button', { name: 'Xác nhận tạm ngưng' })).toHaveProperty('disabled', true);
      fireEvent.change(within(modal).getByLabelText('Lý do tạm ngưng'), { target: { value: 'Bảo trì' } });
      fireEvent.click(within(modal).getByRole('button', { name: 'Xác nhận tạm ngưng' }));
      await waitFor(() => expect(posts).toBe(1));
      await waitFor(() => expect(screen.getByRole('button', { name: /Thao tác bản quyền/ })).toHaveProperty('disabled', true));
      expect(screen.getByText('Có hiệu lực')).toBeTruthy();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });
});
