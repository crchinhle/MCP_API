import { NotificationService } from '../../src/modules/operations/application/notification.service.js';

describe('NotificationService', () => {
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

    await expect(service.registerPushToken(actor, 'expo-token-123456', 'EXPO')).resolves.toMatchObject({ status: 'ACTIVE' });
    await expect(service.unregisterPushToken(actor, 'expo-token-123456')).resolves.toMatchObject({ status: 'INVALID' });
    expect(repository.registerPushToken).toHaveBeenCalledWith('user-1', 'expo-token-123456', 'EXPO');
  });
});
