import type { NotificationWriter } from '../application/notification-writer.js';
import { randomUUID } from 'node:crypto';
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

export class NotificationRepository implements NotificationWriter {
  constructor(private readonly pool: Pool) {}

  async invalidateChainEventInTransaction(client: PoolClient, eventId: string): Promise<void> {
    await client.query(`UPDATE notifications SET inbox_visible=false,updated_at=statement_timestamp()
      WHERE data->>'chainEventId'=$1 AND type<>'LICENSE_STATUS_RECHECK'`, [eventId]);
    await client.query(`UPDATE notification_deliveries d SET delivery_status='CANCELLED',lease_owner=NULL,
      lease_expires_at=NULL,next_attempt_at=NULL,updated_at=statement_timestamp()
      FROM notifications n WHERE d.notification_id=n.id AND n.data->>'chainEventId'=$1
      AND n.type<>'LICENSE_STATUS_RECHECK' AND d.delivery_status IN ('PENDING','RETRYABLE_FAILED')`, [eventId]);
  }

  async invalidateLicenseRemindersInTransaction(client: PoolClient, licenseId: string): Promise<void> {
    await client.query(`UPDATE notifications n SET inbox_visible=false,updated_at=statement_timestamp()
      WHERE n.type='LICENSE_EXPIRING' AND n.data->>'licenseId'=$1 AND NOT EXISTS(
        SELECT 1 FROM licenses l JOIN chain_events ce ON ce.id=l.last_applied_chain_event_id
        WHERE l.id=$1::uuid AND l.status='ACTIVE' AND ce.finality_status='CONFIRMED'
        AND l.expires_at>statement_timestamp() AND l.expires_at=(n.data->>'expiresAt')::timestamptz)`, [licenseId]);
    await client.query(`UPDATE notification_deliveries d SET delivery_status='CANCELLED',lease_owner=NULL,
      lease_expires_at=NULL,next_attempt_at=NULL,updated_at=statement_timestamp()
      FROM notifications n WHERE d.notification_id=n.id AND n.type='LICENSE_EXPIRING'
      AND n.data->>'licenseId'=$1 AND NOT n.inbox_visible AND d.delivery_status IN ('PENDING','RETRYABLE_FAILED')`, [licenseId]);
  }

  async find(userId:string,id:string) {
    const result=await this.pool.query<NotificationRow>(`SELECT id,type,title,content,(read_at IS NOT NULL) AS is_read,
      created_at,read_at,data FROM notifications WHERE user_id=$1 AND id=$2 AND inbox_visible`,[userId,id]);
    return result.rows[0]?mapNotification(result.rows[0]):null;
  }

  async enqueueInTransaction(client: PoolClient, input: NotificationCreateInput): Promise<NotificationRecord> {
    // Lock the logical event so retries never add devices registered after its creation.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`notification:${input.userId}:${input.eventKey}`]);
    const existing = await client.query<NotificationRecord>(`SELECT id, (read_at IS NOT NULL) AS "isRead" FROM notifications WHERE user_id=$1 AND event_key=$2`, [input.userId, input.eventKey]);
    if (existing.rows[0]) {
      if (input.type === 'LICENSE_EXPIRING') await client.query(
        "UPDATE notifications SET inbox_visible=true,updated_at=statement_timestamp() WHERE id=$1 AND NOT inbox_visible", [existing.rows[0].id]);
      return existing.rows[0];
    }
    const result = await client.query<NotificationRecord>(
      `INSERT INTO notifications (user_id, event_key, type, title, content, data, inbox_visible)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, user_id AS "userId", FALSE AS "isRead"`,
      [input.userId, input.eventKey, input.type, input.title, input.content, JSON.stringify(input.data), input.channel !== 'EMAIL'],
    );
    const notification = result.rows[0]!;
    if (input.channel === 'EMAIL') {
      await client.query(`INSERT INTO notification_deliveries (notification_id,channel,destination_key)
        SELECT $1,'EMAIL',email FROM users WHERE id=$2`, [notification.id,input.userId]);
    } else {
      await client.query(`INSERT INTO notification_deliveries (notification_id,channel,push_token_id,token_generation,destination_key)
        SELECT $1,'PUSH',id,generation,id::text || ':' || generation FROM mobile_push_tokens
        WHERE user_id=$2 AND status='ACTIVE' AND provider='FCM'`, [notification.id,input.userId]);
    }
    return notification;
  }

