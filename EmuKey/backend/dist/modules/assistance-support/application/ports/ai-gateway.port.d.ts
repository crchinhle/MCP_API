export declare const AI_GATEWAY: unique symbol;
export interface GroundingSource {
    content: string;
    id: string;
}
export interface GroundedQuestion {
    question: string;
    sources: GroundingSource[];
}
export interface GroundedAnswer {
    answer: string;
    citedSourceIds: string[];
    grounded: boolean;
}
export interface AiGatewayPort {
    answerGrounded(input: GroundedQuestion): Promise<GroundedAnswer>;
}
