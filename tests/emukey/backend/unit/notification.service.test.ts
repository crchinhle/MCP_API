import { NotificationService } from '../../../../EmuKey/backend/src/modules/operations/application/notification.service.js';
import { NotificationProcessor } from '../../../../EmuKey/backend/src/modules/operations/worker/notification.processor.js';
import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { NotificationScheduler } from '../../../../EmuKey/backend/src/modules/operations/worker/notification.scheduler.js';

describe('NotificationService', () => {
  it('restores the poller on Redis ready and removes the recovery listener on shutdown', async () => {
    const queue = { upsertJobScheduler: vi.fn().mockResolvedValue({}) };
    const repository = { createExpiryReminders: vi.fn().mockResolvedValue(0) };
    const redis = Object.assign(new EventEmitter(), { set: vi.fn().mockResolvedValue('OK') });
    const scheduler = new NotificationScheduler(queue as never, repository as never, redis as never);
    try {
      await scheduler.onModuleInit();
      expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(1);
      redis.emit('ready');
      await vi.waitFor(() => expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(repository.createExpiryReminders).toHaveBeenCalledTimes(2));
      expect(redis.set).toHaveBeenCalledWith('emukey:worker:expiry', expect.any(String), 'EX', 7200);
      expect(queue.upsertJobScheduler.mock.calls[1]).toEqual(queue.upsertJobScheduler.mock.calls[0]);
      scheduler.onModuleDestroy();
      expect(redis.listenerCount('ready')).toBe(0);
      redis.emit('ready');
      expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2);
    } finally { scheduler.onModuleDestroy(); }
  });
  it('logs a bounded poller recovery error and can recover on the next Redis ready event', async () => {
    const queue = { upsertJobScheduler: vi.fn().mockResolvedValue({}) };
    const repository = { createExpiryReminders: vi.fn().mockResolvedValue(0) };
    const redis = Object.assign(new EventEmitter(), { set: vi.fn().mockResolvedValue('OK') });
    const scheduler = new NotificationScheduler(queue as never, repository as never, redis as never);
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      await scheduler.onModuleInit();
      queue.upsertJobScheduler.mockRejectedValueOnce(new Error('private-connection-detail'));
      redis.emit('ready');
      await vi.waitFor(() => expect(error).toHaveBeenCalledWith({ event: 'notification.poller.restore.failed' }));
      expect(JSON.stringify(error.mock.calls)).not.toContain('private-connection-detail');
      redis.emit('ready');
      await vi.waitFor(() => expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(3));
    } finally { scheduler.onModuleDestroy(); error.mockRestore(); }
  });
  it.each([false, true])('records a safe correlated failure when the provider acknowledgement was accepted: %s', async (accepted) => {
    const privateMessage = 'private-action-token-and-message-body';
    const notification = { id: 'delivery', notificationId: 'notice', leaseOwner: 'claim', channel: 'EMAIL', data: {}, eventKey: 'event', type: 'TEST', email: 'fixture@example.test', attemptCount: 1 };
    const repository = { claimNext: vi.fn().mockResolvedValue(notification), deliveryIsCurrent: vi.fn().mockResolvedValue(true), markSent: vi.fn().mockRejectedValue(new Error(privateMessage)), markDeliveryFailure: vi.fn() };
    const email = { deliver: accepted ? vi.fn().mockResolvedValue({ providerMessageId: 'receipt' }) : vi.fn().mockRejectedValue(new Error(privateMessage)) };
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      await new NotificationProcessor(repository as never, email as never, {} as never, { get: () => undefined } as never, { set: async () => 'OK' } as never).process({ id: 'job' } as never);
      const code = accepted ? 'DELIVERY_ACK_PERSISTENCE_FAILED' : 'PROVIDER_DELIVERY_FAILED';
      expect(repository.markDeliveryFailure).toHaveBeenCalledWith('delivery', code, false, 'claim', 30);
      expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'notification.delivery.failed', notificationId: 'notice', deliveryId: 'delivery', code, providerAcknowledged: accepted }));
      expect(JSON.stringify(warn.mock.calls)).not.toContain(privateMessage);
    } finally { warn.mockRestore(); }
  });
  it('finishes a durable delivery with the exact claim token even if the Redis heartbeat fails', async () => {
    const notification = { id: 'delivery', notificationId: 'notice', leaseOwner: 'opaque-claim-token', channel: 'EMAIL', data: {}, eventKey: 'event', type: 'TEST', email: 'fixture@example.test', attemptCount: 1 };
    const repository = { claimNext: vi.fn().mockResolvedValue(notification), deliveryIsCurrent: vi.fn().mockResolvedValue(true), markSent: vi.fn(), markDeliveryFailure: vi.fn() };
    const email = { deliver: vi.fn().mockResolvedValue({ providerMessageId: 'fixture' }) };
    const config = { get: vi.fn() };
    const redis = { set: vi.fn().mockRejectedValue(new Error('Redis unavailable')) };
    const processor = new NotificationProcessor(repository as never, email as never, {} as never, config as never, redis as never);
    await expect(processor.process({ id: 'job' } as never)).resolves.toBeUndefined();
    expect(email.deliver).toHaveBeenCalledTimes(1);
    expect(repository.markSent).toHaveBeenCalledWith('delivery', 'opaque-claim-token');
  });
  it('does not register background consumers in the API module outside test mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    try {
      const { OperationsModule } = await import('../../../../EmuKey/backend/src/modules/operations/operations.module.js');
      const providers = Reflect.getMetadata('providers', OperationsModule) as Array<{ name?: string }>;
      expect(providers.map((provider) => provider.name)).not.toContain('NotificationProcessor');
      expect(providers.map((provider) => provider.name)).not.toContain('NotificationScheduler');
    } finally { vi.unstubAllEnvs(); }
  });
  it('creates one durable in-app notification per event key', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({ id: 'notification-1', deliveryStatus: 'PENDING', isRead: false }),
      list: vi.fn(),
      markRead: vi.fn(),
      registerPushToken: vi.fn(),
      unregisterPushToken: vi.fn(),
    };
    const service = new NotificationService(repository);

    await expect(service.create({
      channel: 'IN_APP',
      content: 'A license is ready.',
      data: { licenseId: 'license-1' },
      eventKey: 'license:license-1:confirmed',
      title: 'License ready',
      type: 'LICENSE_CONFIRMED',
      userId: 'user-1',
    })).resolves.toMatchObject({ id: 'notification-1' });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ channel: 'IN_APP' }));
  });

  it('registers and removes a push token only for the authenticated owner', async () => {
    const repository = {
      create: vi.fn(),
      list: vi.fn(),
      markRead: vi.fn(),
      registerPushToken: vi.fn().mockResolvedValue({ id: 'token-1', status: 'ACTIVE' }),
      unregisterPushToken: vi.fn().mockResolvedValue({ id: 'token-1', status: 'INVALID' }),
    };
    const service = new NotificationService(repository);
    const actor = { role: 'CUSTOMER' as const, sessionVersion: 1, sub: 'user-1' };

    expect(() => service.registerPushToken(actor, 'unsupported-token', 'EXPO')).toThrow('Bad Request');
    await expect(service.registerPushToken(actor, 'fcm-token-123456', 'FCM')).resolves.toMatchObject({ status: 'ACTIVE' });
    await expect(service.unregisterPushToken(actor, 'fcm-token-123456')).resolves.toMatchObject({ status: 'INVALID' });
    expect(repository.registerPushToken).toHaveBeenCalledWith('user-1', 'fcm-token-123456', 'FCM');
  });
});
