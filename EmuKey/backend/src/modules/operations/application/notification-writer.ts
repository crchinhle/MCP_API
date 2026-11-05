import type { PoolClient } from 'pg';
import type { NotificationCreateInput, NotificationRecord } from './notification.service.js';

/** Published transactional interface. The caller owns commit/rollback. */
export abstract class NotificationWriter {
  abstract enqueueInTransaction(client: PoolClient, input: NotificationCreateInput): Promise<NotificationRecord>;
  abstract invalidateChainEventInTransaction(client: PoolClient, eventId: string): Promise<void>;
  abstract invalidateLicenseRemindersInTransaction(client: PoolClient, licenseId: string): Promise<void>;
}
