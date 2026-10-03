import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

export type TransactionClient = Pick<PoolClient, 'query'>;

export interface AuditEvent {
  action: string;
  actorRole?: string;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
  outcome?: 'DENIED' | 'FAILED' | 'SUCCESS';
  reason?: string;
  targetId?: string;
  targetType: string;
}

@Injectable()
export class AuditWriter {
  async write(client: TransactionClient, event: AuditEvent): Promise<void> {
    await client.query(
      `INSERT INTO audit_logs
        (actor_user_id, actor_role, action, target_type, target_id, reason, outcome, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.actorUserId ?? null,
        event.actorRole ?? null,
        event.action,
        event.targetType,
        event.targetId ?? null,
        event.reason ?? null,
        event.outcome ?? 'SUCCESS',
        JSON.stringify(event.metadata ?? {}),
      ],
    );
  }
}
