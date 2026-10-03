import type { AiGatewayPort, GroundedAnswer, GroundedQuestion } from '../application/ports/ai-gateway.port.js';
export declare class FakeAiGateway implements AiGatewayPort {
    answerGrounded(input: GroundedQuestion): Promise<GroundedAnswer>;
}
