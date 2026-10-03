var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';
import { EMAIL_DELIVERY, } from './application/ports/email-delivery.port.js';
import { PUSH_DELIVERY, } from './application/ports/push-delivery.port.js';
import { FakeEmailDelivery } from './infrastructure/fake-email-delivery.js';
import { FakePushDelivery } from './infrastructure/fake-push-delivery.js';
import { FcmPushDelivery } from './infrastructure/fcm-push-delivery.js';
import { BrevoEmailDelivery } from './infrastructure/brevo-email-delivery.js';
import { Pool } from 'pg';
import { NotificationController } from './presentation/notification.controller.js';
import { NotificationRepository } from './infrastructure/notification.repository.js';
import { NotificationService } from './application/notification.service.js';
import { IdentityModule } from '../identity-access/identity.module.js';
import { NotificationProcessor } from './worker/notification.processor.js';
import { NotificationScheduler } from './worker/notification.scheduler.js';
import { BullModule } from '@nestjs/bullmq';
import { OperationsHealthController } from './presentation/operations-health.controller.js';
import { AuditController } from './presentation/audit.controller.js';
import { AuditService } from './application/audit.service.js';
import { AuditRepository } from './infrastructure/audit.repository.js';
const notificationQueueImports = process.env.NODE_ENV === 'test'
    ? []
    : [BullModule.registerQueue({ name: 'notification-delivery' })];
let OperationsModule = class OperationsModule {
};
OperationsModule = __decorate([
    Module({
        imports: [forwardRef(() => IdentityModule), ...notificationQueueImports],
        controllers: [NotificationController, OperationsHealthController, AuditController],
        providers: [
            { provide: AuditRepository, inject: [Pool], useFactory: (pool) => new AuditRepository(pool) },
            { provide: AuditService, inject: [AuditRepository], useFactory: (repository) => new AuditService(repository) },
            { provide: NotificationRepository, inject: [Pool], useFactory: (pool) => new NotificationRepository(pool) },
            { provide: NotificationService, inject: [NotificationRepository], useFactory: (repository) => new NotificationService(repository) },
            ...(process.env.NODE_ENV === 'test' ? [] : [NotificationProcessor, NotificationScheduler]),
            {
                provide: EMAIL_DELIVERY,
                inject: [ConfigService],
                useFactory: (config) => {
                    const adapter = config.getOrThrow('EMAIL_ADAPTER');
                    if (adapter === 'fake') {
                        return new FakeEmailDelivery();
                    }
                    if (adapter === 'brevo') {
                        const client = new BrevoClient({
                            apiKey: config.getOrThrow('BREVO_API_KEY'),
                            maxRetries: 2,
                            timeoutInSeconds: 30,
                        });
                        return new BrevoEmailDelivery({
                            publicWebUrl: config.getOrThrow('WEB_APP_URL'),
                            sender: {
                                email: config.getOrThrow('BREVO_SENDER_EMAIL'),
                                name: config.getOrThrow('BREVO_SENDER_NAME'),
                            },
                        }, client);
                    }
                    throw new Error(`Email adapter ${adapter} is not configured`);
                },
            },
            {
                provide: PUSH_DELIVERY,
                inject: [ConfigService],
                useFactory: (config) => {
                    const adapter = config.getOrThrow('PUSH_ADAPTER');
                    if (adapter === 'fake')
                        return new FakePushDelivery();
                    if (adapter === 'fcm')
                        return new FcmPushDelivery({
                            projectId: config.getOrThrow('FCM_PROJECT_ID'),
                            clientEmail: config.getOrThrow('FCM_CLIENT_EMAIL'),
                            privateKey: config.getOrThrow('FCM_PRIVATE_KEY'),
                            timeoutMs: config.getOrThrow('FCM_TIMEOUT_MS'),
                        });
                    throw new Error(`Push adapter ${adapter} is not configured`);
                },
            },
        ],
        exports: [EMAIL_DELIVERY, PUSH_DELIVERY, NotificationService, NotificationRepository],
    })
], OperationsModule);
export { OperationsModule };
//# sourceMappingURL=operations.module.js.map