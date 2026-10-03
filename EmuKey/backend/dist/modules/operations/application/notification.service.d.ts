import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { NotificationDto } from '../presentation/notification.dto.js';
export interface NotificationCreateInput {
    channel: 'IN_APP' | 'EMAIL' | 'PUSH';
    content: string;
    data: Record<string, unknown>;
    eventKey: string;
    title: string;
    type: string;
    userId: string;
}
export interface NotificationRecord {
    deliveryStatus: string;
    id: string;
    isRead: boolean;
    userId?: string;
}
export declare class NotificationService {
    private readonly repository;
    constructor(repository: {
        create(input: NotificationCreateInput): Promise<NotificationRecord>;
        list(userId: string, options: {
            cursor?: string;
            limit: number;
        }): Promise<{
            items: NotificationDto[];
            nextCursor: string | null;
        }>;
        markRead(userId: string, notificationId: string): Promise<NotificationDto | null>;
        registerPushToken(userId: string, token: string, provider: 'FCM' | 'EXPO'): Promise<NotificationRecord>;
        unregisterPushToken(userId: string, token: string): Promise<NotificationRecord | null>;
    });
    create(input: NotificationCreateInput): Promise<NotificationRecord>;
    list(actor: AuthPrincipal, cursor?: string, requestedLimit?: number): Promise<{
        items: NotificationDto[];
        nextCursor: string | null;
    }>;
    markRead(actor: AuthPrincipal, notificationId: string): Promise<NotificationDto>;
    registerPushToken(actor: AuthPrincipal, token: string, provider: 'FCM' | 'EXPO'): Promise<NotificationRecord>;
    unregisterPushToken(actor: AuthPrincipal, token: string): Promise<NotificationRecord>;
}
