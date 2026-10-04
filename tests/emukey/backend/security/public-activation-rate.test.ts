import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { LicensingController } from '../../../../EmuKey/backend/src/modules/licensing/licensing.controller.js';
import { LicensingService } from '../../../../EmuKey/backend/src/modules/licensing/licensing.service.js';
import { AuthGuard, OptionalAuthGuard, RolesGuard } from '../../../../EmuKey/backend/src/modules/identity-access/security.guards.js';
import { ApiExceptionFilter } from '../../../../EmuKey/backend/src/platform/http/api-exception.filter.js';

describe('public activation rate limit', () => {
  let app: INestApplication;
  let attempts = 0;
  const repository = { findActivationLicense: vi.fn().mockResolvedValue(null) };
  const redis = { incr: vi.fn(async (key: string) => { void key; return ++attempts; }), expire: vi.fn(), ttl: vi.fn().mockResolvedValue(60) };

  beforeAll(async () => {
    const service = new LicensingService(repository as never, {} as never, {} as never, redis as never, new Uint8Array(32), {} as never);
    const module = await Test.createTestingModule({
      controllers: [LicensingController], providers: [{ provide: LicensingService, useValue: service }],
    }).overrideGuard(OptionalAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(AuthGuard).useValue({ canActivate: () => false })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => false }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });
  afterAll(async () => app.close());

  it('shares an IP budget across challenge and activation and returns generic 401 then 429', async () => {
    attempts = 0;
    for (let index = 0; index < 30; index++) {
      const response = await request(app.getHttpServer() as Server)
        .post(index % 2 ? '/activations' : '/activations/challenge')
        .set('x-forwarded-for', `198.51.100.${index}`)
        .send({ activationKey: `0x${'11'.repeat(32)}`, purpose: 'ACTIVATE_DEVICE', deviceRef: 'device' });
      expect(response.status).toBe(401);
      expect(JSON.stringify(response.body)).not.toMatch(/customer|quota|product|owner/i);
    }
    const before = repository.findActivationLicense.mock.calls.length;
    for (const path of ['/activations/challenge', '/activations']) {
      const response = await request(app.getHttpServer() as Server).post(path).send({});
      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBe('60');
    }
    expect(repository.findActivationLicense.mock.calls.length).toBe(before);
    expect(new Set(redis.incr.mock.calls.map((args) => args[0])).size).toBe(1);
  });

  it('honors a configured per-minute activation budget', async () => {
    attempts = 0;
    const configuredRedis = { incr: vi.fn(async (key: string) => { void key; return ++attempts; }), expire: vi.fn(), ttl: vi.fn().mockResolvedValue(12) };
    const configured = new LicensingService(repository as never, {} as never, {} as never, configuredRedis as never, new Uint8Array(32), {} as never, undefined, 2);
    const configuredModule = await Test.createTestingModule({
      controllers: [LicensingController], providers: [{ provide: LicensingService, useValue: configured }],
    }).overrideGuard(OptionalAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(AuthGuard).useValue({ canActivate: () => false })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => false }).compile();
    const configuredApp = configuredModule.createNestApplication();
    configuredApp.useGlobalFilters(new ApiExceptionFilter());
    await configuredApp.init();

    for (const expected of [401, 401, 429]) {
      const response = await request(configuredApp.getHttpServer() as Server)
        .post('/activations/challenge')
        .send({ activationKey: `0x${'22'.repeat(32)}`, purpose: 'ACTIVATE_DEVICE', deviceRef: 'device' });
      expect(response.status).toBe(expected);
    }
    await configuredApp.close();
  });
});
