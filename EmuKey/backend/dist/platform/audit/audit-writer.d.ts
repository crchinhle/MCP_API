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
export declare class AuditWriter {
    write(client: TransactionClient, event: AuditEvent): Promise<void>;
}
