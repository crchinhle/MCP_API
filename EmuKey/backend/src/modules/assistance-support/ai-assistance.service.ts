import { createHash } from 'node:crypto';

import type { AiGatewayPort, GroundingSource } from './application/ports/ai-gateway.port.js';

export interface KnowledgeSearchPort {
  searchSources(input: { conversationId: string; customerUserId: string; question: string }): Promise<GroundingSource[]>;
  appendCustomerMessage(input: { clientMessageId: string; conversationId: string; customerUserId: string; content: string }): Promise<unknown>;
  appendAiMessage(input: { clientMessageId: string; conversationId: string; content: string; citedSourceIds: string[]; grounded: boolean }): Promise<{ content: string; sources?: string[]; grounded?: boolean }>;
}

export class AiAssistanceService {
  constructor(
    private readonly gateway: AiGatewayPort,
    private readonly knowledge: KnowledgeSearchPort,
  ) {}

  async answer(input: { conversationId: string; customerUserId: string; question: string; clientMessageId: string }) {
    await this.knowledge.appendCustomerMessage({
      clientMessageId: input.clientMessageId,
      conversationId: input.conversationId,
      customerUserId: input.customerUserId,
      content: input.question,
    });
    const sources = await this.knowledge.searchSources(input);
    const clientMessageId = stableEventUuid(`${input.conversationId}:${input.clientMessageId}:answer`);
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
    });
  }

  private async persistRefusal(clientMessageId: string, conversationId: string) {
    const answer = 'Không đủ nguồn chính thức để trả lời câu hỏi này.';
    return this.persistAnswer({ clientMessageId, conversationId, content: answer, citedSourceIds: [], grounded: false });
  }
  private async persistAnswer(input: { clientMessageId: string; conversationId: string; content: string; citedSourceIds: string[]; grounded: boolean }) {
    const stored = await this.knowledge.appendAiMessage(input);
    return { answer: stored.content, citedSourceIds: stored.sources ?? [], grounded: stored.grounded ?? false };
  }
}

function stableEventUuid(value: string): string {
  const bytes = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  bytes[12] = '5';
  bytes[16] = ((Number.parseInt(bytes[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${bytes.slice(0, 8).join('')}-${bytes.slice(8, 12).join('')}-${bytes.slice(12, 16).join('')}-${bytes.slice(16, 20).join('')}-${bytes.slice(20).join('')}`;
}
