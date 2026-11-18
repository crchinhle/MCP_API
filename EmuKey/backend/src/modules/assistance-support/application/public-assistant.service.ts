import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  AiAdvisorService,
  boundedHistory,
  redactSecrets,
  type AdvisorAnswer,
  type AiTurn,
} from './ai-advisor.service.js';

interface GuestState {
  tokenHash: string;
  linkedUserId?: string;
  linkedResult?: unknown;
  turns: AiTurn[];
  requests: Array<{ id: string; questionHash: string; answer: AdvisorAnswer }>;
}
export interface GuestAsk {
  sessionId?: string;
  sessionToken?: string;
  question: string;
  clientMessageId: string;
}
const ttl = 1800;
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export class PublicAssistantService {
  constructor(
    private readonly redis: Redis,
    private readonly advisor: AiAdvisorService,
  ) {}

  async ask(
    input: GuestAsk,
    ip: string,
  ): Promise<AdvisorAnswer & { sessionId: string; sessionToken: string }> {
    if (!input.question.trim() || input.question.length > 4000)
      throw new BadRequestException({ code: 'AI_QUESTION_INVALID' });
    await this.limit(`ip:${digest(ip)}`, 20);
    let sessionId = input.sessionId;
    let sessionToken = input.sessionToken;
    if (!sessionId) {
      // Initial request retries also reuse the issued conversation; the client never chooses its ID.
      const requestKey = `ai:guest:initial:${digest(`${ip}:${input.clientMessageId}`)}`;
      const proposed = { sessionId: randomUUID(), sessionToken: randomBytes(32).toString('hex') };
      await this.redis.set(requestKey, JSON.stringify(proposed), 'EX', ttl, 'NX');
      const issued = await this.redis.get(requestKey);
      const saved = issued?.startsWith('{') ? JSON.parse(issued) as typeof proposed : undefined;
      sessionId = saved?.sessionId;
      sessionToken = saved?.sessionToken;
      if (!sessionId)
        throw new ServiceUnavailableException({
          code: 'AI_SESSION_UNAVAILABLE',
        });
    }
    if (input.sessionId) await this.limit(`session:${digest(sessionId)}`, 15);
    const key = `ai:guest:session:${digest(sessionId)}`;
    const lockKey = `${key}:lock`;
    const lockId = randomUUID();
    if (!(await this.redis.set(lockKey, lockId, 'EX', 90, 'NX')))
      throw new ConflictException({ code: 'AI_REQUEST_IN_PROGRESS' });
    try {
      const serialized = await this.redis.get(key);
      if (!serialized && input.sessionId)
        throw new NotFoundException({ code: 'AI_SESSION_EXPIRED' });
      const state: GuestState = serialized
        ? (JSON.parse(serialized) as GuestState)
        : { turns: [], requests: [], tokenHash: digest(sessionToken!) };
      if (!sessionToken || !state.tokenHash || digest(sessionToken) !== state.tokenHash || state.linkedUserId) throw new NotFoundException({ code: 'AI_SESSION_EXPIRED' });
      const questionHash = digest(input.question);
      const previous = state.requests.find(
        (request) => request.id === input.clientMessageId,
      );
      if (previous) {
        if (previous.questionHash !== questionHash)
          throw new ConflictException({
            code: 'CONVERSATION_MESSAGE_CONFLICT',
          });
        if (!(await this.advisor.isCurrent(previous.answer, input.question)))
          throw new ConflictException({
            code: 'AI_SOURCES_CHANGED',
            message:
              'Thông tin nguồn đã thay đổi. Vui lòng gửi câu hỏi mới để tra cứu lại.',
          });
        return { ...previous.answer, sessionId, sessionToken };
      }
      const answer = await this.advisor.answer({
        question: input.question,
        history: boundedHistory(state.turns),
      });
      state.turns = boundedHistory([
        ...state.turns,
        { role: 'user', content: redactSecrets(input.question) },
        {
          role: 'assistant',
          content: answer.answer,
          catalogSources: answer.catalogSources,
        },
      ]);
      // Provider outages are retryable with the same client intent; retain no completed request for them.
      if (answer.outcome !== 'PROVIDER_UNAVAILABLE')
        state.requests = [
          ...state.requests,
          { id: input.clientMessageId, questionHash, answer },
        ].slice(-16);
      await this.redis.set(key, JSON.stringify(state), 'EX', ttl);
      return { ...answer, sessionId, sessionToken };
    } finally {
      await this.redis.eval(
        "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
        1,
        lockKey,
        lockId,
      );
    }
  }

  async link<T>(input: { sessionId: string; sessionToken: string; accepted: boolean }, userId: string, save: (turns: AiTurn[]) => Promise<T>): Promise<T> {
    if (input.accepted !== true) throw new BadRequestException({ code: 'GUEST_HISTORY_CONSENT_REQUIRED' });
    const key = `ai:guest:session:${digest(input.sessionId)}`;
    const lockKey = `${key}:lock`;
    const token = randomUUID();
    if (!(await this.redis.set(lockKey, token, 'EX', 90, 'NX'))) throw new ConflictException({ code: 'AI_REQUEST_IN_PROGRESS' });
    try {
      const serialized = await this.redis.get(key);
      const state = serialized ? JSON.parse(serialized) as GuestState : undefined;
      if (!state?.tokenHash || digest(input.sessionToken) !== state.tokenHash || (state.linkedUserId && state.linkedUserId !== userId)) throw new NotFoundException({ code: 'AI_SESSION_EXPIRED' });
      if (state.linkedResult) return state.linkedResult as T;
      // Reserve this account before the durable transaction; retries may only use the same owner.
      state.linkedUserId = userId;
      await this.redis.set(key, JSON.stringify(state), 'EX', ttl);
      const result = await save(boundedHistory(state.turns));
      state.linkedResult = result;
      await this.redis.set(key, JSON.stringify(state), 'EX', ttl);
      return result;
    } finally {
      await this.redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, lockKey, token);
    }
  }

  async limit(scope: string, maximum = 15, code = 'AI_RATE_LIMITED') {
    const key = `ai:rate:${scope}:${Math.floor(Date.now() / 60000)}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 120);
    if (count > maximum)
      throw new HttpException(
        {
          code,
          message: code === 'AI_RATE_LIMITED' ? 'Bạn gửi câu hỏi quá nhanh. Vui lòng thử lại sau ít phút.' : 'Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau ít phút.',
        },
        429,
      );
  }

  async exclusive<T>(scope: string, work: () => Promise<T>): Promise<T> {
    const key = `ai:inflight:${digest(scope)}`;
    const token = randomUUID();
    if (!(await this.redis.set(key, token, 'EX', 90, 'NX')))
      throw new ConflictException({ code: 'AI_REQUEST_IN_PROGRESS' });
    try {
      return await work();
    } finally {
      await this.redis.eval(
        "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
        1,
        key,
        token,
      );
    }
  }
}
