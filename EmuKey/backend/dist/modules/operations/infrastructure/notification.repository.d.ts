import { Pool, type PoolClient } from 'pg';
import type { NotificationCreateInput, NotificationRecord } from '../application/notification.service.js';
import { mapNotification } from '../presentation/notification.dto.js';
export declare class NotificationRepository {
    private readonly pool;
    constructor(pool: Pool);
    enqueueInTransaction(client: PoolClient, input: NotificationCreateInput): Promise<NotificationRecord>;
    create(input: NotificationCreateInput): Promise<NotificationRecord>;
    list(userId: string, options: {
        cursor?: string;
        limit: number;
    }): Promise<{
        items: ReturnType<typeof mapNotification>[];
        nextCursor: string | null;
    }>;
    markRead(userId: string, notificationId: string): Promise<ReturnType<typeof mapNotification> | null>;
    registerPushToken(userId: string, token: string, provider: 'FCM' | 'EXPO'): Promise<NotificationRecord>;
    unregisterPushToken(userId: string, token: string): Promise<NotificationRecord | null>;
    invalidatePushToken(token: string): Promise<void>;
    healthSummary(): Promise<{
        conversations: {
            supportActive: number;
            waitingSupport: number;
        };
        notifications: {
            deadLetter: number;
            pending: number;
            retryableFailed: number;
        };
    }>;
    claimNext(workerId: string, leaseSeconds?: number): Promise<(NotificationRecord & {
        attemptCount: number;
        channel: 'EMAIL' | 'PUSH';
        eventKey: string;
        title: string;
        content: string;
        data: Record<string, unknown>;
        type: string;
        userId: string;
        email: string;
        pushToken: string | null;
    }) | null>;
    markSent(id: string, workerId?: string): Promise<void>;
    markDeliveryFailure(id: string, error: string, deadLetter: boolean, workerId?: string, retryBaseSeconds?: number): Promise<void>;
}
