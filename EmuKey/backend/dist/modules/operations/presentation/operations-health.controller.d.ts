import { NotificationRepository } from '../infrastructure/notification.repository.js';
export declare class OperationsHealthController {
    private readonly notifications;
    constructor(notifications: NotificationRepository);
    assistance(): Promise<{
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
}
