import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
export class NotificationService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    create(input) {
        return this.repository.create(input);
    }
    async list(actor, cursor, requestedLimit) {
        if (!['CUSTOMER', 'SUPPORT_STAFF', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN'].includes(actor.role))
            throw new ForbiddenException();
        const limit = requestedLimit ?? 20;
        if (!Number.isInteger(limit) || limit < 1 || limit > 50)
            throw new BadRequestException({ code: 'INVALID_NOTIFICATION_LIMIT' });
        try {
            return await this.repository.list(actor.sub, cursor ? { cursor, limit } : { limit });
        }
        catch (error) {
            if (error instanceof Error && error.message === 'INVALID_NOTIFICATION_CURSOR') {
                throw new BadRequestException({ code: 'INVALID_NOTIFICATION_CURSOR' });
            }
            throw error;
        }
    }
    async markRead(actor, notificationId) {
        const result = await this.repository.markRead(actor.sub, notificationId);
        if (!result)
            throw new NotFoundException({ code: 'NOTIFICATION_NOT_FOUND' });
        return result;
    }
    registerPushToken(actor, token, provider) {
        if (!['CUSTOMER', 'SUPPORT_STAFF', 'PROVIDER_ADMIN'].includes(actor.role))
            throw new ForbiddenException();
        return this.repository.registerPushToken(actor.sub, token, provider);
    }
    async unregisterPushToken(actor, token) {
        if (!['CUSTOMER', 'SUPPORT_STAFF', 'PROVIDER_ADMIN'].includes(actor.role))
            throw new ForbiddenException();
        const result = await this.repository.unregisterPushToken(actor.sub, token);
        if (!result)
            throw new NotFoundException({ code: 'PUSH_TOKEN_NOT_FOUND' });
        return result;
    }
}
//# sourceMappingURL=notification.service.js.map