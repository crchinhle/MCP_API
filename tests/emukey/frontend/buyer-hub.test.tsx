import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';
import { ConversationPanel } from '../../../EmuKey/frontend/src/presentation/components/ConversationPanel';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
afterEach(() => {
  cleanup();
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('Customer hub', () => {
  it('offers renewal from the license overview without opening the secret tab', async () => {
    render(<App initialEntries={['/buyer/licenses']} />);
    expect((await screen.findByRole('link', { name: 'Gia hạn' })).getAttribute('href')).toBe('/buyer/licenses/00000000-0000-4000-8000-000000000401/renew');
    expect(screen.queryByRole('button', { name: 'Nhận mã bản quyền' })).toBeNull();
  });
  it('keeps recovery controls inside the license detail dialog', async () => {
    render(<App initialEntries={['/buyer/licenses']} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Chi tiết' }))[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Mã bản quyền' }));

    const dialog = screen.getByRole('dialog');
    const recoveryPanel = screen.getByRole('region', { name: 'Khôi phục mã bản quyền' });
    expect(dialog.contains(recoveryPanel)).toBe(true);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('requests recovery explicitly and waits for blockchain confirmation before retrieving the replacement key', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let confirmed = false;
    const recoveryCommandId = '00000000-0000-4000-8000-000000000903';
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/commands/' + recoveryCommandId)) {
        return Response.json({
          commandId: recoveryCommandId,
          commandType: 'ROTATE_KEY',
          confirmedAt: confirmed ? '2026-10-10T00:00:00.000Z' : null,
          deviceId: null,
          licenseId: '00000000-0000-4000-8000-000000000401',
          status: confirmed ? 'CONFIRMED' : 'PENDING',
          transactionHash: null,
        });
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/buyer/licenses']} />);
      fireEvent.click((await screen.findAllByRole('button', { name: 'Chi tiết' }))[0]!);
      fireEvent.click(screen.getByRole('button', { name: 'Mã bản quyền' }));
      const panel = screen.getByRole('region', { name: 'Khôi phục mã bản quyền' });
      fireEvent.click(within(panel).getByRole('button', { name: 'Gửi email khôi phục' }));
      expect(await within(panel).findByText('Đã gửi email. Dán mã xác nhận trong email vào ô bên dưới.')).toBeTruthy();
      fireEvent.change(within(panel).getByLabelText('Mã xác nhận khôi phục'), { target: { value: 'recovery-action-token-0123456789abcdef' } });
      fireEvent.change(within(panel).getByLabelText('Mật khẩu xác nhận khôi phục'), { target: { value: 'current-password' } });
      fireEvent.click(within(panel).getByRole('button', { name: 'Xác nhận khôi phục' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Khôi phục' }));
      expect(await within(panel).findByText('Trạng thái khôi phục: Đang xử lý')).toBeTruthy();
      expect(within(panel).queryByRole('button', { name: 'Nhận mã khôi phục' })).toBeNull();
      expect(screen.queryByLabelText('Mã bản quyền đã cấp')).toBeNull();
      expect(screen.queryByText(recoveryCommandId)).toBeNull();

      confirmed = true;
      await waitFor(() => expect(within(panel).getByRole('button', { name: 'Nhận mã khôi phục' })).toBeTruthy(), { timeout: 5_000 });
      fireEvent.click(within(panel).getByRole('button', { name: 'Nhận mã khôi phục' }));
      expect(await screen.findByLabelText('Mã bản quyền đã cấp')).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('retains the one-time key through filtering and reselection', async () => {
    render(<App initialEntries={['/buyer/licenses']} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Chi tiết' }))[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Mã bản quyền' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nhận mã bản quyền một lần' }));
    const key = '0x' + '12'.repeat(32);
    const keyField = await screen.findByLabelText<HTMLInputElement>('Mã bản quyền đã cấp');
    expect(keyField.value).toBe(key);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đã thu hồi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    fireEvent.click((await screen.findAllByRole('button', { name: 'Chi tiết' }))[0]!);
    expect(screen.getByRole('button', { name: 'Xem mã bản quyền' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xem mã bản quyền' }));
    expect(screen.getByLabelText<HTMLInputElement>('Mã bản quyền đã cấp').value).toBe(key);
  });

  it('creates and selects a new support thread after the previous thread closed', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const closed = { id: 'closed', title: 'Yêu cầu cũ', status: 'CLOSED', contextType: 'GENERAL' };
    const opened = { ...closed, id: 'opened', title: 'Yêu cầu mới', status: 'AI_ACTIVE' };
    let created = false;
    let attempts = 0;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/conversations')) {
        if (init?.method === 'POST') {
          if (++attempts === 1) throw new TypeError('Offline');
          created = true;
          return Response.json(opened);
        }
        return Response.json(created ? [closed, opened] : [closed]);
      }
      if (/\/conversations\/(closed|opened)\/messages$/.test(url)) return Response.json([]);
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/buyer/support']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Tạo yêu cầu mới' }));
      expect(await screen.findByText('Không thể tạo hội thoại. Vui lòng thử lại.')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Yêu cầu cũ' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu mới' }));
      expect(await screen.findByLabelText('Tin nhắn hỗ trợ')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Yêu cầu mới' })).toBeTruthy();
      expect(created).toBe(true);
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });
  it('opens the selected order detail', async () => {
    render(<App initialEntries={['/buyer/orders']} />);
    fireEvent.click(
      await screen.findByRole('button', { name: /ORD-2026-0218/i }),
    );
    expect(await screen.findByText('SecureDesk Pro')).toBeTruthy();
  });

  it('retrieves the mã bản quyền from the backend only after an explicit request', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<App initialEntries={['/buyer/licenses']} />);
    const key = '0x' + '12'.repeat(32);
    expect(screen.queryByText(key)).toBeNull();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Chi tiết' }))[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Mã bản quyền' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nhận mã bản quyền một lần' }));
    expect((await screen.findByLabelText<HTMLInputElement>('Mã bản quyền đã cấp')).value).toBe(key);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.getByRole('button', { name: 'Xem mã bản quyền' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xem mã bản quyền' }));
    expect(screen.getByLabelText<HTMLInputElement>('Mã bản quyền đã cấp').value).toBe(key);
    fireEvent.click(
      screen.getByRole('button', { name: 'Sao chép mã bản quyền' }),
    );
    expect(await screen.findByText('Đã sao chép mã bản quyền')).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(key);
  });

  it('does not report clipboard success when the browser denies access', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<App initialEntries={['/buyer/licenses']} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Chi tiết' }))[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Mã bản quyền' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nhận mã bản quyền một lần' }));
    await screen.findByLabelText<HTMLInputElement>('Mã bản quyền đã cấp');
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép mã bản quyền' }));
    expect(await screen.findByText('Không thể sao chép. Vui lòng lưu mã thủ công.')).toBeTruthy();
    expect(screen.queryByText('Đã sao chép mã bản quyền')).toBeNull();
  });

  it('updates the authenticated Customer profile through the real profile endpoint', async () => {
    render(<App initialEntries={['/buyer/profile']} />);

    fireEvent.change(await screen.findByLabelText('Tên hiển thị'), {
      target: { value: 'Khách hàng Emukey' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByText('Đã cập nhật hồ sơ.')).toBeTruthy();
  });

  it('opens the password change form in a dialog, not an anchored overlay', async () => {
    render(<App initialEntries={['/buyer/profile']} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Đổi mật khẩu' }));

    expect(await screen.findByRole('dialog', { name: 'Đổi mật khẩu' })).toBeTruthy();
    expect(screen.getByLabelText('Mật khẩu hiện tại')).toBeTruthy();
  });

  it('appends a support message through the API', async () => {
    render(<App initialEntries={['/buyer/support']} />);
    fireEvent.change(await screen.findByLabelText('Tin nhắn hỗ trợ'), {
      target: { value: 'Tôi cần kiểm tra thiết bị mới.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
    expect(await screen.findByText('Tôi cần kiểm tra thiết bị mới.')).toBeTruthy();
  });

  it('does not expose a fake AI suggestion without a backend response', async () => {
    render(<App initialEntries={['/buyer/support']} />);
    await screen.findByLabelText('Tin nhắn hỗ trợ');
    expect(screen.queryByRole('button', { name: 'Chèn gợi ý AI' })).toBeNull();
  });

  it('does not present a fabricated key or operating system', async () => {
    render(<App initialEntries={['/buyer/licenses']} />);
    await screen.findAllByRole('button', { name: 'Chi tiết' });
    expect(screen.queryByText('XXXX-XXXX-XXXX-9K2M')).toBeNull();
    expect(screen.queryByText(/Windows 11/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sao chép' })).toBeNull();
  });

  it('keeps the draft on failure and never displays an unconfirmed message', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    render(<ConversationPanel author="Buyer" initialMessages={[]} inputLabel="Tin nhắn" submitLabel="Gửi" onSubmit={send} />);
    fireEvent.change(screen.getByLabelText('Tin nhắn'), { target: { value: 'Kiểm tra bản quyền' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi$/ }));
    expect(await screen.findByText(/Chưa gửi được yêu cầu/)).toBeTruthy();
    expect(screen.getByLabelText<HTMLTextAreaElement>('Tin nhắn').value).toBe('Kiểm tra bản quyền');
    expect(document.querySelectorAll('.message')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /Gửi$/ }));
    await waitFor(() => expect(screen.getByLabelText<HTMLTextAreaElement>('Tin nhắn').value).toBe(''));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('filters licenses and renders one assistant launcher', async () => {
    render(<App initialEntries={['/buyer/licenses']} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Đã thu hồi' }));
    expect(screen.getByText('Không có bản quyền phù hợp bộ lọc.')).toBeTruthy();
    expect(document.querySelectorAll('.ai-assistant-launcher')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }));
    expect(screen.getAllByRole('button', { name: 'Chi tiết' }).length).toBeGreaterThan(0);
  });
});
