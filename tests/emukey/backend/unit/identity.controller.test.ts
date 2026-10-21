import { INestApplication, ServiceUnavailableException, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IdentityController } from '../../../../EmuKey/backend/src/modules/identity-access/identity.controller.js';
import { IdentityService } from '../../../../EmuKey/backend/src/modules/identity-access/identity.service.js';
import { AuthGuard, RolesGuard } from '../../../../EmuKey/backend/src/modules/identity-access/security.guards.js';
import { vi } from 'vitest';

describe('IdentityController HTTP boundary', () => {
  let app: INestApplication;
  const service = {
    inviteProvider: vi.fn().mockResolvedValue({ id: 'invite-1', email: 'provider@example.test' }),
    listProviderInvitations: vi.fn().mockResolvedValue([]),
    acceptProviderInvitation: vi.fn().mockResolvedValue({ id: 'provider-1', role: 'PROVIDER_ADMIN', status: 'ACTIVE' }),
    inspectProviderInvitation: vi.fn().mockResolvedValue({ email: 'provider@example.test', expiresAt: '2026-10-22T00:00:00Z' }),
    login: vi.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh', user: { id: 'u1' } }),
    refresh: vi.fn(),
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

  const invitation = { email: 'provider@example.test' };
  const acceptance = { token: 'a'.repeat(43), password: 'Provider-test@123', displayName: 'Provider Owner', organizationName: 'Provider Ltd' };
  it('accepts only an email and normalizes it without administrator-supplied profile data', async () => {
    await request(server()).post('/auth/provider-invitations').send({ email: ' Provider@Example.test ' }).expect(201);
    expect(service.inviteProvider).toHaveBeenLastCalledWith(expect.anything(), invitation);
  });
  it.each([
    { password: 'Provider-test@123' }, { role: 'SYSTEM_ADMIN' },
    { organizationName: '   ' }, { providerChainAddress: 'not-an-address' },
    { providerChainNamespace: '   ' }, { email: 'not-email' },
  ])('rejects an invalid or privilege-injecting invitation %j', async (override) => {
    await request(server()).post('/auth/provider-invitations').send({ ...invitation, ...override }).expect(400);
  });
  it('accepts a one-time invitation with a strong password', async () => {
    await request(server()).post('/auth/provider-invitations/accept').send(acceptance).expect(201);
  });
  it('inspects an invitation by body token without consuming it or exposing technical identities', async () => {
    const response = await request(server()).post('/auth/provider-invitations/inspect').send({ token: acceptance.token }).expect(200);
    expect(response.body).toEqual({ email: invitation.email, expiresAt: '2026-10-22T00:00:00Z' });
  });
  it('keeps clients behind a trusted proxy in distinct invitation rate-limit buckets', async () => {
    const express = app.getHttpAdapter().getInstance() as { set: (name: string, value: unknown) => void };
    express.set('trust proxy', 'loopback');
    try {
      for (const ip of ['198.51.100.10', '198.51.100.11']) {
        await request(server()).post('/auth/provider-invitations/inspect').set('X-Forwarded-For', ip).send({ token: acceptance.token }).expect(200);
        expect(service.inspectProviderInvitation).toHaveBeenLastCalledWith(acceptance.token, ip);
        await request(server()).post('/auth/provider-invitations/accept').set('X-Forwarded-For', ip).send(acceptance).expect(201);
        expect(service.acceptProviderInvitation).toHaveBeenLastCalledWith(acceptance.token, acceptance.password, { displayName: acceptance.displayName, organizationName: acceptance.organizationName }, ip);
      }
    } finally { express.set('trust proxy', false); }
  });
  it('does not use an untrusted forwarded address for invitation limiting', async () => {
    await request(server()).post('/auth/provider-invitations/inspect').set('X-Forwarded-For', '198.51.100.99').send({ token: acceptance.token }).expect(200);
    expect(service.inspectProviderInvitation.mock.calls.at(-1)?.[1]).not.toBe('198.51.100.99');
  });
  it.each([
    { displayName: '  ' }, { organizationName: '  ' }, { displayName: 'a'.repeat(256) },
    { organizationName: 'a'.repeat(256) }, { email: 'other@example.test' }, { role: 'SYSTEM_ADMIN' },
    { providerChainAddress: `0x${'ab'.repeat(20)}` }, { providerChainNamespace: 'stolen' },
  ])('rejects invalid recipient profile or identity injection %j', async (override) => {
    await request(server()).post('/auth/provider-invitations/accept').send({ ...acceptance, ...override }).expect(400);
  });
  it('rejects a weak recipient password and a malformed invitation token', async () => {
    await request(server()).post('/auth/provider-invitations/accept').send({ ...acceptance, password: 'weak' }).expect(400);
    await request(server()).post('/auth/provider-invitations/accept').send({ ...acceptance, token: 'bad' }).expect(400);
  });

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
  it.each(['INVALID_SESSION', 'REFRESH_REUSE_DETECTED'])('clears the refresh cookie and preserves the 401 code for %s', async (code) => {
    service.refresh.mockRejectedValueOnce(new UnauthorizedException({ code }));
    const response = await request(server()).post('/auth/refresh').set('Cookie', 'emukey_refresh=old').expect(401);
    expect(response.body.code).toBe(code);
    expect(response.headers['set-cookie']?.[0]).toContain('emukey_refresh=;');
    expect(response.headers['set-cookie']?.[0]).toContain('Path=/api/v1/auth');
    expect(response.headers['set-cookie']?.[0]).toContain('Expires=Thu, 01 Jan 1970');
  });
  it.each([
    { error: new Error('Redis connection failed'), status: 500 },
    { error: new ServiceUnavailableException('Database unavailable'), status: 503 },
  ])('preserves the refresh cookie on a transient $status failure', async ({ error, status }) => {
    service.refresh.mockRejectedValueOnce(error);
    const response = await request(server()).post('/auth/refresh').set('Cookie', 'emukey_refresh=current').expect(status);
    expect(response.headers['set-cookie']).toBeUndefined();
  });
  it('rotates the HttpOnly refresh cookie without exposing the token in the response body', async () => {
    service.refresh.mockResolvedValueOnce({ accessToken: 'next-access', refreshToken: 'next-refresh', user: { id: 'u1' } });
    const response = await request(server()).post('/auth/refresh').set('Cookie', 'emukey_refresh=current').expect(201);
    expect(service.refresh).toHaveBeenCalledWith('current');
    expect(response.headers['set-cookie']?.[0]).toContain('emukey_refresh=next-refresh;');
    expect(response.headers['set-cookie']?.[0]).toContain('HttpOnly');
    expect(response.body).toEqual({ accessToken: 'next-access', user: { id: 'u1' } });
  });
  it('routes admin state changes through the service', async () => {
    const targetId = '00000000-0000-4000-8000-000000000022';
    await request(server()).post(`/auth/users/${targetId}/lock`).expect(201);
    expect(service.changeAccountState).toHaveBeenCalledWith(targetId, 'LOCKED', { sub: 'u1', role: 'SYSTEM_ADMIN' });
  });

  it('revokes the server-side refresh session on logout', async () => {
    await request(server()).post('/auth/logout').set('Cookie', 'emukey_refresh=current').expect(204);
    expect(service.logout).toHaveBeenCalledWith('current');
  });
});

describe('Provider invitation authorization', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [IdentityController],
      providers: [AuthGuard, RolesGuard, { provide: IdentityService, useValue: {
        authenticate: async (role: string) => ({ sub: 'actor-1', role, sessionVersion: 1 }),
        inviteProvider: async () => ({ id: 'invitation-1' }),
        listProviderInvitations: async () => [],
        acceptProviderInvitation: async () => ({ id: 'provider-1', role: 'PROVIDER_ADMIN' }),
      } }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  const server = () => app.getHttpServer() as unknown as Parameters<typeof request>[0];
  it('requires a session to send or list invitations', async () => {
    await request(server()).post('/auth/provider-invitations').send({}).expect(401);
    await request(server()).get('/auth/provider-invitations').expect(401);
  });
  it.each(['CUSTOMER', 'SUPPORT_STAFF', 'PROVIDER_ADMIN'])('denies invitation management to %s', async (role) => {
    await request(server()).post('/auth/provider-invitations').set('Authorization', `Bearer ${role}`).send({}).expect(403);
    await request(server()).get('/auth/provider-invitations').set('Authorization', `Bearer ${role}`).expect(403);
  });
  it('allows System Admin management and public recipient acceptance', async () => {
    await request(server()).post('/auth/provider-invitations').set('Authorization', 'Bearer SYSTEM_ADMIN').send({}).expect(201);
    await request(server()).get('/auth/provider-invitations').set('Authorization', 'Bearer SYSTEM_ADMIN').expect(200);
    await request(server()).post('/auth/provider-invitations/accept').send({ token: 'a'.repeat(43), password: 'Provider-test@123' }).expect(201);
  });
});
