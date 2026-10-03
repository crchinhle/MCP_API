export const AI_GATEWAY = Symbol('AI_GATEWAY');

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
