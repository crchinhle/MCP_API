import { describe, expect, it } from 'vitest';
import { mapNotificationRecord } from '../../../EmuKey/frontend/src/application/notifications/notificationQueries';

describe('notification HTTP consumer contract', () => {
  it('preserves the timestamp and typed navigation target sent by the backend', () => {
    const response = {
      id: 'notification-1', title: 'Thanh toán thành công', content: 'Đã nhận thanh toán',
      isRead: false, createdAt: '2026-11-01T00:00:00.000Z', readAt: null,
      target: { kind: 'ORDER' as const, id: 'order-1' },
    };
    expect(mapNotificationRecord(response)).toMatchObject(response);
  });
});
