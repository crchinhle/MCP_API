export declare class CreateConversationDto {
    contextId?: string;
    contextType?: 'GENERAL' | 'PRODUCT' | 'PLAN' | 'ORDER' | 'LICENSE';
    title?: string;
}
export declare class AppendMessageDto {
    clientMessageId: string;
    content: string;
}
export declare class AiAskDto {
    clientMessageId: string;
    question: string;
}
export declare class RequestSupportDto {
    reason: string;
}
export declare class AiAnswerDto {
    answer: string;
    citedSourceIds: string[];
    grounded: boolean;
}
export declare class ConversationDto {
    id: string;
    customerUserId: string;
    assignedSupportUserId: string | null;
    status: string;
    contextType: string;
    contextId: string | null;
    title: string | null;
}
export declare class MessageDto {
    id: string;
    conversationId: string;
    clientMessageId: string;
    serverSequence: number;
    senderType: string;
    content: string;
    grounded?: boolean | null;
    sources?: string[];
}
