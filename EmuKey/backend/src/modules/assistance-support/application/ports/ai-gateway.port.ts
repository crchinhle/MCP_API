export const AI_GATEWAY = Symbol('AI_GATEWAY');

export interface GroundingSource {
  documentId?: string;
  documentTitle?: string;
  documentVersion?: number;
  chunkIndex?: number;
  content: string;
  id: string;
}

export interface CitationDetail {
  chunkId:string;documentId:string;documentTitle:string;documentVersion:number;excerpt:string;chunkIndex:number;
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
