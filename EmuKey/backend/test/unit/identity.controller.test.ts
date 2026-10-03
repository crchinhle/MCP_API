import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IdentityController } from '../../src/modules/identity-access/identity.controller.js';
import { IdentityService } from '../../src/modules/identity-access/identity.service.js';
import { AuthGuard, RolesGuard } from '../../src/modules/identity-access/security.guards.js';
import { vi } from 'vitest';

describe('IdentityController HTTP boundary', () => {
  let app: INestApplication;
  const service = {
    login: vi.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh', user: { id: 'u1' } }),
    refresh: vi.fn().mockRejectedValue(new Error('REFRESH_REUSE_DETECTED')),
    profile: vi.fn().mockResolvedValue({ id: 'u1' }),
    changeAccountState: vi.fn().mockResolvedValue({ id: 'u2', status: 'LOCKED' }),
    logout: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue({ accepted: true }),
    resendVerification: vi.fn().mockResolvedValue(undefined),
    verifyEmail: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [IdentityController], providers: [{ provide: IdentityService, useValue: service }] })
      .overrideGuard(AuthGuard).useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => { user: { sub: string; role: string } } } }) => { context.switchToHttp().getRequest().user = { sub: 'u1', role: 'SYSTEM_ADMIN' }; return true; } })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }));
    await app.init();
  });
  afterAll(() => app.close());
  const server = () => app.getHttpServer() as unknown as Parameters<typeof request>[0];

  it('sets an HttpOnly refresh cookie on login', async () => {
    const response = await request(server()).post('/auth/login').send({ email: 'admin@example.com', password: 'Password@123' }).expect(201);
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.body).not.toHaveProperty('refreshToken');
  });
  it('requires all four character groups for an eight-character login password', async () => {
    await request(server()).post('/auth/login').send({ email: 'customer@example.com', password: 'Emu@1234' }).expect(201);

    for (const password of ['Aa@1234', 'emu@1234', 'EMU@1234', 'Emu@Test', 'Emu12345']) {
      await request(server()).post('/auth/login').send({ email: 'customer@example.com', password }).expect(400);
    }
  });
  it('exposes customer registration without controller-key material', async () => {
    const response = await request(server()).post('/auth/register').send({ customerType: 'INDIVIDUAL', displayName: 'New Buyer', email: 'new@example.com', password: 'Emu@1234' }).expect(202);
    expect(response.body).toEqual({ accepted: true });
    expect(response.body).not.toHaveProperty('controllerKey');
  });
  it('applies password complexity to reset and password changes', async () => {
    const passwordWithoutSpecialCharacter = 'Password1234';

    await request(server()).post('/auth/reset-password').send({ token: 'x'.repeat(20), password: passwordWithoutSpecialCharacter }).expect(400);
    await request(server()).put('/auth/password').send({ currentPassword: 'legacy-password', password: passwordWithoutSpecialCharacter }).expect(400);
  });
  it('maps refresh failures to a cleared cookie and unauthorized response', async () => {
    const response = await request(server()).post('/auth/refresh').set('Cookie', 'emukey_refresh=old').expect(401);
    expect(response.headers['set-cookie']?.[0]).toContain('emukey_refresh=;');
  });
  it('routes admin state changes through the service', async () => {
    const targetId = '00000000-0000-4000-8000-000000000022';
    await request(server()).post(`/auth/users/${targetId}/lock`).send({ reason: 'security review' }).expect(201);
    expect(service.changeAccountState).toHaveBeenCalledWith(targetId, 'LOCKED', { sub: 'u1', role: 'SYSTEM_ADMIN' }, 'security review');
  });

  it('revokes the server-side refresh session on logout', async () => {
    await request(server()).post('/auth/logout').set('Cookie', 'emukey_refresh=current').expect(204);
    expect(service.logout).toHaveBeenCalledWith('current');
  });
});
