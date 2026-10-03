import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { requestJson } from '../auth/authContext';

export interface NotificationRecord {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly isRead: boolean;
  readonly createdAt?: string;
  readonly readAt?: string | null;
  readonly target: { kind: 'LICENSE' | 'ORDER' | 'CONVERSATION' | 'PAYMENT' | 'SYSTEM'; id: string | null } | null;
  readonly type?: string;
}

export interface NotificationApiRecord {
  readonly id: string;
  readonly body?: string | null;
  readonly content?: string | null;
  readonly eventType?: string;
  readonly isRead?: boolean;
  readonly metadata?: Record<string, unknown> | null;
  readonly occurredAt?: string | null;
  readonly readAt?: string | null;
  readonly title?: string | null;
}

export interface NotificationPage {
  readonly items: NotificationApiRecord[];
  readonly nextCursor: string | null;
}

export const notificationTypeLabels: Record<string, string> = {
  LICENSE_ACTIVATED: 'Bản quyền đã kích hoạt',
  LICENSE_EXPIRING: 'Bản quyền sắp hết hạn',
  LICENSE_REVOKED: 'Bản quyền đã thu hồi',
  ORDER_CONFIRMED: 'Đơn hàng đã xác nhận',
  PAYMENT_CONFIRMED: 'Thanh toán đã xác nhận',
  SUPPORT_REPLY: 'Nhân viên hỗ trợ đã phản hồi',
};

// The HTTP contract may send either the stable canonical fields or the
// older title/body aliases. Map both into one display record.
export function mapNotificationRecord(source: NotificationApiRecord): NotificationRecord {
  const type = typeof source.eventType === 'string' ? source.eventType : undefined;
  const title = source.title
    ?? (type ? notificationTypeLabels[type] : undefined)
    ?? 'Thông báo';
  const createdAt = source.occurredAt ?? undefined;
  return {
    id: source.id,
    title,
    content: source.content ?? source.body ?? '',
    isRead: source.isRead === true,
    ...(createdAt ? { createdAt } : {}),
    ...(source.readAt !== undefined ? { readAt: source.readAt } : {}),
    target: source.metadata && typeof source.metadata.target === 'object' ? source.metadata.target as NotificationRecord['target'] : null,
    ...(type ? { type } : {}),
  };
}

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: ['notifications'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.set('cursor', pageParam);
      const page = await requestJson<NotificationPage>(`/notifications?${params.toString()}`);
      return { items: page.items.map(mapNotificationRecord), nextCursor: page.nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => requestJson<NotificationApiRecord>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }).then(mapNotificationRecord),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
