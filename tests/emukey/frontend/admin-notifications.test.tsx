import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../EmuKey/frontend/src/presentation/app/App';

afterEach(() => {
  cleanup();
});

const notificationsFixture = {
  items: [
    {
      id: 'notif-license-1',
      title: 'Bản quyền mới cần kiểm tra',
      content: 'Bản quyền vừa được cập nhật.',
      isRead: false,
      createdAt: '2026-10-05T10:00:00.000Z',
      target: { kind: 'LICENSE', id: 'lic-1' },
    },
    {
      id: 'notif-payment-1',
      title: 'Giao dịch cần rà soát',
      content: 'Giao dịch TX-1 cần kiểm tra.',
      isRead: false,
      createdAt: '2026-10-05T10:01:00.000Z',
      target: { kind: 'PAYMENT', id: 'tx-1' },
    },
    {
      id: 'notif-payment-2',
      title: 'Giao dịch thứ hai',
      content: 'Giao dịch TX-2 vừa ghi nhận.',
      isRead: true,
      createdAt: '2026-10-05T10:02:00.000Z',
      target: { kind: 'PAYMENT', id: 'tx-2' },
    },
    {
      id: 'notif-other-1',
      title: 'Thông báo hệ thống chung',
      content: 'Không có route chi tiết riêng.',
      isRead: false,
      createdAt: '2026-10-05T10:03:00.000Z',
      target: { kind: 'ORDER', id: 'ord-99' },
    },
  ],
  unreadCount: 3,
  nextCursor: null,
};

