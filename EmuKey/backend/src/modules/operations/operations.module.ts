import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';

import {
  EMAIL_DELIVERY,
  type EmailDeliveryPort,
} from './application/ports/email-delivery.port.js';
import {
  PUSH_DELIVERY,
  type PushDeliveryPort,
} from './application/ports/push-delivery.port.js';
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

const notificationQueueImports = process.env.NODE_ENV === 'test'
  ? []
  : [BullModule.registerQueue({ name: 'notification-delivery' })];

@Module({
  imports: [forwardRef(() => IdentityModule), ...notificationQueueImports],
  controllers: [NotificationController, OperationsHealthController],
  providers: [
    { provide: NotificationRepository, inject: [Pool], useFactory: (pool: Pool) => new NotificationRepository(pool) },
    { provide: NotificationService, inject: [NotificationRepository], useFactory: (repository: NotificationRepository) => new NotificationService(repository) },
    ...(process.env.NODE_ENV === 'test' ? [] : [NotificationProcessor, NotificationScheduler]),
    {
      provide: EMAIL_DELIVERY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EmailDeliveryPort => {
        const adapter = config.getOrThrow<string>('EMAIL_ADAPTER');
        if (adapter === 'fake') {
          return new FakeEmailDelivery();
        }
        if (adapter === 'brevo') {
          const client = new BrevoClient({
            apiKey: config.getOrThrow<string>('BREVO_API_KEY'),
            maxRetries: 2,
            timeoutInSeconds: 30,
          });
          return new BrevoEmailDelivery(
            {
              publicWebUrl: config.getOrThrow<string>('WEB_APP_URL'),
              sender: {
                email: config.getOrThrow<string>('BREVO_SENDER_EMAIL'),
                name: config.getOrThrow<string>('BREVO_SENDER_NAME'),
              },
            },
            client,
          );
        }
        throw new Error(`Email adapter ${adapter} is not configured`);
      },
    },
    {
      provide: PUSH_DELIVERY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PushDeliveryPort => {
        const adapter = config.getOrThrow<string>('PUSH_ADAPTER');
         if (adapter === 'fake') return new FakePushDelivery();
         if (adapter === 'fcm') return new FcmPushDelivery({
           projectId: config.getOrThrow<string>('FCM_PROJECT_ID'),
           clientEmail: config.getOrThrow<string>('FCM_CLIENT_EMAIL'),
           privateKey: config.getOrThrow<string>('FCM_PRIVATE_KEY'),
           timeoutMs: config.getOrThrow<number>('FCM_TIMEOUT_MS'),
         });
         throw new Error(`Push adapter ${adapter} is not configured`);
      },
    },
  ],
  exports: [EMAIL_DELIVERY, PUSH_DELIVERY, NotificationService, NotificationRepository],
})
export class OperationsModule {}
