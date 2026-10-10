import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(cleanup);

describe('Provider workspace', () => {
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

  it('filters provider payment history loaded from the backend', async () => {
    render(<App initialEntries={['/provider/operations']} />);

    fireEvent.change(await screen.findByLabelText('Tìm dữ liệu vận hành'), {
      target: { value: '0218' },
    });

    expect(await screen.findByText(/ORD-2026-0218/)).toBeTruthy();
    expect(screen.getByText('Đã khớp')).toBeTruthy();
  });

  it('exposes license lifecycle controls in the Provider workspace', async () => {
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
    expect(await screen.findByText(/Đã xác nhận · 00000000-0000-4000-8000-000000000902/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Hoạt động')).toBeTruthy());
  });
});
