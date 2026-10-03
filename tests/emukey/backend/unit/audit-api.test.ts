import type { Server } from 'node:http';
import { type ExecutionContext, type INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Pool } from 'pg';
import { AuditController } from '../../../../EmuKey/backend/src/modules/operations/presentation/audit.controller.js';
import { AuditService } from '../../../../EmuKey/backend/src/modules/operations/application/audit.service.js';
import { AuditRepository } from '../../../../EmuKey/backend/src/modules/operations/infrastructure/audit.repository.js';
import { AuthGuard } from '../../../../EmuKey/backend/src/modules/identity-access/security.guards.js';

describe('read-only audit API', () => {
  let app: INestApplication;
  const query = vi.fn().mockResolvedValue({ rows: [] });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AuditController], providers: [
      { provide: AuditService, useValue: new AuditService(new AuditRepository({ query } as unknown as Pool)) },
    ] }).overrideGuard(AuthGuard).useValue({ canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
      if (!req.headers['x-test-role']) throw new UnauthorizedException();
      req.user = { role: req.headers['x-test-role'], sub: 'actor', sessionVersion: 1 };
      return true;
    } }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  it('rejects anonymous and non-admin roles', async () => {
    await request(app.getHttpServer() as Server).get('/operations/audit-logs').expect(401);
    for (const role of ['CUSTOMER', 'PROVIDER_ADMIN', 'SUPPORT_STAFF']) {
      await request(app.getHttpServer() as Server).get('/operations/audit-logs').set('x-test-role', role).expect(403);
    }
  });
  it('validates pagination and outcomes', async () => {
    for (const suffix of ['?page=0', '?page=abc', '?page=10001', '?outcome=INVALID', '?unknown=1']) {
      await request(app.getHttpServer() as Server).get('/operations/audit-logs' + suffix).set('x-test-role', 'SYSTEM_ADMIN').expect(400);
    }
  });
  it('returns a bounded page and uses bound query parameters without private metadata', async () => {
    query.mockResolvedValueOnce({ rows: Array.from({ length: 51 }, (_, id) => ({ id: String(id), action: 'TEST' })) });
    const result = await request(app.getHttpServer() as Server).get('/operations/audit-logs?page=2&action=TEST&outcome=SUCCESS').set('x-test-role', 'SYSTEM_ADMIN').expect(200);
    expect(result.body).toMatchObject({ page: 2, hasMore: true });
    expect((result.body as { items: unknown[] }).items).toHaveLength(50);
    const [sql, values] = query.mock.calls.at(-1)! as [string, unknown[]];
    expect(values).toEqual(['TEST', 'SUCCESS', 50]);
    expect(sql).not.toContain('metadata');
    expect(sql).not.toContain('actor_email_snapshot');
  });
});
