import { describe, expect, it } from 'vitest';

import { NotificationRepository } from '../../../../EmuKey/backend/src/modules/operations/infrastructure/notification.repository.js';
import { mapNotification } from '../../../../EmuKey/backend/src/modules/operations/presentation/notification.dto.js';
import { ValidationPipe } from '@nestjs/common';
import { NotificationController } from '../../../../EmuKey/backend/src/modules/operations/presentation/notification.controller.js';
import { OperationsHealthController } from '../../../../EmuKey/backend/src/modules/operations/presentation/operations-health.controller.js';

function poolWith(rows: Record<string, unknown>[]) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  };
}

describe('notification public contract', () => {
  it('rejects malformed cursor fields before sending casts to PostgreSQL', async () => {
    const pool = poolWith([]);
    for (const value of [{ createdAt: 'not-a-date', id: 'wrong' }, { createdAt: '2026-11-01T00:00:00Z', id: 'not-a-uuid' }, { createdAt: '2026-02-30T00:00:00.000Z', id: '00000000-0000-4000-8000-000000000001' }]) {
      const cursor = Buffer.from(JSON.stringify(value)).toString('base64url');
      await expect(new NotificationRepository(pool as never).list('owner', { limit: 20, cursor })).rejects.toThrow('INVALID_NOTIFICATION_CURSOR');
    }
    expect(pool.query).not.toHaveBeenCalled();
  });
  it('reports worker liveness independently of durable backlog counts', async () => {
    const repository = { healthSummary: async () => ({ conversations: { supportActive: 0, waitingSupport: 2 }, notifications: { deadLetter: 1, pending: 3, retryableFailed: 0 } }) };
    const now = new Date().toISOString();
    const redis = { mget: vi.fn().mockResolvedValue([now, null, now]) };
    const controller = new OperationsHealthController(repository as never, redis as never);
    expect(await controller.assistance()).toMatchObject({ workers: { notifications: 'UP', supportLeases: 'DOWN', expiry: 'UP' }, notifications: { deadLetter: 1, pending: 3 } });
    redis.mget.mockRejectedValueOnce(new Error('Redis offline'));
    expect(await controller.assistance()).toMatchObject({ workers: { notifications: 'UNKNOWN', supportLeases: 'UNKNOWN', expiry: 'UNKNOWN' } });
  });
  it('does not report restored stale heartbeats as live even when their Redis keys exist', async () => {
    const now = Date.now();
    const repository = { healthSummary: async () => ({}) };
    const values = [30_001, 90_001, 7_200_001].map((age) => new Date(now - age).toISOString());
    const controller = new OperationsHealthController(repository as never, { mget: async () => values } as never);
    expect(await controller.assistance()).toMatchObject({ workers: { notifications: 'DOWN', supportLeases: 'DOWN', expiry: 'DOWN' } });
  });
  it('reports malformed or implausibly future heartbeat timestamps as unknown', async () => {
    const controller = new OperationsHealthController({ healthSummary: async () => ({}) } as never,
      { mget: async () => ['not-a-timestamp', new Date(Date.now() + 60_000).toISOString(), null] } as never);
    expect(await controller.assistance()).toMatchObject({ workers: { notifications: 'UNKNOWN', supportLeases: 'UNKNOWN', expiry: 'DOWN' } });
  });
  it('accepts a numeric query string limit through the real controller DTO', async () => {
    const dto = Reflect.getMetadata('design:paramtypes', NotificationController.prototype, 'list')[1];
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
    await expect(pipe.transform({ limit: '20' }, { type: 'query', metatype: dto })).resolves.toMatchObject({ limit: 20 });
    for (const limit of ['0', '51', 'abc', '1.5', ['20']]) {
      await expect(pipe.transform({ limit }, { type: 'query', metatype: dto })).rejects.toMatchObject({ status: 400 });
    }
  });

  it('maps the actual payment event and its historical alias to the same order', () => {
    for (const type of ['PAYMENT_ACCEPTED', 'ORDER_PAYMENT_ACCEPTED']) {
      expect(mapNotification({ id: 'n', title: 'Paid', content: 'Paid', is_read: false, created_at: new Date(), read_at: null, type, data: { orderId: 'order-1' } }).target)
        .toEqual({ kind: 'ORDER', id: 'order-1' });
    }
  });
  it('maps a raw row to the camelCase DTO and never leaks snake_case columns', () => {
    const dto = mapNotification({
      id: 'n1',
      content: 'A license is ready.',
      created_at: new Date('2026-09-30T10:00:00.000Z'),
      data: { licenseId: 'license-1' },
      is_read: false,
      read_at: null,
      title: 'License ready',
      type: 'LICENSE_CONFIRMED',
    });

    expect(dto).toEqual({
      id: 'n1',
      title: 'License ready',
      content: 'A license is ready.',
      isRead: false,
      createdAt: '2026-09-30T10:00:00.000Z',
      readAt: null,
      target: { kind: 'LICENSE', id: 'license-1' },
    });
    expect(Object.keys(dto)).not.toContain('is_read');
    expect(Object.keys(dto)).not.toContain('created_at');
  });

  it('derives a typed target only from an allowlisted event type', () => {
    expect(mapNotification({ id: 'n', title: 't', content: 'c', is_read: true, created_at: new Date(), read_at: new Date(), type: 'SUPPORT_ASSIGNED', data: { conversationId: 'conv-1' } }).target)
      .toEqual({ kind: 'CONVERSATION', id: 'conv-1' });
    expect(mapNotification({ id: 'n', title: 't', content: 'c', is_read: true, created_at: new Date(), read_at: null, type: 'UNKNOWN_EVENT', data: { anything: 'goes' } }).target)
      .toBeNull();
    expect(mapNotification({ id: 'n', title: 't', content: 'c', is_read: true, created_at: new Date(), read_at: null, type: 'LICENSE_CONFIRMED', data: { userId: 'not-a-license' } }).target)
      .toEqual({ kind: 'LICENSE', id: null });
  });

  it('lists camelCase records for the owning user', async () => {
    const pool = poolWith([{
      id: 'n1',
      type: 'LICENSE_CONFIRMED',
      title: 'License ready',
      content: 'Ready',
      is_read: false,
      created_at: new Date('2026-09-30T10:00:00.000Z'),
      read_at: null,
      data: { licenseId: 'license-1' },
    }]);
    const repository = new NotificationRepository(pool as never);

    const page = await repository.list('user-1', { limit: 20 });
    const record = page.items[0];

    expect(record).toMatchObject({ id: 'n1', isRead: false, readAt: null, createdAt: '2026-09-30T10:00:00.000Z' });
    expect(page.nextCursor).toBeNull();
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('FROM notifications'), ['user-1', 21]);
    expect(JSON.stringify(record)).not.toContain('is_read');
  });

  it('counts every unread inbox item independently of the loaded page', async () => {
    const pool = { query: vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ unread_count: '45' }] }) };
    const page = await new NotificationRepository(pool as never).list('owner', { limit: 20 });
    expect(page).toMatchObject({ items: [], nextCursor: null, unreadCount: 45 });
    expect(pool.query.mock.calls[1]?.[1]).toEqual(['owner']);
  });

  it('returns the mapped record from markRead and null when not owned', async () => {
    const pool = poolWith([]);
    const repository = new NotificationRepository(pool as never);

    await expect(repository.markRead('user-1', 'n1')).resolves.toBeNull();

    pool.query.mockResolvedValueOnce({ rows: [{ id: 'n1', type: 'LICENSE_CONFIRMED', title: 't', content: 'c', is_read: true, created_at: new Date(), read_at: new Date(), data: {} }] });
    const read = await repository.markRead('user-1', 'n1');
    expect(read).toMatchObject({ id: 'n1', isRead: true });
    expect(read?.readAt).toBeTruthy();
  });
});
