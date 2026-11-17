import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(cleanup);

describe('public verification', () => {
  it.each(['PENDING_ONCHAIN', 'PROJECTION_STALE', 'REORGED'])('does not claim validity for %s', async (state) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ state, status: 'ACTIVE', productName: 'Unconfirmed Product' }));
    try {
      render(<App initialEntries={['/verify']} />);
      fireEvent.change(screen.getByLabelText('Mã xác thực'), { target: { value: 'EMU-UNCONFIRMED-LICENSE' } });
      fireEvent.click(screen.getByRole('button', { name: 'Xác minh' }));
      await screen.findByText('Unconfirmed Product');
      expect(screen.queryByText(/Bản quyền hợp lệ và đã xác thực/)).toBeNull();
      expect(screen.queryByText('Đang hoạt động')).toBeNull();
      expect(screen.getAllByText(/Chưa xác nhận tính hợp lệ/).length).toBeGreaterThan(0);
    } finally { vi.restoreAllMocks(); }
  });
  it('does not invent missing business metadata or provider device measurements', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      state: 'CHAIN_CONFIRMED', status: 'ACTIVE', productName: 'Minimal Product',
      fulfillmentMode: 'PROVIDER_HANDOFF', maxActiveDevices: 5, activeDeviceCount: 0,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    render(<App initialEntries={['/verify']} />);
    fireEvent.change(screen.getByLabelText('Mã xác thực'), { target: { value: 'EMU-MISSING-METADATA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác minh' }));
    expect(await screen.findByText('Minimal Product')).toBeTruthy();
    expect(screen.queryByText('Gói tiêu chuẩn')).toBeNull();
    expect(screen.queryByText('Emukey Software')).toBeNull();
    expect(screen.queryByText('Vĩnh viễn')).toBeNull();
    expect(screen.getByText('Bên bán quản lý · tối đa 5 thiết bị')).toBeTruthy();
    expect(screen.getAllByText('Chưa có thông tin').length).toBeGreaterThanOrEqual(3);
    vi.restoreAllMocks();
  });

  it('shows the backend allowlist without Buyer PII', async () => {
    render(<App initialEntries={['/verify']} />);
    fireEvent.change(screen.getByLabelText('Mã xác thực'), { target: { value: 'EMU-TEST-LICENSE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác minh' }));
    expect(await screen.findByText('Đã tìm thấy License')).toBeTruthy();
    expect(await screen.findByText('SecureDesk Pro')).toBeTruthy();
    expect(await screen.findByText('Emukey Software')).toBeTruthy();
    expect(screen.queryByText('Công ty TNHH Minh An')).toBeNull();
  });

  it('shows an explicit not-found state for an unknown code', async () => {
    render(<App initialEntries={['/verify']} />);
    fireEvent.change(screen.getByLabelText('Mã xác thực'), {
      target: { value: 'UNKNOWN' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác minh' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Không tìm thấy',
    );
  });

  it('renders Part A (License Overview) and Part B (Blockchain Lifecycle Timeline) in chronological order with expandable technical details', async () => {
    render(<App initialEntries={['/verify']} />);
    fireEvent.change(screen.getByLabelText('Mã xác thực'), {
      target: { value: 'EMU-FULL-LIFECYCLE-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác minh' }));

    // Part A: Overview
    expect(await screen.findByText('Tổng quan bản quyền')).toBeTruthy();
    expect(screen.getByText(/EMU-FULL-LIFECYCLE-001/)).toBeTruthy();
    expect(screen.getByText(/Đã tra cứu qua Key cũ \(v1\)/i)).toBeTruthy();

    // Part B: Modern Blockchain Lifecycle Timeline (all events shown directly, pill badge shows event count)
    expect(screen.getByText('Lịch sử bản quyền')).toBeTruthy();
    expect(screen.getByText('6 sự kiện')).toBeTruthy();

    const timelineItems = screen.getAllByTestId('blockchain-timeline-item');
    expect(timelineItems).toHaveLength(6);
    expect(within(timelineItems[0]!).getByText('Kích hoạt bản quyền')).toBeTruthy();
    expect(within(timelineItems[1]!).getByText('Cập nhật thiết bị kích hoạt')).toBeTruthy();
    expect(within(timelineItems[2]!).getByText('Cấp lại License Key')).toBeTruthy();
    expect(within(timelineItems[3]!).getByText('Gia hạn bản quyền')).toBeTruthy();
    expect(within(timelineItems[4]!).getByText('Tạm khóa bản quyền')).toBeTruthy();
    expect(within(timelineItems[5]!).getByText('Khôi phục bản quyền')).toBeTruthy();

    // Accordion: Initially collapsed, clicking an item expands only that item
    expect(within(timelineItems[2]!).queryByText('Phiên bản Key v1')).toBeNull();
    fireEvent.click(within(timelineItems[2]!).getByRole('button'));
    expect(within(timelineItems[2]!).getByText('Phiên bản Key v1')).toBeTruthy();
    expect(within(timelineItems[2]!).getByText('Phiên bản Key v2')).toBeTruthy();

    // Single-open accordion: Clicking another item closes the previous one
    fireEvent.click(within(timelineItems[3]!).getByRole('button'));
    expect(within(timelineItems[2]!).queryByText('Phiên bản Key v1')).toBeNull();
    expect(within(timelineItems[3]!).getByText(/2028/)).toBeTruthy();

    // Technical blockchain hashes and block numbers are not exposed to the user
    expect(screen.queryByText(/11842400/)).toBeNull();
    expect(screen.queryByText(/0x1111/)).toBeNull();
  });
});
