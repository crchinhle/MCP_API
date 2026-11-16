import { createHash } from 'node:crypto';
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';

import type { AiGatewayPort, GroundingSource, CitationDetail } from './application/ports/ai-gateway.port.js';
import type { AiAdvisorService, AdvisorAnswer, AiTurn } from './application/ai-advisor.service.js';

export interface KnowledgeSearchPort {
  context?(input: { conversationId: string; customerUserId: string }): Promise<{ history: AiTurn[]; productIds?: string[]; planIds?: string[] }>;
  findAnswer?(conversationId: string, clientMessageId: string): Promise<({ content: string; sources?: string[]; grounded?: boolean; citationDetails?: CitationDetail[]; aiMetadata?: Partial<AdvisorAnswer> }) | undefined>;
  searchSources(input: { conversationId: string; customerUserId: string; question: string }): Promise<GroundingSource[]>;
  appendCustomerMessage(input: { clientMessageId: string; conversationId: string; customerUserId: string; content: string }): Promise<unknown>;
  appendAiMessage(input: { clientMessageId: string; conversationId: string; content: string; citedSourceIds: string[]; grounded: boolean; citationDetails?:CitationDetail[]; aiMetadata?: Partial<AdvisorAnswer> }): Promise<{ content: string; sources?: string[]; grounded?: boolean;citationDetails?:CitationDetail[]; aiMetadata?: Partial<AdvisorAnswer> }>;
}

export class AiAssistanceService {
  constructor(
    private readonly gateway: AiGatewayPort,
    private readonly knowledge: KnowledgeSearchPort,
    private readonly advisor?: AiAdvisorService,
  ) {}

  async answer(input: { conversationId: string; customerUserId: string; question: string; clientMessageId: string }) {
    await this.knowledge.appendCustomerMessage({
      clientMessageId: input.clientMessageId,
      conversationId: input.conversationId,
      customerUserId: input.customerUserId,
      content: input.question,
    });
    const clientMessageId = stableEventUuid(`${input.conversationId}:${input.clientMessageId}:answer`);
    if (this.advisor) {
      const previous = await this.knowledge.findAnswer?.(input.conversationId, clientMessageId);
      if (previous) {
        if (!await this.advisor.isCurrent({ ...previous.aiMetadata, grounded: previous.grounded ?? false, citationDetails: previous.citationDetails ?? [] }, input.question)) throw new ConflictException({ code: 'AI_SOURCES_CHANGED', message: 'Thông tin nguồn đã thay đổi. Vui lòng gửi câu hỏi mới để tra cứu lại.' });
        return { ...previous.aiMetadata, answer: previous.content, grounded: previous.grounded ?? false, citedSourceIds: previous.sources ?? [], citationDetails: previous.citationDetails ?? [] };
      }
      const context = await this.knowledge.context?.(input);
      const result = await this.advisor.answer({ question: input.question, ...context });
      if (result.outcome === 'PROVIDER_UNAVAILABLE') throw new ServiceUnavailableException({ code: 'AI_PROVIDER_UNAVAILABLE', message: result.answer });
      return this.persistAnswer({ clientMessageId, conversationId: input.conversationId, content: result.answer, citedSourceIds: result.citedSourceIds, grounded: result.grounded, citationDetails: result.citationDetails, aiMetadata: result });
    }
    const sources = await this.knowledge.searchSources(input);
    if (sources.length === 0) return this.persistRefusal(clientMessageId, input.conversationId);
    let result;
    try {
      result = await this.gateway.answerGrounded({ question: input.question, sources });
    } catch {
      return this.persistRefusal(clientMessageId, input.conversationId);
    }
    const sourceIds = new Set(sources.map((source) => source.id));
    if (!result.grounded) return this.persistRefusal(clientMessageId, input.conversationId);
    if (result.citedSourceIds.length === 0 || result.citedSourceIds.some((id) => !sourceIds.has(id))) {
      return this.persistRefusal(clientMessageId, input.conversationId);
    }
    return this.persistAnswer({
      clientMessageId,
      conversationId: input.conversationId,
      content: result.answer,
      citedSourceIds: result.citedSourceIds,
      grounded: result.grounded,
      citationDetails: sources.flatMap((source) => {
        if (!result.citedSourceIds.includes(source.id) || !source.documentId || !source.documentTitle ||
            typeof source.documentVersion !== 'number' || !Number.isSafeInteger(source.documentVersion) || source.documentVersion < 1 ||
            typeof source.chunkIndex !== 'number' || !Number.isSafeInteger(source.chunkIndex) || source.chunkIndex < 0) return [];
        return [{ chunkId: source.id, documentId: source.documentId, documentTitle: source.documentTitle,
          documentVersion: source.documentVersion, chunkIndex: source.chunkIndex, excerpt: source.content.slice(0, 800) }];
      }),
    });
  }

  private async persistRefusal(clientMessageId: string, conversationId: string) {
    const answer = 'Không đủ nguồn chính thức để trả lời câu hỏi này.';
    return this.persistAnswer({ clientMessageId, conversationId, content: answer, citedSourceIds: [], grounded: false });
  }
  private async persistAnswer(input: { clientMessageId: string; conversationId: string; content: string; citedSourceIds: string[]; grounded: boolean;citationDetails?:CitationDetail[]; aiMetadata?: Partial<AdvisorAnswer> }) {
    const stored = await this.knowledge.appendAiMessage(input);
    return { ...stored.aiMetadata, answer: stored.content, citedSourceIds: stored.sources ?? [], grounded: stored.grounded ?? false,citationDetails:stored.citationDetails??[] };
  }
}

function stableEventUuid(value: string): string {
  const bytes = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  bytes[12] = '5';
  bytes[16] = ((Number.parseInt(bytes[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${bytes.slice(0, 8).join('')}-${bytes.slice(8, 12).join('')}-${bytes.slice(12, 16).join('')}-${bytes.slice(16, 20).join('')}-${bytes.slice(20).join('')}`;
}
