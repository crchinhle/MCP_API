import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { ProviderHandoffService } from '../../../../EmuKey/backend/src/modules/licensing/application/provider-handoff.service.js';
import { ProviderTransportError } from '../../../../EmuKey/backend/src/modules/licensing/application/ports/provider-license-gateway.port.js';
import { ProviderDeliveryScheduler } from '../../../../EmuKey/backend/src/modules/licensing/worker/provider-delivery.scheduler.js';

describe('provider handoff recovery and operational evidence', () => {
  it('logs a correlated bounded failure without exposing the key or provider exception', async () => {
    const delivery = { id: 'delivery', license_id: 'license', provider_user_id: 'provider', key_version: 1, config_version: 1, revision: '2', attempt_count: 1, snapshot: {} };
    const repository = { claim: vi.fn().mockResolvedValue(delivery), keyMaterial: vi.fn().mockResolvedValue({}), fail: vi.fn() };
    const configs = { find: vi.fn().mockResolvedValue({ status: 'ENABLED', config_version: 1, endpoint_url: 'https://provider.example/receive' }) };
    const codec = { decrypt: vi.fn().mockReturnValue('private-license-key') };
    const gateway = { send: vi.fn().mockRejectedValue(new ProviderTransportError('PROVIDER_HTTP_503', true)) };
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      const service = new ProviderHandoffService(repository as never, configs as never, codec as never, gateway as never, { credential: () => 'private-server-token' } as never, {} as never);
      await expect(service.runOne()).resolves.toBe(true);
      expect(repository.fail).toHaveBeenCalledWith(delivery, 'PROVIDER_HTTP_503', expect.any(Number));
      expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'provider.delivery.failed', deliveryId: 'delivery', licenseId: 'license', code: 'PROVIDER_HTTP_503', attempt: 1 }));
      expect(JSON.stringify(warn.mock.calls)).not.toMatch(/private-license-key|private-server-token|provider\.example/);
    } finally { warn.mockRestore(); }
  });

  it('restores its durable PostgreSQL poller after Redis reconnects and removes its listener on shutdown', async () => {
    const queue = { upsertJobScheduler: vi.fn().mockResolvedValue({}) };
    const redis = new EventEmitter();
    const scheduler = new ProviderDeliveryScheduler(queue as never, redis as never);
    try {
      await scheduler.onModuleInit();
      redis.emit('ready');
      await vi.waitFor(() => expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(2));
      expect(queue.upsertJobScheduler.mock.calls[1]).toEqual(queue.upsertJobScheduler.mock.calls[0]);
      scheduler.onModuleDestroy();
      expect(redis.listenerCount('ready')).toBe(0);
    } finally { scheduler.onModuleDestroy(); }
  });

  it('can restore the poller on a later reconnect after registration fails without logging connection secrets', async () => {
    const queue = { upsertJobScheduler: vi.fn().mockResolvedValue({}) };
    const redis = new EventEmitter();
    const scheduler = new ProviderDeliveryScheduler(queue as never, redis as never);
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      await scheduler.onModuleInit();
      queue.upsertJobScheduler.mockRejectedValueOnce(new Error('private-connection-url'));
      redis.emit('ready');
      await vi.waitFor(() => expect(error).toHaveBeenCalledWith({ event: 'provider.delivery.scheduler.failed' }));
      redis.emit('ready');
      await vi.waitFor(() => expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(3));
      expect(JSON.stringify(error.mock.calls)).not.toContain('private-connection-url');
    } finally { scheduler.onModuleDestroy(); error.mockRestore(); }
  });
});
