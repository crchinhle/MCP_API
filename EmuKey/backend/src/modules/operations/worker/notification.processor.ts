import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { EmailDeliveryPort } from '../application/ports/email-delivery.port.js';
import type { PushDeliveryPort } from '../application/ports/push-delivery.port.js';
import { EMAIL_DELIVERY } from '../application/ports/email-delivery.port.js';
import { PUSH_DELIVERY } from '../application/ports/push-delivery.port.js';
import { NotificationRepository } from '../infrastructure/notification.repository.js';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const NOTIFICATION_QUEUE = 'notification-delivery';

@Processor(NOTIFICATION_QUEUE, { concurrency: 1 })
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);
  constructor(
    private readonly repository: NotificationRepository,
    @Inject(EMAIL_DELIVERY) private readonly email: EmailDeliveryPort,
    @Inject(PUSH_DELIVERY) private readonly push: PushDeliveryPort,
    private readonly config: ConfigService,
    private readonly redis: Redis,
  ) { super(); }

  async process(job: Job): Promise<void> {
    const workerId = `bullmq:${job.id ?? 'scheduled'}`;
    const notification = await this.repository.claimNext(workerId, this.config.get<number>('NOTIFICATION_LEASE_SECONDS') ?? 300);
    await this.redis.set('emukey:worker:notifications', new Date().toISOString(), 'EX', 30).catch(() => {
      this.logger.warn({ event: 'notification.heartbeat.failed' });
    });
    if (!notification) return;
    const leaseOwner = notification.leaseOwner;
    let providerAttempted = false;
    let providerAcknowledged = false;
    try {
      if(!await this.repository.deliveryIsCurrent(notification.notificationId, { id: notification.id, leaseOwner })) {await this.repository.cancelDelivery(notification.id,leaseOwner);return;}
      providerAttempted = true;
      if (notification.channel === 'EMAIL') await this.email.deliver({ data: notification.data, eventKey: notification.eventKey, template: notification.type, to: notification.email });
      else if (notification.pushToken) await this.push.deliver({ body: 'Mở ứng dụng để xem thông báo.', data: { notificationId: notification.notificationId }, eventKey: notification.id, title: 'EmuKey', token: notification.pushToken });
      else throw new Error('PUSH_TOKEN_UNAVAILABLE');
      providerAcknowledged = true;
      await this.repository.markSent(notification.id, leaseOwner);
    } catch (error) {
      const invalidToken = error instanceof Error && error.name === 'INVALID_PUSH_TOKEN';
      const code = providerAcknowledged ? 'DELIVERY_ACK_PERSISTENCE_FAILED' : invalidToken ? 'INVALID_PUSH_TOKEN'
        : !providerAttempted ? 'DELIVERY_VALIDATION_FAILED'
          : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'PROVIDER_TIMEOUT'
            : error instanceof Error && /^FCM_(?:OAUTH_)?\d{3}$/.test(error.message) ? error.message : 'PROVIDER_DELIVERY_FAILED';
      const deadLetter = invalidToken || notification.attemptCount >= (this.config.get<number>('NOTIFICATION_MAX_ATTEMPTS') ?? 5);
      this.logger.warn({ event: 'notification.delivery.failed', notificationId: notification.notificationId,
        deliveryId: notification.id, attempt: notification.attemptCount, code, providerAcknowledged, deadLetter });
      if (invalidToken && notification.pushToken) await this.repository.invalidatePushToken(notification.pushToken, notification.tokenGeneration);
      await this.repository.markDeliveryFailure(notification.id, code, deadLetter, leaseOwner, this.config.get<number>('NOTIFICATION_RETRY_BASE_SECONDS') ?? 30);
    }
  }
}