  async create(input: NotificationCreateInput): Promise<NotificationRecord> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await this.enqueueInTransaction(client, input);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async list(userId: string, options: { cursor?: string; limit: number }): Promise<{ items: ReturnType<typeof mapNotification>[]; nextCursor: string | null; unreadCount: number }> {
    const values: unknown[] = [userId];
    let cursorClause = '';
    if (options.cursor) {
      let decoded: { createdAt?: unknown; id?: unknown };
      try {
        decoded = JSON.parse(Buffer.from(options.cursor, 'base64url').toString('utf8')) as { createdAt?: unknown; id?: unknown };
      } catch {
        throw new Error('INVALID_NOTIFICATION_CURSOR');
      }
      if (typeof decoded.createdAt !== 'string' || typeof decoded.id !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:\d{3})?Z$/.test(decoded.createdAt) ||
          !Number.isFinite(Date.parse(decoded.createdAt)) ||
          new Date(decoded.createdAt).toISOString() !== decoded.createdAt.replace(/(\.\d{3})\d{3}Z$/, '$1Z') ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(decoded.id)) throw new Error('INVALID_NOTIFICATION_CURSOR');
      values.push(decoded.createdAt, decoded.id);
      // Old cursors stored JS milliseconds. Recover their exact timestamp from
      // the owned row; new cursors carry PostgreSQL microseconds themselves.
      const timestamp = /\.\d{3}Z$/.test(decoded.createdAt)
        ? "COALESCE((SELECT cursor_row.created_at FROM notifications cursor_row WHERE cursor_row.id=$3::uuid AND cursor_row.user_id=$1), $2::timestamptz)"
        : '$2::timestamptz';
      cursorClause = ` AND (created_at, id) < (${timestamp}, $3::uuid)`;
    }
    values.push(options.limit + 1);
    const result = await this.pool.query<NotificationRow & { cursor_created_at: string }>(
      `SELECT id, user_id, event_key, type, title, content, data, (read_at IS NOT NULL) AS is_read, created_at, read_at,
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at
       FROM notifications WHERE user_id = $1 AND inbox_visible${cursorClause}
       ORDER BY created_at DESC, id DESC LIMIT $${values.length}`,
      values,
    );
    const hasMore = result.rows.length > options.limit;
    const rows = hasMore ? result.rows.slice(0, options.limit) : result.rows;
    const last = rows.at(-1);
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ createdAt: String(last.cursor_created_at), id: String(last.id) })).toString('base64url')
      : null;
    const count = await this.pool.query<{ unread_count: string }>(
      'SELECT count(*) AS unread_count FROM notifications WHERE user_id=$1 AND inbox_visible AND read_at IS NULL', [userId],
    );
    return { items: rows.map(mapNotification), nextCursor, unreadCount: Number(count.rows[0]?.unread_count ?? 0) };
  }

  async markRead(userId: string, notificationId: string): Promise<ReturnType<typeof mapNotification> | null> {
    const result = await this.pool.query<NotificationRow>(
      `UPDATE notifications SET read_at = COALESCE(read_at, now()), updated_at = now()
       WHERE id = $1 AND user_id = $2 AND inbox_visible RETURNING id, type, title, content, (read_at IS NOT NULL) AS is_read, created_at, read_at, data`,
      [notificationId, userId],
    );
    return result.rows[0] ? mapNotification(result.rows[0]) : null;
  }

  async registerPushToken(userId: string, token: string, provider: 'FCM' | 'EXPO') {
    const result = await this.pool.query<NotificationRecord>(
      `INSERT INTO mobile_push_tokens (user_id, token, provider, status, last_seen_at, invalidated_at)
       VALUES ($1, $2, $3, 'ACTIVE', now(), NULL)
        ON CONFLICT (token) DO UPDATE SET provider = EXCLUDED.provider,
          user_id = EXCLUDED.user_id,
          generation = mobile_push_tokens.generation + CASE WHEN mobile_push_tokens.user_id <> EXCLUDED.user_id OR mobile_push_tokens.status <> 'ACTIVE' THEN 1 ELSE 0 END,
          status = 'ACTIVE', last_seen_at = now(), invalidated_at = NULL, updated_at = now()
       RETURNING id, provider, status, last_seen_at`,
      [userId, token, provider],
    );
    await this.cancelStaleDeliveries();
    return result.rows[0]!;
  }

  async unregisterPushToken(userId: string, token: string) {
    const result = await this.pool.query<NotificationRecord>(
      `UPDATE mobile_push_tokens SET status = 'INVALID', generation = generation + 1, invalidated_at = now(), updated_at = now()
       WHERE user_id = $1 AND token = $2 RETURNING id, status, invalidated_at`,
      [userId, token],
    );
    await this.cancelStaleDeliveries();
    return result.rows[0] ?? null;
  }

  async invalidatePushToken(token: string, generation: number): Promise<void> {
    await this.pool.query(`UPDATE mobile_push_tokens SET status = 'INVALID', generation = generation + 1, invalidated_at = now(), updated_at = now() WHERE token = $1 AND generation = $2`, [token, generation]);
    await this.cancelStaleDeliveries();
  }

  async healthSummary(): Promise<{ conversations: { supportActive: number; waitingSupport: number }; notifications: { deadLetter: number; pending: number; retryableFailed: number } }> {
    const result = await this.pool.query<{ waiting_support: string; support_active: string; notification_pending: string; notification_retryable: string; notification_dead_letter: string }>(
      `SELECT
         (SELECT count(*) FROM conversations WHERE status = 'WAITING_SUPPORT') AS waiting_support,
         (SELECT count(*) FROM conversations WHERE status = 'SUPPORT_ACTIVE') AS support_active,
         (SELECT count(*) FROM notification_deliveries WHERE delivery_status = 'PENDING') AS notification_pending,
         (SELECT count(*) FROM notification_deliveries WHERE delivery_status = 'RETRYABLE_FAILED') AS notification_retryable,
         (SELECT count(*) FROM notification_deliveries WHERE delivery_status = 'DEAD_LETTER') AS notification_dead_letter`,
    );
    const row = result.rows[0]!;
    return {
      conversations: { supportActive: Number(row.support_active), waitingSupport: Number(row.waiting_support) },
      notifications: { deadLetter: Number(row.notification_dead_letter), pending: Number(row.notification_pending), retryableFailed: Number(row.notification_retryable) },
    };
  }

  private async cancelStaleDeliveries(): Promise<void> {
    await this.pool.query(`UPDATE notification_deliveries d SET delivery_status='CANCELLED',
      lease_owner=NULL,lease_expires_at=NULL,next_attempt_at=NULL,updated_at=now()
      FROM notifications n WHERE d.notification_id=n.id AND d.delivery_status IN ('PENDING','RETRYABLE_FAILED')
      AND n.type<>'LICENSE_STATUS_RECHECK' AND n.data ? 'chainEventId'
      AND NOT EXISTS (SELECT 1 FROM chain_events ce WHERE ce.id::text=n.data->>'chainEventId'
        AND ce.finality_status='CONFIRMED' AND ce.block_hash=n.data->>'canonicalBlockHash'
        AND ce.reorg_count::text=n.data->>'reorgCount')`);
    await this.pool.query(`UPDATE notification_deliveries d SET delivery_status='CANCELLED',
      lease_owner=NULL, lease_expires_at=NULL, next_attempt_at=NULL, updated_at=now()
      FROM notifications n, mobile_push_tokens t
      WHERE d.notification_id=n.id AND d.push_token_id=t.id
        AND d.delivery_status IN ('PENDING','RETRYABLE_FAILED')
        AND (t.user_id<>n.user_id OR t.generation<>d.token_generation OR t.status<>'ACTIVE')`);
  }

  async deliveryIsCurrent(notificationId:string, claim?: { id: string; leaseOwner: string }):Promise<boolean> {
    const result=await this.pool.query(`SELECT 1 FROM notifications n WHERE n.id=$1 AND
      (n.type='LICENSE_STATUS_RECHECK' OR NOT (n.data ? 'chainEventId') OR EXISTS (
        SELECT 1 FROM chain_events ce WHERE ce.id::text=n.data->>'chainEventId' AND ce.finality_status='CONFIRMED'
        AND ce.block_hash=n.data->>'canonicalBlockHash' AND ce.reorg_count::text=n.data->>'reorgCount'))
      AND (n.type<>'LICENSE_EXPIRING' OR EXISTS(SELECT 1 FROM licenses l WHERE l.id::text=n.data->>'licenseId'
        AND l.status='ACTIVE' AND l.expires_at>statement_timestamp() AND l.expires_at=(n.data->>'expiresAt')::timestamptz))
      AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM notification_deliveries d
        LEFT JOIN mobile_push_tokens t ON t.id=d.push_token_id
        WHERE d.id=$2 AND d.notification_id=n.id AND d.lease_owner=$3
          AND d.delivery_status='RETRYABLE_FAILED' AND d.lease_expires_at>clock_timestamp()
          AND (d.channel='EMAIL' OR (t.status='ACTIVE' AND t.user_id=n.user_id AND t.generation=d.token_generation))))`,
      [notificationId, claim?.id ?? null, claim?.leaseOwner ?? null]);
    return result.rows.length>0;
  }

  async cancelDelivery(id:string,leaseOwner:string) {
    await this.pool.query(`UPDATE notification_deliveries SET delivery_status='CANCELLED',lease_owner=NULL,lease_expires_at=NULL,
      next_attempt_at=NULL,updated_at=now() WHERE id=$1 AND lease_owner=$2`,[id,leaseOwner]);
  }

  async createExpiryReminders():Promise<number> {
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      const rows=await client.query<{id:string;customer_user_id:string;expires_at:Date;days:number}>(`SELECT l.id,l.customer_user_id,l.expires_at,m.days
        FROM licenses l CROSS JOIN (VALUES(7),(1)) m(days)
        JOIN chain_events ce ON ce.id=l.last_applied_chain_event_id AND ce.finality_status='CONFIRMED'
        WHERE l.status='ACTIVE' AND l.expires_at>statement_timestamp()
          AND l.expires_at<=statement_timestamp()+m.days*interval '1 day'
          AND (m.days=1 OR l.expires_at>statement_timestamp()+interval '1 day')
          AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=l.customer_user_id AND n.inbox_visible
            AND n.event_key='expiry:'||l.id::text||':'||to_char(l.expires_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')||':'||m.days::text)
        ORDER BY l.expires_at,l.id LIMIT 1000 FOR SHARE OF l SKIP LOCKED`);
      for(const row of rows.rows) await this.enqueueInTransaction(client,{channel:'IN_APP',type:'LICENSE_EXPIRING',title:'Bản quyền sắp hết hạn',
        content:`Bản quyền còn không quá ${row.days} ngày. Mở bản quyền để gia hạn.`,userId:row.customer_user_id,
        eventKey:`expiry:${row.id}:${row.expires_at.toISOString()}:${row.days}`,data:{licenseId:row.id,expiresAt:row.expires_at.toISOString()}});
      await client.query('COMMIT');return rows.rows.length;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  async claimNext(workerId: string, leaseSeconds = 300) {
    await this.cancelStaleDeliveries();
    // A BullMQ job may be redelivered with the same ID after a stalled worker.
    // Each database claim needs its own fencing token, not just a worker label.
    const leaseOwner = `CLAIMED_BY:${workerId.slice(0, 130)}:${randomUUID()}`;
    const result = await this.pool.query<NotificationRecord & { leaseOwner: string; notificationId: string; tokenGeneration: number; attemptCount: number; channel: 'EMAIL' | 'PUSH'; eventKey: string; title: string; content: string; data: Record<string, unknown>; type: string; userId: string; email: string; pushToken: string | null }>(
      `WITH candidate AS (
        SELECT d.id FROM notification_deliveries d
        WHERE d.delivery_status IN ('PENDING','RETRYABLE_FAILED')
          AND (d.next_attempt_at IS NULL OR d.next_attempt_at<=now())
          AND (d.lease_expires_at IS NULL OR d.lease_expires_at<=now())
        ORDER BY d.created_at,d.id FOR UPDATE SKIP LOCKED LIMIT 1
      ), claimed AS (
        UPDATE notification_deliveries d SET delivery_status='RETRYABLE_FAILED',attempt_count=attempt_count+1,
          lease_owner=$1,lease_expires_at=now()+($2*interval '1 second'),updated_at=now()
        FROM candidate c WHERE d.id=c.id RETURNING d.*
      ) SELECT d.id,d.lease_owner AS "leaseOwner",n.id AS "notificationId",n.user_id AS "userId", d.destination_key AS email,
        t.token AS "pushToken",d.token_generation AS "tokenGeneration", n.event_key AS "eventKey",n.type,
        n.title,n.content,n.data,d.channel,d.attempt_count AS "attemptCount",
        d.delivery_status AS "deliveryStatus",(n.read_at IS NOT NULL) AS "isRead"
        FROM claimed d JOIN notifications n ON n.id=d.notification_id
        LEFT JOIN mobile_push_tokens t ON t.id=d.push_token_id AND t.user_id=n.user_id
          AND t.generation=d.token_generation AND t.status='ACTIVE'`,
      [leaseOwner,leaseSeconds],
    );
    return result.rows[0] ?? null;
  }

  async markSent(id: string, workerId: string): Promise<void> {
    await this.cancelStaleDeliveries();
    await this.pool.query(`UPDATE notification_deliveries SET delivery_status='SENT',sent_at=now(),
      next_attempt_at=NULL,lease_owner=NULL,lease_expires_at=NULL,last_error=NULL,updated_at=now()
      WHERE id=$1 AND lease_owner=$2 AND lease_expires_at>now() AND delivery_status='RETRYABLE_FAILED'`, [id,workerId]);
  }

  async markDeliveryFailure(id: string, error: string, deadLetter: boolean, workerId: string, retryBaseSeconds = 30): Promise<void> {
    await this.pool.query(`UPDATE notification_deliveries SET delivery_status=$2,
      next_attempt_at=CASE WHEN $3 THEN NULL ELSE now()+(LEAST(3600,$5*power(2,GREATEST(attempt_count-1,0)))*interval '1 second') END,
      lease_owner=NULL,lease_expires_at=NULL,last_error=$4,updated_at=now()
      WHERE id=$1 AND lease_owner=$6 AND lease_expires_at>now() AND delivery_status='RETRYABLE_FAILED'`,
      [id,deadLetter?'DEAD_LETTER':'RETRYABLE_FAILED',deadLetter,error,retryBaseSeconds,workerId]);
  }
}
