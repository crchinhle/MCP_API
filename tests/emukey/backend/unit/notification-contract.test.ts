import { describe, expect, it } from 'vitest';

import { NotificationRepository } from '../../../../EmuKey/backend/src/modules/operations/infrastructure/notification.repository.js';
import { mapNotification } from '../../../../EmuKey/backend/src/modules/operations/presentation/notification.dto.js';

function poolWith(rows: Record<string, unknown>[]) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  };
}

describe('notification public contract', () => {
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