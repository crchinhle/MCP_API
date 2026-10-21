import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(cleanup);

describe('completed API-backed flows', () => {
  it('opens the overview for the removed audit URL without fetching audit data', async () => {
    render(<App initialEntries={['/system/console?view=audit']} />);
    expect(await screen.findByRole('heading', { name: 'Tổng quan hệ thống' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Nhật ký', exact: true })).toBeNull();
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes('/operations/audit-logs'))).toBe(false);
  });
  it('loads closed conversations from history instead of the active queue', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/conversations')) return Promise.resolve(Response.json([{ id: 'closed', customerUserId: 'customer', title: 'Đã xử lý lỗi', status: 'CLOSED', contextType: 'GENERAL' }]));
      if (url.endsWith('/conversations/closed/messages')) return Promise.resolve(Response.json([]));
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/support?view=resolved']} />);
      expect(await screen.findByRole('heading', { name: 'Đã xử lý lỗi' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Nhận xử lý' })).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('keeps provider guides awaiting approval without offering self-publication', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let publishRequested = false;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/knowledge/documents')) return Promise.resolve(Response.json([{ id: 'doc', title: 'Hướng dẫn', logicalDocumentKey: 'guide', version: 1, status: 'READY', isCurrent: false }]));
      if (url.endsWith('/knowledge/documents/doc/publish')) { publishRequested = true; return Promise.resolve(Response.json({ id: 'doc' })); }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/provider/knowledge']} />);
      expect(await screen.findByText('Chờ duyệt', { selector: '.status-chip' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Công bố' })).toBeNull();
      expect(publishRequested).toBe(false);
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('keeps the approved version visible while a newer guide awaits administrator approval', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/knowledge/documents')) {
        return Promise.resolve(Response.json([
          { id: 'old', title: 'Bản cũ', logicalDocumentKey: 'guide', version: 3, status: 'READY', isCurrent: true },
          { id: 'doc', title: 'Bản mới', logicalDocumentKey: 'guide', version: 4, status: 'READY', isCurrent: false },
        ]));
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/provider/knowledge']} />);
      expect(await screen.findByText('Đã công bố', { selector: '.status-chip' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Bản cũ' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Bản mới' })).toBeTruthy();
      expect(screen.getByText('Chờ duyệt', { selector: '.status-chip' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Công bố' })).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('asks the conversation AI instead of displaying search chunks', async () => {
    render(<App initialEntries={['/buyer/licenses']} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở chat chăm sóc khách hàng' }));
    fireEvent.change(await screen.findByLabelText('Câu hỏi cho trợ lý AI'), { target: { value: 'Gói nào phù hợp?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi' }));
    expect(await screen.findByText('Không đủ nguồn chính thức để trả lời câu hỏi này.')).toBeTruthy();
  });

  it('lets the administrator approve a provider guide using its own observed version', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let submitted: unknown;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/knowledge/documents')) return Promise.resolve(Response.json([
        { id: 'other', providerUserId: 'other-provider', title: 'Tài liệu nhà cung cấp khác', logicalDocumentKey: 'guide', version: 9, status: 'READY', isCurrent: true },
        { id: 'current', providerUserId: 'provider', title: 'Bản đang dùng', logicalDocumentKey: 'guide', version: 3, status: 'READY', isCurrent: true },
        { id: 'next', providerUserId: 'provider', title: 'Bản cần duyệt', logicalDocumentKey: 'guide', version: 4, status: 'READY', isCurrent: Boolean(submitted) },
      ]));
      if (url.endsWith('/knowledge/documents/next/publish')) { submitted = JSON.parse(String(init?.body)); return Promise.resolve(Response.json({ id: 'next' })); }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console/knowledge']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Công bố' }, { timeout: 15000 }));
      await waitFor(() => expect(submitted).toEqual({ expectedCurrentVersion: 3 }));
      expect(screen.queryByRole('button', { name: 'Tải tài liệu lên' })).toBeNull();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });


  it('retries loading comparison data after a temporary failure', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let fail = true;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (fail && url.includes('/plans/compare?')) {
        fail = false;
        return Promise.resolve(Response.json({ message: 'Unavailable' }, { status: 500 }));
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/compare?ids=securedesk-10,securedesk-25']} />);
      expect(await screen.findByText('Không thể tải dữ liệu so sánh gói.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      expect(await screen.findByRole('region', { name: 'Bảng so sánh gói' })).toBeTruthy();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });


  it('submits a review only with a reason and refreshes the review queue', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let submitted: unknown;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/payments/review')) return Promise.resolve(Response.json(submitted ? [] : [{ id: 'review', providerEventId: 'event', amountVnd: 10000, classification: 'AMOUNT_MISMATCH', reviewStatus: 'OPEN' }]));
      if (url.endsWith('/payments/review/review')) { submitted = JSON.parse(typeof init?.body === 'string' ? init.body : '{}'); return Promise.resolve(Response.json({ id: 'review' })); }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console?view=payments']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Kiểm tra giao dịch' }, { timeout: 15000 }));
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Lưu kết quả' }).disabled).toBe(true);
      fireEvent.change(screen.getByLabelText('Lý do xử lý thanh toán'), { target: { value: 'Đã kiểm tra chứng từ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Lưu kết quả' }));
      await waitFor(() => expect(submitted).toEqual({ status: 'RESOLVED', reason: 'Đã kiểm tra chứng từ' }));
      expect(await screen.findByText('Đã lưu kết quả kiểm tra.')).toBeTruthy();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });
});
