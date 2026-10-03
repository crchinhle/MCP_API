import { AiAssistanceService } from '../../src/modules/assistance-support/ai-assistance.service.js';

const conversationId = '00000000-0000-4000-8000-000000000701';
const questionId = '00000000-0000-4000-8000-000000000702';

interface RecordedMessage {
  clientMessageId: string;
  conversationId: string;
  content: string;
  citedSourceIds: string[];
  grounded: boolean;
}

interface RecordedQuestion {
  clientMessageId: string;
  conversationId: string;
  customerUserId: string;
  content: string;
}

function knowledgePort(sources: Array<{ content: string; id: string }>) {
  const aiMessages: RecordedMessage[] = [];
  const questions: RecordedQuestion[] = [];
  return {
    aiMessages,
    questions,
    port: {
      appendAiMessage: vi.fn((input: RecordedMessage) => {
        aiMessages.push(input);
        return Promise.resolve({ ...input, sources: input.citedSourceIds });
      }),
      appendCustomerMessage: vi.fn((input: RecordedQuestion) => {
        questions.push(input);
        return Promise.resolve(input);
      }),
      searchSources: vi.fn(() => Promise.resolve(sources)),
    },
  };
}

describe('AiAssistanceService', () => {
  it('returns the stored answer when a retry generated a different response', async () => {
    const knowledge = knowledgePort([{ content: 'source', id: 'source-1' }]);
    knowledge.port.appendAiMessage.mockImplementation((input) => Promise.resolve({ ...input, content: 'Original answer', grounded: true, sources: ['source-1'] }));
    const service = new AiAssistanceService({ answerGrounded: vi.fn().mockResolvedValue({ answer: 'Different retry answer', grounded: true, citedSourceIds: ['source-1'] }) }, knowledge.port);
    await expect(service.answer({ conversationId, customerUserId: 'u1', question: 'Q', clientMessageId: questionId })).resolves.toMatchObject({ answer: 'Original answer', grounded: true, citedSourceIds: ['source-1'] });
  });
  it('refuses when no provider-scoped source is available', async () => {
    const knowledge = knowledgePort([]);
    const service = new AiAssistanceService({ answerGrounded: vi.fn() }, knowledge.port);

    await expect(
      service.answer({ conversationId, customerUserId: 'u1', question: 'How?', clientMessageId: questionId }),
    ).resolves.toMatchObject({ grounded: false, citedSourceIds: [] });
    expect(knowledge.aiMessages[0]).toMatchObject({ grounded: false, citedSourceIds: [] });
  });

  it('persists the customer question before the grounded answer (SUP-20)', async () => {
    const knowledge = knowledgePort([{ content: 'source', id: 'source-1' }]);
    const service = new AiAssistanceService(
      { answerGrounded: vi.fn().mockResolvedValue({ answer: 'safe', citedSourceIds: ['source-1'], grounded: true }) },
      knowledge.port,
    );

    const result = await service.answer({
      conversationId,
      customerUserId: 'u1',
      question: 'How do I activate?',
      clientMessageId: questionId,
    });

    expect(knowledge.questions).toEqual([
      { clientMessageId: questionId, content: 'How do I activate?', conversationId, customerUserId: 'u1' },
    ]);
    expect(knowledge.aiMessages[0]).toMatchObject({
      conversationId,
      content: 'safe',
      citedSourceIds: ['source-1'],
      grounded: true,
    });
    expect(result).toMatchObject({ answer: 'safe', grounded: true });
  });

  it('derives a stable answer id so a retried intent stays idempotent', async () => {
    const knowledge = knowledgePort([{ content: 'source', id: 'source-1' }]);
    const service = new AiAssistanceService(
      { answerGrounded: vi.fn().mockResolvedValue({ answer: 'safe', citedSourceIds: ['source-1'], grounded: true }) },
      knowledge.port,
    );

    await service.answer({ conversationId, customerUserId: 'u1', question: 'Q', clientMessageId: questionId });
    await service.answer({ conversationId, customerUserId: 'u1', question: 'Q', clientMessageId: questionId });

    expect(knowledge.questions).toHaveLength(2);
    expect(knowledge.aiMessages[0]?.clientMessageId).toBe(knowledge.aiMessages[1]?.clientMessageId);
    expect(knowledge.aiMessages[0]?.clientMessageId).not.toBe(questionId);
  });

  it('keeps two distinct asks of identical text as two separate pairs', async () => {
    const knowledge = knowledgePort([{ content: 'source', id: 'source-1' }]);
    const service = new AiAssistanceService(
      { answerGrounded: vi.fn().mockResolvedValue({ answer: 'safe', citedSourceIds: ['source-1'], grounded: true }) },
      knowledge.port,
    );

    await service.answer({ conversationId, customerUserId: 'u1', question: 'Same text', clientMessageId: questionId });
    await service.answer({ conversationId, customerUserId: 'u1', question: 'Same text', clientMessageId: '00000000-0000-4000-8000-000000000703' });

    expect(knowledge.aiMessages[0]?.clientMessageId).not.toBe(knowledge.aiMessages[1]?.clientMessageId);
  });

  it('keeps the persisted question when the AI gateway fails', async () => {
    const knowledge = knowledgePort([{ content: 'source', id: 'source-1' }]);
    const service = new AiAssistanceService(
      { answerGrounded: vi.fn().mockRejectedValue(new Error('GEMINI_UNAVAILABLE')) },
      knowledge.port,
    );

    await expect(
      service.answer({ conversationId, customerUserId: 'u1', question: 'How?', clientMessageId: questionId }),
    ).resolves.toMatchObject({ grounded: false, citedSourceIds: [] });
    expect(knowledge.questions).toHaveLength(1);
    expect(knowledge.aiMessages).toHaveLength(1);
  });

  it.each([{ citedSourceIds: [] }, { citedSourceIds: ['other'] }])('refuses missing or unknown AI citations: $citedSourceIds', async ({ citedSourceIds }) => {
    const knowledge = knowledgePort([{ content: 'source', id: 'source-1' }]);
    const service = new AiAssistanceService(
      { answerGrounded: vi.fn().mockResolvedValue({ answer: 'unsafe', citedSourceIds, grounded: true }) },
      knowledge.port,
    );

    await expect(
      service.answer({ conversationId, customerUserId: 'u1', question: 'How?', clientMessageId: questionId }),
    ).resolves.toMatchObject({ grounded: false, citedSourceIds: [] });
  });
});
