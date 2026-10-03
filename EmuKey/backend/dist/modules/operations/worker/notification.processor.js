var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { EMAIL_DELIVERY } from '../application/ports/email-delivery.port.js';
import { PUSH_DELIVERY } from '../application/ports/push-delivery.port.js';
import { NotificationRepository } from '../infrastructure/notification.repository.js';
import { ConfigService } from '@nestjs/config';
export const NOTIFICATION_QUEUE = 'notification-delivery';
let NotificationProcessor = class NotificationProcessor extends WorkerHost {
    repository;
    email;
    push;
    config;
    constructor(repository, email, push, config) {
        super();
        this.repository = repository;
        this.email = email;
        this.push = push;
        this.config = config;
    }
    async process(job) {
        const workerId = `bullmq:${job.id ?? 'scheduled'}`;
        const leaseOwner = `CLAIMED_BY:${workerId}`;
        const notification = await this.repository.claimNext(workerId, this.config.get('NOTIFICATION_LEASE_SECONDS') ?? 300);
        if (!notification)
            return;
        try {
            if (notification.channel === 'EMAIL')
                await this.email.deliver({ data: notification.data, eventKey: notification.eventKey, template: notification.type, to: notification.email });
            else if (notification.pushToken)
                await this.push.deliver({ body: notification.content, data: notification.data, eventKey: notification.eventKey, title: notification.title, token: notification.pushToken });
            else
                throw new Error('PUSH_TOKEN_UNAVAILABLE');
            await this.repository.markSent(notification.id, leaseOwner);
        }
        catch (error) {
            const invalidToken = error instanceof Error && error.name === 'INVALID_PUSH_TOKEN';
            if (invalidToken && notification.pushToken)
                await this.repository.invalidatePushToken(notification.pushToken);
            await this.repository.markDeliveryFailure(notification.id, error instanceof Error ? error.message : 'DELIVERY_FAILED', invalidToken || notification.attemptCount >= (this.config.get('NOTIFICATION_MAX_ATTEMPTS') ?? 5), leaseOwner, this.config.get('NOTIFICATION_RETRY_BASE_SECONDS') ?? 30);
        }
    }
};
NotificationProcessor = __decorate([
    Processor(NOTIFICATION_QUEUE, { concurrency: 1 }),
    __param(1, Inject(EMAIL_DELIVERY)),
    __param(2, Inject(PUSH_DELIVERY)),
    __metadata("design:paramtypes", [NotificationRepository, Object, Object, ConfigService])
], NotificationProcessor);
export { NotificationProcessor };
//# sourceMappingURL=notification.processor.js.map