import type {
  AiGatewayPort,
  GroundedAnswer,
  GroundedQuestion,
} from '../application/ports/ai-gateway.port.js';

export class FakeAiGateway implements AiGatewayPort {
  answerGrounded(input: GroundedQuestion): Promise<GroundedAnswer> {
    if (input.sources.length === 0) {
      return Promise.resolve({
        answer: 'Không đủ nguồn để trả lời.',
        citedSourceIds: [],
        grounded: false,
      });
    }
    return Promise.resolve({
      answer: `Câu trả lời giả lập cho: ${input.question}`,
      citedSourceIds: input.sources.map((source) => source.id),
      grounded: true,
    });
  }
}
