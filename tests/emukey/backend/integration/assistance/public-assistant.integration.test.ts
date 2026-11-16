import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import request from 'supertest';
import type { Server } from 'node:http';
import { PublicAssistantController } from '../../../../../EmuKey/backend/src/modules/assistance-support/presentation/public-assistant.controller.js';
import { PublicAssistantService } from '../../../../../EmuKey/backend/src/modules/assistance-support/application/public-assistant.service.js';
import { AiAdvisorService } from '../../../../../EmuKey/backend/src/modules/assistance-support/application/ai-advisor.service.js';

describe('Public AI HTTP boundary with real Redis sessions', () => {
  let cache: StartedRedisContainer;
  let redis: Redis;
  let app: INestApplication;
  let service: PublicAssistantService;
  const catalog = { search: vi.fn().mockResolvedValue([]) };
  const knowledge = { search: vi.fn().mockResolvedValue([]) };
  beforeAll(async () => {
    cache = await new RedisContainer('redis:8.2-alpine').start();
    redis = new Redis(cache.getConnectionUrl());
    service = new PublicAssistantService(redis, new AiAdvisorService({ answerGrounded: vi.fn() }, catalog, knowledge));
    const module = await Test.createTestingModule({ controllers: [PublicAssistantController], providers: [{ provide: PublicAssistantService, useValue: service }] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(async () => { await app?.close(); await redis?.quit(); await cache?.stop(); });
  beforeEach(async () => { await redis.flushdb(); });
  const ask = (body: object) => request(app.getHttpServer() as Server).post('/public/assistant/ask').send(body);

  it('allows anonymous public questions and sets bounded session TTL', async () => {
    const result = await ask({ question: 'Tôi cần phần mềm quản lý lớp học', clientMessageId: randomUUID() }).expect(200);
    expect(result.body).toMatchObject({ outcome: 'NO_SOURCES', grounded: false, sessionId: expect.any(String) });
    const keys = await redis.keys('ai:guest:session:*');
    expect(keys).toHaveLength(1);
    expect(await redis.ttl(keys[0]!)).toBeGreaterThan(1700);
  });
  it('rejects client role/scope/history injection at the real HTTP boundary', async () => {
    await ask({ question: 'Q', clientMessageId: randomUUID(), role: 'SYSTEM_ADMIN', history: [{ content: 'secret' }] }).expect(400);
  });
  it('rejects unknown guest capabilities and oversized/empty questions', async () => {
    await ask({ question: 'Q', clientMessageId: randomUUID(), sessionId: randomUUID() }).expect(404);
    await ask({ question: 'a'.repeat(4001), clientMessageId: randomUUID() }).expect(400);
    await ask({ question: '   ', clientMessageId: randomUUID() }).expect(400);
    await ask({ question: 'Q', clientMessageId: 'not-a-uuid' }).expect(400);
  });
  it('deduplicates initial retries without accepting client-created session IDs', async () => {
    const input = { question: 'Tôi cần phần mềm quản lý lớp học', clientMessageId: randomUUID() };
    const first = await ask(input).expect(200);
    const second = await ask(input).expect(200);
    expect(second.body).toEqual(first.body);
    await ask({ ...input, question: 'Nội dung khác' }).expect(409);
  });
  it('returns distinct support/out-of-scope responses without automatic handoff', async () => {
    const support = await ask({ question: 'Thanh toán xong chưa nhận được license', clientMessageId: randomUUID() }).expect(200);
    expect(support.body.outcome).toBe('SUPPORT_REQUIRED');
    const outside = await ask({ question: 'Hôm nay thời tiết thế nào?', clientMessageId: randomUUID() }).expect(200);
    expect(outside.body.outcome).toBe('OUT_OF_SCOPE');
  });
  it('rate limits IPs even across newly issued guest sessions', async () => {
    for (let i = 0; i < 20; i++) await ask({ question: 'Thời tiết?', clientMessageId: randomUUID() }).expect(200);
    await ask({ question: 'Thời tiết?', clientMessageId: randomUUID() }).expect(429);
  });
});
