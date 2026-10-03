import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/presentation/app/App';

afterEach(cleanup);

describe('completed API-backed flows', () => {
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

  it('uses isCurrent for published knowledge and sends publish for a ready document', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let published = false;
    let publishBody: unknown;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/knowledge/documents')) return Promise.resolve(Response.json([{ id: 'doc', title: 'Hướng dẫn', logicalDocumentKey: 'guide', version: 1, status: 'READY', isCurrent: published }]));
      if (url.endsWith('/knowledge/documents/doc/publish')) { publishBody = JSON.parse(typeof init?.body === 'string' ? init.body : '{}'); published = true; return Promise.resolve(Response.json({ id: 'doc' })); }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/provider/knowledge']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Công bố' }));
      expect(await screen.findByText('Đã công bố')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Công bố' })).toBeNull();
      expect(publishBody).toEqual({ expectedCurrentVersion: 0 });
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('sends the observed current version and exposes conflict recovery', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let observed: unknown;
    let reads = 0;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/knowledge/documents')) {
        reads++;
        return Promise.resolve(Response.json([
          { id: 'old', title: 'Bản cũ', logicalDocumentKey: 'guide', version: 3, status: 'READY', isCurrent: true },
          { id: 'doc', title: 'Bản mới', logicalDocumentKey: 'guide', version: 4, status: 'READY', isCurrent: false },
        ]));
      }
      if (url.endsWith('/knowledge/documents/doc/publish')) {
        observed = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
        return Promise.resolve(Response.json({ error: { code: 'KNOWLEDGE_VERSION_CONFLICT', message: 'Phiên bản đã thay đổi.' } }, { status: 409 }));
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/provider/knowledge']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Công bố' }));
      expect(await screen.findByText(/Phiên bản đã thay đổi/)).toBeTruthy();
      expect(observed).toEqual({ expectedCurrentVersion: 3 });
      const previousReads = reads;
      fireEvent.click(screen.getByRole('button', { name: 'Tải lại danh sách' }));
      await waitFor(() => expect(reads).toBeGreaterThan(previousReads));
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });

  it('asks the conversation AI instead of displaying search chunks', async () => {
    render(<App initialEntries={['/buyer/licenses']} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở chat chăm sóc khách hàng' }));
    fireEvent.change(await screen.findByLabelText('Câu hỏi cho trợ lý AI'), { target: { value: 'Gói nào phù hợp?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hỏi' }));
    expect(await screen.findByText('Không đủ nguồn chính thức để trả lời câu hỏi này.')).toBeTruthy();
  });

  it('reads audit entries and opens the selected detail', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/operations/audit-logs?')) return Promise.resolve(Response.json({ items: [{ id: '1', action: 'ACCOUNT_LOCKED', outcome: 'SUCCESS', actorRole: 'SYSTEM_ADMIN', actorUserId: 'admin', targetType: 'USER', targetId: 'user', reason: 'Kiểm tra an toàn', createdAt: '2026-09-27T00:00:00Z' }], page: 1, hasMore: false }));
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console?view=audit']} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Chi tiết nhật ký' }));
      expect(await screen.findByText('Kiểm tra an toàn')).toBeTruthy();
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
      fireEvent.click(await screen.findByRole('button', { name: 'Kiểm tra giao dịch' }));
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Lưu kết quả' }).disabled).toBe(true);
      fireEvent.change(screen.getByLabelText('Lý do xử lý thanh toán'), { target: { value: 'Đã kiểm tra chứng từ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Lưu kết quả' }));
      await waitFor(() => expect(submitted).toEqual({ status: 'RESOLVED', reason: 'Đã kiểm tra chứng từ' }));
      expect(await screen.findByText('Đã lưu kết quả kiểm tra.')).toBeTruthy();
    } finally { vi.mocked(fetch).mockImplementation(original); }
  });
});
