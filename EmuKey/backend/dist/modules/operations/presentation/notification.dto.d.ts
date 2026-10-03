export declare class NotificationDto {
    id: string;
    title: string;
    content: string;
    isRead: boolean;
    createdAt: string;
    readAt: string | null;
    target: NotificationTarget | null;
}
export interface NotificationTarget {
    kind: 'LICENSE' | 'ORDER' | 'CONVERSATION' | 'PAYMENT' | 'SYSTEM';
    id: string | null;
}
export declare function mapNotification(row: {
    id: unknown;
    title: unknown;
    content: unknown;
    is_read: unknown;
    created_at: unknown;
    read_at: unknown;
    type: unknown;
    data: unknown;
}): NotificationDto;
