import { NotificationDto } from './notification.dto.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { NotificationService } from '../application/notification.service.js';
import { RegisterPushTokenDto } from './push-token.dto.js';
declare class NotificationListQueryDto {
    cursor?: string;
    limit: number;
}
export declare class NotificationController {
    private readonly service;
    constructor(service: NotificationService);
    list(actor: AuthPrincipal, query: NotificationListQueryDto): Promise<{
        items: NotificationDto[];
        nextCursor: string | null;
    }>;
    markRead(actor: AuthPrincipal, notificationId: string): Promise<NotificationDto>;
    registerPushToken(actor: AuthPrincipal, dto: RegisterPushTokenDto): Promise<import("../application/notification.service.js").NotificationRecord>;
    unregisterPushToken(actor: AuthPrincipal, dto: Pick<RegisterPushTokenDto, 'token'>): Promise<import("../application/notification.service.js").NotificationRecord>;
}
export {};
