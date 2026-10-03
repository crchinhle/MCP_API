import { Pool, type PoolClient } from 'pg';

import type { NotificationCreateInput, NotificationRecord } from '../application/notification.service.js';
import { mapNotification } from '../presentation/notification.dto.js';

interface NotificationRow {
  id: unknown;
  title: unknown;
  content: unknown;
  is_read: unknown;
  created_at: unknown;
  read_at: unknown;
  type: unknown;
  data: unknown;
}

export class NotificationRepository {
  constructor(private readonly pool: Pool) {}

  async enqueueInTransaction(client: PoolClient, input: NotificationCreateInput): Promise<NotificationRecord> {
    const result = await client.query<NotificationRecord>(
      `INSERT INTO notifications (user_id, event_key, type, title, content, data, channel)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, event_key, channel) DO UPDATE SET updated_at = notifications.updated_at
       RETURNING id, user_id, event_key, type, title, content, data, channel, delivery_status, is_read, created_at`,
      [input.userId, input.eventKey, input.type, input.title, input.content, JSON.stringify(input.data), input.channel],
    );
    return result.rows[0]!;
  }

  async create(input: NotificationCreateInput): Promise<NotificationRecord> {
    const result = await this.pool.query<NotificationRecord>(
      `INSERT INTO notifications (user_id, event_key, type, title, content, data, channel)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, event_key, channel) DO UPDATE SET updated_at = notifications.updated_at
       RETURNING id, user_id, event_key, type, title, content, data, channel, delivery_status, is_read, created_at`,
      [input.userId, input.eventKey, input.type, input.title, input.content, JSON.stringify(input.data), input.channel],
    );
    return result.rows[0]!;
  }

