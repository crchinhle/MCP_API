import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

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

export class NotificationService {
  constructor(private readonly repository: {
    create(input: NotificationCreateInput): Promise<NotificationRecord>;
    list(userId: string, options: { cursor?: string; limit: number }): Promise<{ items: NotificationDto[]; nextCursor: string | null }>;
    markRead(userId: string, notificationId: string): Promise<NotificationDto | null>;
    registerPushToken(userId: string, token: string, provider: 'FCM' | 'EXPO'): Promise<NotificationRecord>;
    unregisterPushToken(userId: string, token: string): Promise<NotificationRecord | null>;
  }) {}

  create(input: NotificationCreateInput) {
    return this.repository.create(input);
  }

  async list(actor: AuthPrincipal, cursor?: string, requestedLimit?: number) {
    if (!['CUSTOMER', 'SUPPORT_STAFF', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN'].includes(actor.role)) throw new ForbiddenException();
    const limit = requestedLimit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException({ code: 'INVALID_NOTIFICATION_LIMIT' });
    try {
      return await this.repository.list(actor.sub, cursor ? { cursor, limit } : { limit });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_NOTIFICATION_CURSOR') {
        throw new BadRequestException({ code: 'INVALID_NOTIFICATION_CURSOR' });
      }
      throw error;
    }
  }

  async markRead(actor: AuthPrincipal, notificationId: string) {
    const result = await this.repository.markRead(actor.sub, notificationId);
    if (!result) throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND' });
    return result;
  }

  registerPushToken(actor: AuthPrincipal, token: string, provider: 'FCM' | 'EXPO') {
    if (!['CUSTOMER', 'SUPPORT_STAFF', 'PROVIDER_ADMIN'].includes(actor.role)) throw new ForbiddenException();
    return this.repository.registerPushToken(actor.sub, token, provider);
  }

  async unregisterPushToken(actor: AuthPrincipal, token: string) {
    if (!['CUSTOMER', 'SUPPORT_STAFF', 'PROVIDER_ADMIN'].includes(actor.role)) throw new ForbiddenException();
    const result = await this.repository.unregisterPushToken(actor.sub, token);
    if (!result) throw new NotFoundException({ code: 'PUSH_TOKEN_NOT_FOUND' });
    return result;
  }
}