describe('Provider Admin and System Admin notifications (UC3)', () => {
  it('shows NotificationCenter for PROVIDER_ADMIN on desktop and mobile menu, marks read, and opens target license', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    let markedId = '';
    let unread = 3;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/notifications') && init?.method === 'POST') {
        markedId = url.split('/notifications/')[1]?.split('/')[0] ?? '';
        unread = Math.max(0, unread - 1);
        return Response.json({ ok: true });
      }
      if (url.includes('/notifications')) {
        return Response.json({
          ...notificationsFixture,
          unreadCount: unread,
          items: notificationsFixture.items.map((item) =>
            item.id === markedId ? { ...item, isRead: true } : item,
          ),
        });
      }
      if (url.endsWith('/licenses')) {
        return Response.json([
          {
            id: 'lic-1',
            publicLicenseId: 'PUB-LIC-1',
            productName: 'SecureDesk',
            plan: { name: 'Pro' },
            status: 'ACTIVE',
            finality: 'CONFIRMED',
            maxActiveDevices: 5,
            activeDeviceCount: 1,
            expiresAt: '2027-01-01T00:00:00.000Z',
            originOrderId: 'ord-1',
            fulfillmentMode: 'KEY_DIRECT',
          },
        ]);
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/provider']} />);

      // Desktop has one NotificationCenter trigger
      const bellButtons = await screen.findAllByRole('button', { name: 'Thông báo' });
      expect(bellButtons).toHaveLength(1);
      await waitFor(() => expect(document.querySelector('.ant-badge-count')).toBeTruthy());

      // Open popover
      fireEvent.click(bellButtons[0]!);
      expect(await screen.findByText('Bản quyền mới cần kiểm tra')).toBeTruthy();

      // Mark read
      const readButtons = screen.getAllByRole('button', { name: 'Đã đọc' });
      fireEvent.click(readButtons[0]!);
      await waitFor(() => expect(markedId).toBe('notif-license-1'));

      // Click license notification link -> navigates to /provider/licenses?licenseId=lic-1
      fireEvent.click(screen.getByRole('link', { name: 'Bản quyền mới cần kiểm tra' }));
      expect((await screen.findAllByText('PUB-LIC-1')).length).toBeGreaterThanOrEqual(1);

      // Open mobile menu -> NotificationCenter also accessible
      fireEvent.click(screen.getByRole('button', { name: 'Mở menu vai trò' }));
      expect(screen.getAllByRole('button', { name: 'Thông báo' }).length).toBeGreaterThanOrEqual(1);
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('shows NotificationCenter for SYSTEM_ADMIN and switches selected payment when clicking two notifications consecutively', async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/notifications') && init?.method === 'POST') {
        return Response.json({ ok: true });
      }
      if (url.includes('/notifications')) {
        return Response.json(notificationsFixture);
      }
      if (url.endsWith('/payments/history')) {
        return Response.json([
          {
            transactionId: 'tx-1',
            providerEventId: 'evt-1',
            providerTransactionReference: 'REF-TX-1',
            amountVnd: 100000,
            classification: 'MATCHED',
            reviewStatus: null,
            receivedAt: '2026-10-01T10:00:00.000Z',
            providerOccurredAt: '2026-10-01T09:59:00.000Z',
            orderId: 'ord-1',
            orderNumber: 'ORD-1',
            orderType: 'NEW_PURCHASE',
            productNameSnapshot: 'Prod 1',
            planNameSnapshot: 'Plan 1',
          },
          {
            transactionId: 'tx-2',
            providerEventId: 'evt-2',
            providerTransactionReference: 'REF-TX-2',
            amountVnd: 200000,
            classification: 'MATCHED',
            reviewStatus: null,
            receivedAt: '2026-10-02T10:00:00.000Z',
            providerOccurredAt: '2026-10-02T09:59:00.000Z',
            orderId: 'ord-2',
            orderNumber: 'ORD-2',
            orderType: 'NEW_PURCHASE',
            productNameSnapshot: 'Prod 2',
            planNameSnapshot: 'Plan 2',
          },
        ]);
      }
      return original(input, init);
    });
    try {
      render(<App initialEntries={['/system/console']} />);

      const bell = await screen.findByRole('button', { name: 'Thông báo' });
      fireEvent.click(bell);

      // Unsupported target kind is readable without a link
      expect(await screen.findByText('Thông báo hệ thống chung')).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'Thông báo hệ thống chung' })).toBeNull();

      // Click first payment notification
      fireEvent.click(screen.getByRole('link', { name: 'Giao dịch cần rà soát' }));
      expect(await screen.findByText('REF-TX-1')).toBeTruthy();

      // Click second payment notification while already on payments view
      fireEvent.click(screen.getByRole('link', { name: 'Giao dịch thứ hai' }));
      expect(await screen.findByText('REF-TX-2')).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('opens review-only transactions A and B consecutively, reopens A, and opens only one drawer when present in both review and history', { timeout: 60_000 }, async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const reviewOnlyNotifications = {
      items: [
        {
          id: 'n-rev-a',
          title: 'Rà soát giao dịch A',
          content: 'Cần kiểm tra A.',
          isRead: false,
          createdAt: '2026-10-05T10:00:00.000Z',
          target: { kind: 'PAYMENT', id: 'rev-a' },
        },
        {
          id: 'n-rev-b',
          title: 'Rà soát giao dịch B',
          content: 'Cần kiểm tra B.',
          isRead: false,
          createdAt: '2026-10-05T10:01:00.000Z',
          target: { kind: 'PAYMENT', id: 'rev-b' },
        },
      ],
      unreadCount: 2,
      nextCursor: null,
    };
    const reviewFixtures = [
      {
        id: 'rev-a',
        providerEventId: 'evt-rev-a',
        providerTransactionReference: 'REF-REV-A',
        amountVnd: 150000,
        classification: 'UNMATCHED',
        reviewStatus: 'OPEN',
        reviewReason: null,
        reviewResolution: null,
        reviewEvidence: {},
        orderId: null,
        orderNumber: null,
        receivedAt: '2026-10-05T10:00:00.000Z',
        providerOccurredAt: '2026-10-05T09:59:00.000Z',
        reviewedAt: null,
      },
      {
        id: 'rev-b',
        providerEventId: 'evt-rev-b',
        providerTransactionReference: 'REF-REV-B',
        amountVnd: 250000,
        classification: 'UNMATCHED',
        reviewStatus: 'OPEN',
        reviewReason: null,
        reviewResolution: null,
        reviewEvidence: {},
        orderId: null,
        orderNumber: null,
        receivedAt: '2026-10-05T10:01:00.000Z',
        providerOccurredAt: '2026-10-05T10:00:00.000Z',
        reviewedAt: null,
      },
    ];
    let historyItems: unknown[] = [];

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/notifications') && init?.method === 'POST') return Response.json({ ok: true });
      if (url.includes('/notifications')) return Response.json(reviewOnlyNotifications);
      if (url.endsWith('/payments/review')) return Response.json(reviewFixtures);
      if (url.endsWith('/payments/history')) return Response.json(historyItems);
      return original(input, init);
    });

    try {
      render(<App initialEntries={['/system/console']} />);

      // Click notification A (review-only)
      fireEvent.click(await screen.findByRole('button', { name: 'Thông báo' }));
      fireEvent.click(await screen.findByRole('link', { name: 'Rà soát giao dịch A' }));

      expect(await screen.findByText('Chi tiết rà soát thanh toán')).toBeTruthy();
      const drawerA = screen.getByRole('dialog');
      expect(within(drawerA).getByText('REF-REV-A')).toBeTruthy();
      expect(within(drawerA).queryByText('REF-REV-B')).toBeNull();

      // Close drawer A
      fireEvent.click(within(drawerA).getByRole('button', { name: 'Close' }));

      // Click notification B (review-only) without remounting
      fireEvent.click(screen.getByRole('link', { name: 'Rà soát giao dịch B' }));
      const drawerB = await screen.findByRole('dialog');
      expect(within(drawerB).getByText('REF-REV-B')).toBeTruthy();
      expect(within(drawerB).queryByText('REF-REV-A')).toBeNull();

      // Close drawer B and reopen A
      fireEvent.click(within(drawerB).getByRole('button', { name: 'Close' }));
      fireEvent.click(screen.getByRole('link', { name: 'Rà soát giao dịch A' }));
      const drawerA2 = await screen.findByRole('dialog');
      expect(within(drawerA2).getByText('REF-REV-A')).toBeTruthy();

      // Even if rev-a is also in history, only ONE drawer is open
      historyItems = [
        {
          transactionId: 'rev-a',
          providerEventId: 'evt-rev-a',
          providerTransactionReference: 'REF-REV-A',
          amountVnd: 150000,
          classification: 'UNMATCHED',
          reviewStatus: 'OPEN',
          receivedAt: '2026-10-05T10:00:00.000Z',
          providerOccurredAt: '2026-10-05T09:59:00.000Z',
          orderId: null,
          orderNumber: null,
          orderType: null,
          productNameSnapshot: null,
          planNameSnapshot: null,
        },
      ];
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('closes review drawer on browser Back and preserves other query params on close', { timeout: 60_000 }, async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const reviewFixtures = [
      {
        id: 'rev-a',
        providerEventId: 'evt-rev-a',
        providerTransactionReference: 'REF-REV-A',
        amountVnd: 150000,
        classification: 'UNMATCHED',
        reviewStatus: 'OPEN',
        reviewReason: null,
        reviewResolution: null,
        reviewEvidence: {},
        orderId: null,
        orderNumber: null,
        receivedAt: '2026-10-05T10:00:00.000Z',
        providerOccurredAt: '2026-10-05T09:59:00.000Z',
        reviewedAt: null,
      },
    ];
    const notifs = {
      items: [
        {
          id: 'n-a',
          title: 'Thông báo A',
          content: 'Mở A',
          isRead: false,
          createdAt: '2026-10-05T10:00:00.000Z',
          target: { kind: 'PAYMENT', id: 'rev-a' },
        },
      ],
      unreadCount: 1,
      nextCursor: null,
    };

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return Response.json({
          accessToken: 'tok-sys',
          user: { id: 'sys-1', email: 'sys@example.com', displayName: 'Sys', role: 'SYSTEM_ADMIN', status: 'ACTIVE' },
        });
      }
      if (url.includes('/notifications') && init?.method === 'POST') return Response.json({ ok: true });
      if (url.includes('/notifications')) return Response.json(notifs);
      if (url.endsWith('/payments/review')) return Response.json(reviewFixtures);
      if (url.endsWith('/payments/history')) return Response.json([]);
      return original(input, init);
    });

    try {
      window.history.pushState({}, '', '/system/console?view=payments');
      render(<App />);

      const reviewQueue = await screen.findByRole('region', { name: 'Xử lý thanh toán cần kiểm tra' }, { timeout: 15_000 });
      fireEvent.click(await within(reviewQueue).findByRole('button', { name: 'Kiểm tra giao dịch' }, { timeout: 15_000 }));
      expect(await screen.findByText('Chi tiết rà soát thanh toán')).toBeTruthy();
      expect(new URLSearchParams(window.location.search).get('transactionId')).toBeNull();

      // Open notification A -> URL becomes ?view=payments&transactionId=rev-a
      fireEvent.click(await screen.findByRole('button', { name: 'Thông báo' }));
      fireEvent.click(await screen.findByRole('link', { name: 'Thông báo A' }));
      expect(await screen.findByText('Chi tiết rà soát thanh toán')).toBeTruthy();
      expect(within(document.querySelector('.system-drawer') as HTMLElement).getByText('REF-REV-A')).toBeTruthy();
      expect(new URLSearchParams(window.location.search).get('transactionId')).toBe('rev-a');

      // Browser Back -> URL loses transactionId and drawer closes
      window.history.back();
      await waitFor(() => expect(new URLSearchParams(window.location.search).get('transactionId')).toBeNull());
      await waitFor(() => expect(document.querySelector('.ant-drawer-open')).toBeNull());
      expect(new URLSearchParams(window.location.search).get('view')).toBe('payments');

      // Reopen A and close via drawer Close button -> view=payments is preserved
      fireEvent.click(screen.getByRole('link', { name: 'Thông báo A' }));
      await waitFor(() => expect(document.querySelector('.ant-drawer-open')).toBeTruthy());
      const openDrawer = document.querySelector('.system-drawer') as HTMLElement;
      fireEvent.click(within(openDrawer).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(document.querySelector('.ant-drawer-open')).toBeNull());
      expect(new URLSearchParams(window.location.search).get('view')).toBe('payments');
      expect(new URLSearchParams(window.location.search).get('transactionId')).toBeNull();
    } finally {
      window.history.pushState({}, '', '/');
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('supports manual table open when URL has no transactionId', { timeout: 60_000 }, async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const reviewFixtures = [
      {
        id: 'rev-a',
        providerEventId: 'evt-rev-a',
        providerTransactionReference: 'REF-REV-A',
        amountVnd: 150000,
        classification: 'UNMATCHED',
        reviewStatus: 'OPEN',
        reviewReason: null,
        reviewResolution: null,
        reviewEvidence: {},
        orderId: null,
        orderNumber: null,
        receivedAt: '2026-10-05T10:00:00.000Z',
        providerOccurredAt: '2026-10-05T09:59:00.000Z',
        reviewedAt: null,
      },
      {
        id: 'rev-b',
        providerEventId: 'evt-rev-b',
        providerTransactionReference: 'REF-REV-B',
        amountVnd: 250000,
        classification: 'UNMATCHED',
        reviewStatus: 'OPEN',
        reviewReason: null,
        reviewResolution: null,
        reviewEvidence: {},
        orderId: null,
        orderNumber: null,
        receivedAt: '2026-10-05T10:01:00.000Z',
        providerOccurredAt: '2026-10-05T10:00:00.000Z',
        reviewedAt: null,
      },
    ];
    const notifs = {
      items: [
        {
          id: 'n-a',
          title: 'Thông báo A',
          content: 'Mở A',
          isRead: false,
          createdAt: '2026-10-05T10:00:00.000Z',
          target: { kind: 'PAYMENT', id: 'rev-a' },
        },
        {
          id: 'n-b',
          title: 'Thông báo B',
          content: 'Mở B',
          isRead: false,
          createdAt: '2026-10-05T10:01:00.000Z',
          target: { kind: 'PAYMENT', id: 'rev-b' },
        },
      ],
      unreadCount: 2,
      nextCursor: null,
    };

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return Response.json({
          accessToken: 'tok-sys',
          user: { id: 'sys-1', email: 'sys@example.com', displayName: 'Sys', role: 'SYSTEM_ADMIN', status: 'ACTIVE' },
        });
      }
      if (url.includes('/notifications') && init?.method === 'POST') return Response.json({ ok: true });
      if (url.includes('/notifications')) return Response.json(notifs);
      if (url.endsWith('/payments/review')) return Response.json(reviewFixtures);
      if (url.endsWith('/payments/history')) return Response.json([]);
      return original(input, init);
    });

    try {
      window.history.pushState({}, '', '/system/console?view=payments');
      render(<App />);

      // Manual open from table when URL has no transactionId
      const inspectButtons = await screen.findAllByRole('button', { name: 'Kiểm tra giao dịch' });
      fireEvent.click(inspectButtons[0]!);
      await waitFor(() => expect(document.querySelector('.ant-drawer-open')).toBeTruthy());
      expect(within(document.querySelector('.system-drawer') as HTMLElement).getByText('REF-REV-A')).toBeTruthy();
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });

  it('resets review form when switching from A to B', { timeout: 60_000 }, async () => {
    const original = vi.mocked(fetch).getMockImplementation()!;
    const reviewFixtures = [
      {
        id: 'rev-a',
        providerEventId: 'evt-rev-a',
        providerTransactionReference: 'REF-REV-A',
        amountVnd: 150000,
        classification: 'UNMATCHED',
        reviewStatus: 'OPEN',
        reviewReason: null,
        reviewResolution: null,
        reviewEvidence: {},
        orderId: null,
        orderNumber: null,
        receivedAt: '2026-10-05T10:00:00.000Z',
        providerOccurredAt: '2026-10-05T09:59:00.000Z',
        reviewedAt: null,
      },
      {
        id: 'rev-b',
        providerEventId: 'evt-rev-b',
        providerTransactionReference: 'REF-REV-B',
        amountVnd: 250000,
        classification: 'UNMATCHED',
        reviewStatus: 'OPEN',
        reviewReason: null,
        reviewResolution: null,
        reviewEvidence: {},
        orderId: null,
        orderNumber: null,
        receivedAt: '2026-10-05T10:01:00.000Z',
        providerOccurredAt: '2026-10-05T10:00:00.000Z',
        reviewedAt: null,
      },
    ];
    const notifs = {
      items: [
        {
          id: 'n-b',
          title: 'Thông báo B',
          content: 'Mở B',
          isRead: false,
          createdAt: '2026-10-05T10:01:00.000Z',
          target: { kind: 'PAYMENT', id: 'rev-b' },
        },
      ],
      unreadCount: 1,
      nextCursor: null,
    };

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return Response.json({
          accessToken: 'tok-sys',
          user: { id: 'sys-1', email: 'sys@example.com', displayName: 'Sys', role: 'SYSTEM_ADMIN', status: 'ACTIVE' },
        });
      }
      if (url.includes('/notifications') && init?.method === 'POST') return Response.json({ ok: true });
      if (url.includes('/notifications')) return Response.json(notifs);
      if (url.endsWith('/payments/review')) return Response.json(reviewFixtures);
      if (url.endsWith('/payments/history')) return Response.json([]);
      return original(input, init);
    });

    try {
      window.history.pushState({}, '', '/system/console?view=payments&transactionId=rev-a');
      render(<App />);
      await waitFor(() => {
        const drawer = document.querySelector('.system-drawer') as HTMLElement | null;
        expect(drawer).toBeTruthy();
        expect(within(drawer!).getByText('REF-REV-A')).toBeTruthy();
      });

      // Enter draft in modal on A, cancel modal, then switch via notification B -> form resets
      fireEvent.click(screen.getByRole('button', { name: 'Ghi kết quả kiểm tra' }));
      fireEvent.change(await screen.findByLabelText('Lý do xử lý thanh toán'), { target: { value: 'Lý do nháp của A' } });
      fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));

      fireEvent.click(screen.getByRole('button', { name: 'Thông báo' }));
      fireEvent.click(await screen.findByRole('link', { name: 'Thông báo B' }));
      await waitFor(() => {
        const drawer = document.querySelector('.system-drawer') as HTMLElement | null;
        expect(drawer).toBeTruthy();
        expect(within(drawer!).getByText('REF-REV-B')).toBeTruthy();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Ghi kết quả kiểm tra' }));
      expect(((await screen.findByLabelText('Lý do xử lý thanh toán')) as HTMLTextAreaElement).value).toBe('');
    } finally {
      vi.mocked(fetch).mockImplementation(original);
    }
  });
});
