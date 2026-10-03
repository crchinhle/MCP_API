import type { AuthPrincipal } from '../identity-access/identity.types.js';
import { AiAskDto, AppendMessageDto, CreateConversationDto, RequestSupportDto } from './assistance-support.dto.js';
import { AssistanceSupportService } from './assistance-support.service.js';
export declare class AssistanceSupportController {
    private readonly service;
    constructor(service: AssistanceSupportService);
    list(actor: AuthPrincipal): Promise<import("./assistance-support.types.js").ConversationRecord[]>;
    queue(actor: AuthPrincipal): Promise<import("./assistance-support.types.js").ConversationRecord[]>;
    create(actor: AuthPrincipal, dto: CreateConversationDto): Promise<import("./assistance-support.types.js").ConversationRecord>;
    find(actor: AuthPrincipal, conversationId: string): Promise<import("./assistance-support.types.js").ConversationRecord>;
    append(actor: AuthPrincipal, conversationId: string, dto: AppendMessageDto): Promise<import("./assistance-support.types.js").MessageRecord>;
    messages(actor: AuthPrincipal, conversationId: string): Promise<import("./assistance-support.types.js").MessageRecord[]>;
    askAi(actor: AuthPrincipal, conversationId: string, dto: AiAskDto): Promise<{
        answer: string;
        citedSourceIds: string[];
        grounded: boolean;
    }>;
    requestSupport(actor: AuthPrincipal, conversationId: string, dto: RequestSupportDto): Promise<import("./assistance-support.types.js").ConversationRecord>;
    queuePreviewMessages(actor: AuthPrincipal, conversationId: string): Promise<import("./assistance-support.types.js").MessageRecord[]>;
    claim(actor: AuthPrincipal, conversationId: string): Promise<import("./assistance-support.types.js").ConversationRecord>;
    release(actor: AuthPrincipal, conversationId: string): Promise<import("./assistance-support.types.js").ConversationRecord>;
    close(actor: AuthPrincipal, conversationId: string): Promise<import("./assistance-support.types.js").ConversationRecord>;
}
