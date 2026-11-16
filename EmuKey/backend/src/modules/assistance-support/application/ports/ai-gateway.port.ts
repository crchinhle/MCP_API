export const AI_GATEWAY = Symbol('AI_GATEWAY');

export interface GroundingSource {
  kind?: 'KNOWLEDGE' | 'CATALOG';
  productId?: string;
  productCode?: string;
  productName?: string;
  planId?: string;
  planName?: string;
  priceVnd?: number;
  maxActiveDevices?: number;
  durationMonths?: number;
  entitlements?: Record<string, unknown>;
  retrievalMethod?: 'VECTOR' | 'LEXICAL';
  documentId?: string;
  documentTitle?: string;
  documentVersion?: number;
  chunkIndex?: number;
  content: string;
  id: string;
}

export interface CitationDetail {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentVersion: number;
  excerpt: string;
  chunkIndex: number;
}

export interface GroundedQuestion {
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  question: string;
  sources: GroundingSource[];
}

export interface GroundedAnswer {
  evidence?: Array<{ sourceId: string; quote: string }>;
  answer: string;
  citedSourceIds: string[];
  grounded: boolean;
}

export interface AiGatewayPort {
  understandQuestion?(input: {
    question: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<QuestionUnderstanding>;
  selectCatalog?(input: GroundedQuestion): Promise<CatalogSelection>;
  answerGrounded(input: GroundedQuestion): Promise<GroundedAnswer>;
}

export interface QuestionUnderstanding {
  intent:
    | 'PRODUCT_QA'
    | 'USAGE_GUIDANCE'
    | 'PRODUCT_RECOMMENDATION'
    | 'FOLLOW_UP'
    | 'SUPPORT_REQUIRED'
    | 'OUT_OF_SCOPE';
  searchQuery: string;
  productReference: string | null;
  reference: {
    mode: 'NONE' | 'LATEST' | 'ORDINAL' | 'ALL' | 'COMPARE';
    index: number | null;
  };
  requirements: {
    maxPriceVnd: number | null;
    minDevices: number | null;
    durationMonths: number | null;
  };
  requestedFields: Array<
    | 'OVERVIEW'
    | 'PLANS'
    | 'PRICE'
    | 'PROVIDER'
    | 'DEVICES'
    | 'DURATION'
    | 'FEATURES'
    | 'COMPATIBILITY'
  >;
  clarification: string | null;
}

export interface CatalogSelection {
  sourceIds: string[];
  ambiguous: boolean;
  clarification: string | null;
}
