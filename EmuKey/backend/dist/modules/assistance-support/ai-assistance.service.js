import { createHash } from 'node:crypto';
export class AiAssistanceService {
    gateway;
    knowledge;
    constructor(gateway, knowledge) {
        this.gateway = gateway;
        this.knowledge = knowledge;
    }
    async answer(input) {
        await this.knowledge.appendCustomerMessage({
            clientMessageId: input.clientMessageId,
            conversationId: input.conversationId,
            customerUserId: input.customerUserId,
            content: input.question,
        });
        const sources = await this.knowledge.searchSources(input);
        const clientMessageId = stableEventUuid(`${input.conversationId}:${input.clientMessageId}:answer`);
        if (sources.length === 0)
            return this.persistRefusal(clientMessageId, input.conversationId);
        let result;
        try {
            result = await this.gateway.answerGrounded({ question: input.question, sources });
        }
        catch {
            return this.persistRefusal(clientMessageId, input.conversationId);
        }
        const sourceIds = new Set(sources.map((source) => source.id));
        if (!result.grounded)
            return this.persistRefusal(clientMessageId, input.conversationId);
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
    async persistRefusal(clientMessageId, conversationId) {
        const answer = 'Không đủ nguồn chính thức để trả lời câu hỏi này.';
        return this.persistAnswer({ clientMessageId, conversationId, content: answer, citedSourceIds: [], grounded: false });
    }
    async persistAnswer(input) {
        const stored = await this.knowledge.appendAiMessage(input);
        return { answer: stored.content, citedSourceIds: stored.sources ?? [], grounded: stored.grounded ?? false };
    }
}
function stableEventUuid(value) {
    const bytes = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
    bytes[12] = '5';
    bytes[16] = ((Number.parseInt(bytes[16], 16) & 0x3) | 0x8).toString(16);
    return `${bytes.slice(0, 8).join('')}-${bytes.slice(8, 12).join('')}-${bytes.slice(12, 16).join('')}-${bytes.slice(16, 20).join('')}-${bytes.slice(20).join('')}`;
}
//# sourceMappingURL=ai-assistance.service.js.map