  async list(userId: string, options: { cursor?: string; limit: number }): Promise<{ items: ReturnType<typeof mapNotification>[]; nextCursor: string | null }> {
    const values: unknown[] = [userId];
    let cursorClause = '';
    if (options.cursor) {
      let decoded: { createdAt?: unknown; id?: unknown };
      try {
        decoded = JSON.parse(Buffer.from(options.cursor, 'base64url').toString('utf8')) as { createdAt?: unknown; id?: unknown };
      } catch {
        throw new Error('INVALID_NOTIFICATION_CURSOR');
      }
      if (typeof decoded.createdAt !== 'string' || typeof decoded.id !== 'string') throw new Error('INVALID_NOTIFICATION_CURSOR');
      values.push(decoded.createdAt, decoded.id);
      cursorClause = ' AND (created_at, id) < ($2::timestamptz, $3::uuid)';
    }
    values.push(options.limit + 1);
    const result = await this.pool.query<NotificationRow>(
      `SELECT id, user_id, event_key, type, title, content, data, channel, delivery_status, is_read, created_at, read_at
       FROM notifications WHERE user_id = $1${cursorClause}
       ORDER BY created_at DESC, id DESC LIMIT $${values.length}`,
      values,
    );
    const hasMore = result.rows.length > options.limit;
    const rows = hasMore ? result.rows.slice(0, options.limit) : result.rows;
    const last = rows.at(-1);
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ createdAt: last.created_at instanceof Date ? last.created_at.toISOString() : String(last.created_at), id: String(last.id) })).toString('base64url')
      : null;
    return { items: rows.map(mapNotification), nextCursor };
  }

  async markRead(userId: string, notificationId: string): Promise<ReturnType<typeof mapNotification> | null> {
    const result = await this.pool.query<NotificationRow>(
      `UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, now()), updated_at = now()
       WHERE id = $1 AND user_id = $2 RETURNING id, type, title, content, is_read, created_at, read_at, data`,
      [notificationId, userId],
    );
    return result.rows[0] ? mapNotification(result.rows[0]) : null;
  }

  async registerPushToken(userId: string, token: string, provider: 'FCM' | 'EXPO') {
    const result = await this.pool.query<NotificationRecord>(
      `INSERT INTO mobile_push_tokens (user_id, token, provider, status, last_seen_at, invalidated_at)
       VALUES ($1, $2, $3, 'ACTIVE', now(), NULL)
        ON CONFLICT (token) DO UPDATE SET provider = EXCLUDED.provider,
          status = 'ACTIVE', last_seen_at = now(), invalidated_at = NULL, updated_at = now()
       RETURNING id, provider, status, last_seen_at`,
      [userId, token, provider],
    );
    return result.rows[0]!;
  }

  async unregisterPushToken(userId: string, token: string) {
    const result = await this.pool.query<NotificationRecord>(
      `UPDATE mobile_push_tokens SET status = 'INVALID', invalidated_at = now(), updated_at = now()
       WHERE user_id = $1 AND token = $2 RETURNING id, status, invalidated_at`,
      [userId, token],
    );
    return result.rows[0] ?? null;
  }

  async invalidatePushToken(token: string): Promise<void> {
    await this.pool.query(`UPDATE mobile_push_tokens SET status = 'INVALID', invalidated_at = now(), updated_at = now() WHERE token = $1`, [token]);
  }

  async healthSummary(): Promise<{ conversations: { supportActive: number; waitingSupport: number }; notifications: { deadLetter: number; pending: number; retryableFailed: number } }> {
    const result = await this.pool.query<{ waiting_support: string; support_active: string; notification_pending: string; notification_retryable: string; notification_dead_letter: string }>(
      `SELECT
         (SELECT count(*) FROM conversations WHERE status = 'WAITING_SUPPORT') AS waiting_support,
         (SELECT count(*) FROM conversations WHERE status = 'SUPPORT_ACTIVE') AS support_active,
         (SELECT count(*) FROM notifications WHERE delivery_status = 'PENDING') AS notification_pending,
         (SELECT count(*) FROM notifications WHERE delivery_status = 'RETRYABLE_FAILED') AS notification_retryable,
         (SELECT count(*) FROM notifications WHERE delivery_status = 'DEAD_LETTER') AS notification_dead_letter`,
    );
    const row = result.rows[0]!;
    return {
      conversations: { supportActive: Number(row.support_active), waitingSupport: Number(row.waiting_support) },
      notifications: { deadLetter: Number(row.notification_dead_letter), pending: Number(row.notification_pending), retryableFailed: Number(row.notification_retryable) },
    };
  }

  async claimNext(workerId: string, leaseSeconds = 300): Promise<(NotificationRecord & { attemptCount: number; channel: 'EMAIL' | 'PUSH'; eventKey: string; title: string; content: string; data: Record<string, unknown>; type: string; userId: string; email: string; pushToken: string | null }) | null> {
    const result = await this.pool.query<NotificationRecord & { attemptCount: number; channel: 'EMAIL' | 'PUSH'; eventKey: string; title: string; content: string; data: Record<string, unknown>; type: string; userId: string; email: string; pushToken: string | null }>(
      `WITH candidate AS (
         SELECT id FROM notifications
          WHERE channel <> 'IN_APP' AND delivery_status IN ('PENDING', 'RETRYABLE_FAILED')
            AND (next_attempt_at IS NULL OR next_attempt_at <= now() OR lease_expires_at <= now())
         ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
        ), claimed AS (
        UPDATE notifications n SET delivery_status = 'RETRYABLE_FAILED', attempt_count = attempt_count + 1,
          lease_owner = $1, lease_expires_at = now() + ($2 * interval '1 second'),
          next_attempt_at = now() + ($2 * interval '1 second'), last_error = $3, updated_at = now()
       FROM candidate WHERE n.id = candidate.id
       RETURNING n.*
       ) SELECT c.id, c.user_id AS "userId", u.email, token.token AS "pushToken", c.event_key AS "eventKey", c.type,
          c.title, c.content, c.data, c.channel, c.attempt_count AS "attemptCount",
          c.delivery_status AS "deliveryStatus", c.is_read AS "isRead"
       FROM claimed c JOIN users u ON u.id = c.user_id
       LEFT JOIN LATERAL (SELECT token FROM mobile_push_tokens WHERE user_id = c.user_id AND status = 'ACTIVE' ORDER BY updated_at DESC LIMIT 1) token ON TRUE`,
       [`CLAIMED_BY:${workerId}`, leaseSeconds, `CLAIMED_BY:${workerId}`],
    );
    return result.rows[0] ?? null;
  }

  async markSent(id: string, workerId?: string): Promise<void> {
    await this.pool.query(`UPDATE notifications SET delivery_status = 'SENT', sent_at = now(), next_attempt_at = NULL, lease_owner = NULL, lease_expires_at = NULL, last_error = NULL, updated_at = now() WHERE id = $1 AND ($2::text IS NULL OR lease_owner = $2)`, [id, workerId ?? null]);
  }

  async markDeliveryFailure(id: string, error: string, deadLetter: boolean, workerId?: string, retryBaseSeconds = 30): Promise<void> {
    await this.pool.query(`UPDATE notifications SET delivery_status = $2, next_attempt_at = CASE WHEN $3 THEN NULL ELSE now() + (LEAST(3600, $5 * power(2, GREATEST(attempt_count - 1, 0))) * interval '1 second') END, lease_owner = NULL, lease_expires_at = NULL, last_error = $4, updated_at = now() WHERE id = $1 AND ($6::text IS NULL OR lease_owner = $6)`, [id, deadLetter ? 'DEAD_LETTER' : 'RETRYABLE_FAILED', deadLetter, error, retryBaseSeconds, workerId ?? null]);
  }
}
