import type { AuthPrincipal } from '../identity-access/identity.types.js';
import type { AppendMessageDto, CreateConversationDto } from './assistance-support.dto.js';
import type { AssistanceSupportRepository } from './infrastructure/assistance-support.repository.js';
import type { AiAssistanceService } from './ai-assistance.service.js';
export declare class AssistanceSupportService {
    private readonly repository;
    private readonly ai?;
    constructor(repository: AssistanceSupportRepository, ai?: AiAssistanceService | undefined);
    createConversation(actor: AuthPrincipal, dto: CreateConversationDto): Promise<import("./assistance-support.types.js").ConversationRecord>;
    list(actor: AuthPrincipal): Promise<import("./assistance-support.types.js").ConversationRecord[]>;
    queue(actor: AuthPrincipal): Promise<import("./assistance-support.types.js").ConversationRecord[]>;
    find(actor: AuthPrincipal, conversationId: string): Promise<import("./assistance-support.types.js").ConversationRecord>;
    requestSupport(actor: AuthPrincipal, conversationId: string, reason: string): Promise<import("./assistance-support.types.js").ConversationRecord>;
    claim(actor: AuthPrincipal, conversationId: string): Promise<import("./assistance-support.types.js").ConversationRecord>;
    release(actor: AuthPrincipal, conversationId: string): Promise<import("./assistance-support.types.js").ConversationRecord>;
    appendMessage(actor: AuthPrincipal, conversationId: string, dto: AppendMessageDto): Promise<import("./assistance-support.types.js").MessageRecord>;
    listMessages(actor: AuthPrincipal, conversationId: string): Promise<import("./assistance-support.types.js").MessageRecord[]>;
    listQueuePreviewMessages(actor: AuthPrincipal, conversationId: string): Promise<import("./assistance-support.types.js").MessageRecord[]>;
    close(actor: AuthPrincipal, conversationId: string): Promise<import("./assistance-support.types.js").ConversationRecord>;
    askAi(actor: AuthPrincipal, conversationId: string, question: string, clientMessageId: string): Promise<{
        answer: string;
        citedSourceIds: string[];
        grounded: boolean;
    }>;
    private requireCustomer;
    private translate;
}
