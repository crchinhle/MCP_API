import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(() => {
  cleanup();
});

describe('System blockchain status (UC5)', () => {
  it('loads blockchain status via GET without calling POST reconcile, supports refresh, error/retry, modal cancel and confirm', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let statusCalls = 0;
    let reconcileCalls = 0;
    let failFirstStatus = true;

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/operations/blockchain/status')) {
        statusCalls += 1;
        if (failFirstStatus) {
          failFirstStatus = false;
          return Response.json({ message: 'Lỗi đọc trạng thái' }, { status: 500 });
        }
        return Response.json({
          unknown_commands: 2,
          pending_events: 1,
          reorged_events: 0,
          active_without_finality: 3,
        });
      }
      if (url.endsWith('/operations/blockchain/reconcile') && init?.method === 'POST') {
        reconcileCalls += 1;
        return Response.json({
          health: {
            unknown_commands: 0,
            pending_events: 0,
            reorged_events: 0,
            active_without_finality: 0,
          },
          indexedEvents: 4,
          processed: true,
          projection: { commandRepairs: 1, licenseRepairs: 1, remainingMismatches: 0 },
          reconciledCommandIds: ['cmd-1'],
        });
      }
      if (url.endsWith('/operations/health/assistance')) {
        return Response.json({
          notifications: { pending: 0, retryableFailed: 0, deadLetter: 0 },
          workers: { notifications: 'UP', supportLeases: 'UP', expiry: 'UP' },
        });
      }
      return original(input, init);
    });

    try {
      render(<App initialEntries={['/system/console?view=blockchain']} />);

      // Initial load failed -> error shown, no reconcile POST
      expect(await screen.findByText('Không thể tải tình trạng blockchain')).toBeTruthy();
      expect(reconcileCalls).toBe(0);

      // Retry loads status metrics
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
      await waitFor(() => expect(statusCalls).toBe(2));
      expect(await screen.findByText('Yêu cầu chưa rõ kết quả')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
      expect(reconcileCalls).toBe(0);

      // Refresh calls GET status, not POST reconcile
      const refreshBtn = await screen.findByRole('button', { name: /Làm mới/ });
      fireEvent.click(refreshBtn);
      await waitFor(() => expect(statusCalls).toBe(3));
      expect(reconcileCalls).toBe(0);

      // Cancel modal does not call POST reconcile
      fireEvent.click(screen.getByRole('button', { name: 'Chạy đối soát' }));
      expect(await screen.findByRole('dialog')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
      expect(reconcileCalls).toBe(0);

      // Confirm modal calls POST reconcile once and refreshes status
      fireEvent.click(screen.getAllByRole('button', { name: 'Chạy đối soát' })[0]!);
      const dialogs = await screen.findAllByRole('dialog');
      const dialog = dialogs.at(-1)!;
      const confirmBtn = dialog.querySelector('button.ant-btn-primary') as HTMLButtonElement;
      fireEvent.click(confirmBtn);

      await waitFor(() => expect(reconcileCalls).toBe(1));
      await waitFor(() => expect(statusCalls).toBeGreaterThanOrEqual(4));
      expect(await screen.findByText(/Kết quả lần chạy gần nhất/)).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });
});
