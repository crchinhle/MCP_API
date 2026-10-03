import type { AiGatewayPort, GroundingSource } from './application/ports/ai-gateway.port.js';
export interface KnowledgeSearchPort {
    searchSources(input: {
        conversationId: string;
        customerUserId: string;
        question: string;
    }): Promise<GroundingSource[]>;
    appendCustomerMessage(input: {
        clientMessageId: string;
        conversationId: string;
        customerUserId: string;
        content: string;
    }): Promise<unknown>;
    appendAiMessage(input: {
        clientMessageId: string;
        conversationId: string;
        content: string;
        citedSourceIds: string[];
        grounded: boolean;
    }): Promise<{
        content: string;
        sources?: string[];
        grounded?: boolean;
    }>;
}
export declare class AiAssistanceService {
    private readonly gateway;
    private readonly knowledge;
    constructor(gateway: AiGatewayPort, knowledge: KnowledgeSearchPort);
    answer(input: {
        conversationId: string;
        customerUserId: string;
        question: string;
        clientMessageId: string;
    }): Promise<{
        answer: string;
        citedSourceIds: string[];
        grounded: boolean;
    }>;
    private persistRefusal;
    private persistAnswer;
}
