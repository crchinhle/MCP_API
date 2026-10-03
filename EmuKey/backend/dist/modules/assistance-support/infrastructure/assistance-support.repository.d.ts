import { Pool } from 'pg';
import type { ConversationActor } from '../assistance-support.types.js';
import type { ConversationContextType, ConversationRecord, MessageRecord, MessageSenderType } from '../assistance-support.types.js';
import { NotificationRepository } from '../../operations/infrastructure/notification.repository.js';
export declare class AssistanceSupportRepository {
    private readonly pool;
    private readonly notifications;
    constructor(pool: Pool, notifications?: NotificationRepository);
    createConversation(customerUserId: string, input: {
        contextId?: string;
        contextType?: ConversationContextType;
        title?: string;
    }): Promise<ConversationRecord>;
    listForActor(actor: ConversationActor): Promise<ConversationRecord[]>;
    listSupportQueue(actor: ConversationActor): Promise<ConversationRecord[]>;
    findConversationForActor(actor: ConversationActor, conversationId: string): Promise<ConversationRecord | null>;
    listMessages(actor: ConversationActor, conversationId: string): Promise<MessageRecord[] | null>;
    listQueuePreviewMessages(actor: ConversationActor, conversationId: string): Promise<MessageRecord[] | null>;
    private listMessagesForConversation;
    requestSupport(customerUserId: string, conversationId: string, reason: string): Promise<ConversationRecord>;
    claimConversation(supportUserId: string, conversationId: string): Promise<ConversationRecord>;
    releaseConversation(supportUserId: string, conversationId: string): Promise<ConversationRecord>;
    closeConversation(actor: ConversationActor, conversationId: string): Promise<ConversationRecord>;
    appendMessage(input: {
        actorUserId: string;
        clientMessageId: string;
        content: string;
        conversationId: string;
        senderType: Extract<MessageSenderType, 'CUSTOMER' | 'SUPPORT'>;
    }): Promise<MessageRecord>;
    appendAiMessage(input: {
        clientMessageId: string;
        conversationId: string;
        content: string;
        citedSourceIds: string[];
        grounded: boolean;
    }): Promise<MessageRecord>;
    appendCustomerMessage(input: {
        clientMessageId: string;
        conversationId: string;
        customerUserId: string;
        content: string;
    }): Promise<MessageRecord>;
    private appendSystemMessageInTransaction;
    private transaction;
}
