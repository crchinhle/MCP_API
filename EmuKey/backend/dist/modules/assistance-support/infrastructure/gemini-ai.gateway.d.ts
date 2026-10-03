import type { AiGatewayPort, GroundedAnswer, GroundedQuestion } from '../application/ports/ai-gateway.port.js';
interface GeminiOptions {
    apiKey: string;
    model: string;
    timeoutMs: number;
    maxOutputTokens: number;
}
export declare class GeminiAiGateway implements AiGatewayPort {
    private readonly options;
    private readonly client;
    constructor(options: GeminiOptions);
    answerGrounded(input: GroundedQuestion): Promise<GroundedAnswer>;
}
export {};
