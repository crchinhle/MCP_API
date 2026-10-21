import { BadRequestException, Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import { PassThrough } from 'node:stream';
import type { Server } from 'node:http';
import request from 'supertest';
import { ApiExceptionFilter } from '../../../../../EmuKey/backend/src/platform/http/api-exception.filter.js';

const secret = 'sentinel-secret-must-not-be-logged';
class LoggingController {
  ok() { return { ok: true }; }
  bad() { throw new BadRequestException('Invalid input'); }
  failure() { throw new Error(`Upstream failed: ${secret}`); }
}
Controller('logging')(LoggingController);
for (const name of ['ok', 'bad', 'failure'] as const) {
  Get(name)(LoggingController.prototype, name, Object.getOwnPropertyDescriptor(LoggingController.prototype, name)!);
}

describe('minimal HTTP error logging', () => {
  let app: INestApplication;
  let output = '';
  beforeAll(async () => {
    const stream = new PassThrough();
    stream.on('data', (chunk: Buffer) => { output += chunk.toString('utf8'); });
    const module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot({ pinoHttp: [{ autoLogging: false, quietReqLogger: true }, stream] })],
      controllers: [LoggingController],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { output = ''; });

  it('does not log successful requests or expected validation errors', async () => {
    await request(app.getHttpServer() as Server).get('/logging/ok').expect(200);
    await request(app.getHttpServer() as Server).get('/logging/bad').expect(400);
    expect(output).toBe('');
  });

  it('logs one 5xx with the response trace ID and excludes raw error, URL query and credentials', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get(`/logging/failure?token=${secret}`).set('authorization', `Bearer ${secret}`).expect(500);
    const entries = output.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ event: 'http.request.failed', level: 50, statusCode: 500,
      method: 'GET', route: '/logging/failure', traceId: response.body.error.traceId });
    expect(output).not.toContain(secret);
  });
});
