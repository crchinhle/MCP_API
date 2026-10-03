import type { Role } from '../identity-access/identity.types.js';

export type ConversationStatus = 'AI_ACTIVE' | 'WAITING_SUPPORT' | 'SUPPORT_ACTIVE' | 'CLOSED';
export type ConversationContextType = 'GENERAL' | 'PRODUCT' | 'PLAN' | 'ORDER' | 'LICENSE';
export type MessageSenderType = 'CUSTOMER' | 'SUPPORT' | 'AI' | 'SYSTEM';

export interface ConversationRecord {
  assignedSupportUserId: string | null;
  contextId: string | null;
  contextType: ConversationContextType;
  customerUserId: string;
  id: string;
  status: ConversationStatus;
  title: string | null;
  updatedAt?: Date;
}

export interface MessageRecord {
  clientMessageId: string;
  content: string;
  conversationId: string;
  createdAt?: Date;
  id?: string;
  senderType: MessageSenderType;
  serverSequence: number;
  grounded?: boolean;
  sources?: string[];
}

export interface ConversationActor {
  role: Role;
  sub: string;
}
