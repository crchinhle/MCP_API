import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import type { EmailDeliveryPort } from '../application/ports/email-delivery.port.js';
import type { PushDeliveryPort } from '../application/ports/push-delivery.port.js';
import { EMAIL_DELIVERY } from '../application/ports/email-delivery.port.js';
import { PUSH_DELIVERY } from '../application/ports/push-delivery.port.js';
import { NotificationRepository } from '../infrastructure/notification.repository.js';
import { ConfigService } from '@nestjs/config';

export const NOTIFICATION_QUEUE = 'notification-delivery';

@Processor(NOTIFICATION_QUEUE, { concurrency: 1 })
export class NotificationProcessor extends WorkerHost {
  constructor(
    private readonly repository: NotificationRepository,
    @Inject(EMAIL_DELIVERY) private readonly email: EmailDeliveryPort,
    @Inject(PUSH_DELIVERY) private readonly push: PushDeliveryPort,
    private readonly config: ConfigService,
  ) { super(); }

  async process(job: Job): Promise<void> {
    const workerId = `bullmq:${job.id ?? 'scheduled'}`;
    const leaseOwner = `CLAIMED_BY:${workerId}`;
    const notification = await this.repository.claimNext(workerId, this.config.get<number>('NOTIFICATION_LEASE_SECONDS') ?? 300);
    if (!notification) return;
    try {
      if (notification.channel === 'EMAIL') await this.email.deliver({ data: notification.data, eventKey: notification.eventKey, template: notification.type, to: notification.email });
      else if (notification.pushToken) await this.push.deliver({ body: notification.content, data: notification.data, eventKey: notification.eventKey, title: notification.title, token: notification.pushToken });
      else throw new Error('PUSH_TOKEN_UNAVAILABLE');
      await this.repository.markSent(notification.id, leaseOwner);
    } catch (error) {
      const invalidToken = error instanceof Error && error.name === 'INVALID_PUSH_TOKEN';
      if (invalidToken && notification.pushToken) await this.repository.invalidatePushToken(notification.pushToken);
      await this.repository.markDeliveryFailure(notification.id, error instanceof Error ? error.message : 'DELIVERY_FAILED', invalidToken || notification.attemptCount >= (this.config.get<number>('NOTIFICATION_MAX_ATTEMPTS') ?? 5), leaseOwner, this.config.get<number>('NOTIFICATION_RETRY_BASE_SECONDS') ?? 30);
    }
  }
}
