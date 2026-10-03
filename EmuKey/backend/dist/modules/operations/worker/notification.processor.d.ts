import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { EmailDeliveryPort } from '../application/ports/email-delivery.port.js';
import type { PushDeliveryPort } from '../application/ports/push-delivery.port.js';
import { NotificationRepository } from '../infrastructure/notification.repository.js';
import { ConfigService } from '@nestjs/config';
export declare const NOTIFICATION_QUEUE = "notification-delivery";
export declare class NotificationProcessor extends WorkerHost {
    private readonly repository;
    private readonly email;
    private readonly push;
    private readonly config;
    constructor(repository: NotificationRepository, email: EmailDeliveryPort, push: PushDeliveryPort, config: ConfigService);
    process(job: Job): Promise<void>;
}
