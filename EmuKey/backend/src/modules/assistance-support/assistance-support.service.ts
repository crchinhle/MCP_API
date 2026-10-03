import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import type { AuthPrincipal } from '../identity-access/identity.types.js';
import type { AppendMessageDto, CreateConversationDto } from './assistance-support.dto.js';
import type { AssistanceSupportRepository } from './infrastructure/assistance-support.repository.js';
import type { AiAssistanceService } from './ai-assistance.service.js';

export class AssistanceSupportService {
  constructor(
    private readonly repository: AssistanceSupportRepository,
    private readonly ai?: AiAssistanceService,
  ) {}

  async createConversation(actor: AuthPrincipal, dto: CreateConversationDto) {
    this.requireCustomer(actor);
    if ((dto.contextType ?? 'GENERAL') === 'GENERAL' && dto.contextId) throw new ConflictException({ code: 'INVALID_CONVERSATION_CONTEXT' });
    if ((dto.contextType ?? 'GENERAL') !== 'GENERAL' && !dto.contextId) throw new ConflictException({ code: 'INVALID_CONVERSATION_CONTEXT' });
    try {
      return await this.repository.createConversation(actor.sub, dto);
    } catch (error) {
      if (error instanceof Error && error.message === 'CONVERSATION_CONTEXT_NOT_FOUND') throw new NotFoundException({ code: 'CONVERSATION_CONTEXT_NOT_FOUND' });
      throw error;
    }
  }

  list(actor: AuthPrincipal) {
    if (!['CUSTOMER', 'SUPPORT_STAFF', 'SYSTEM_ADMIN'].includes(actor.role)) throw new ForbiddenException();
    return this.repository.listForActor(actor);
  }

  queue(actor: AuthPrincipal) {
    if (actor.role !== 'SUPPORT_STAFF' && actor.role !== 'SYSTEM_ADMIN') throw new ForbiddenException();
    return this.repository.listSupportQueue(actor);
  }

  async find(actor: AuthPrincipal, conversationId: string) {
    const conversation = await this.repository.findConversationForActor(actor, conversationId);
    if (!conversation) throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND' });
    return conversation;
  }

  async requestSupport(actor: AuthPrincipal, conversationId: string, reason: string) {
    this.requireCustomer(actor);
    try {
      return await this.repository.requestSupport(actor.sub, conversationId, reason);
    } catch (error) {
      this.translate(error);
    }
  }

  async claim(actor: AuthPrincipal, conversationId: string) {
    if (actor.role !== 'SUPPORT_STAFF') throw new ForbiddenException();
    try {
      return await this.repository.claimConversation(actor.sub, conversationId);
    } catch (error) {
      this.translate(error);
    }
  }

  async release(actor: AuthPrincipal, conversationId: string) {
    if (actor.role !== 'SUPPORT_STAFF') throw new ForbiddenException();
    try {
      return await this.repository.releaseConversation(actor.sub, conversationId);
    } catch (error) {
      this.translate(error);
    }
  }

  async appendMessage(actor: AuthPrincipal, conversationId: string, dto: AppendMessageDto) {
    const senderType = actor.role === 'CUSTOMER' ? 'CUSTOMER' : actor.role === 'SUPPORT_STAFF' ? 'SUPPORT' : null;
    if (!senderType) throw new ForbiddenException();
    const conversation = await this.repository.findConversationForActor(actor, conversationId);
    if (!conversation) throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND' });
    if (senderType === 'SUPPORT' && conversation.assignedSupportUserId !== actor.sub) throw new ForbiddenException();
    try {
      return await this.repository.appendMessage({ ...dto, actorUserId: actor.sub, conversationId, senderType });
    } catch (error) {
      this.translate(error);
    }
  }

  async listMessages(actor: AuthPrincipal, conversationId: string) {
    const messages = await this.repository.listMessages(actor, conversationId);
    if (!messages) throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND' });
    return messages;
  }

  async listQueuePreviewMessages(actor: AuthPrincipal, conversationId: string) {
    if (actor.role !== 'SUPPORT_STAFF' && actor.role !== 'SYSTEM_ADMIN') throw new ForbiddenException();
    const messages = await this.repository.listQueuePreviewMessages(actor, conversationId);
    if (!messages) throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND' });
    return messages;
  }

  async close(actor: AuthPrincipal, conversationId: string) {
    try {
      return await this.repository.closeConversation(actor, conversationId);
    } catch (error) {
      this.translate(error);
    }
  }

  async askAi(actor: AuthPrincipal, conversationId: string, question: string, clientMessageId: string) {
    this.requireCustomer(actor);
    const conversation = await this.repository.findConversationForActor(actor, conversationId);
    if (!conversation) throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND' });
    if (!this.ai) throw new ConflictException({ code: 'AI_ADAPTER_UNAVAILABLE' });
    try {
      return await this.ai.answer({ conversationId, customerUserId: actor.sub, question, clientMessageId });
    } catch (error) {
      this.translate(error);
    }
  }

  private requireCustomer(actor: AuthPrincipal) {
    if (actor.role !== 'CUSTOMER') throw new ForbiddenException();
  }

  private translate(error: unknown): never {
    const code = error instanceof Error ? error.message : 'CONVERSATION_OPERATION_FAILED';
    if (code === 'CONVERSATION_NOT_FOUND') throw new NotFoundException({ code });
    if (['CONVERSATION_MESSAGE_CONFLICT', 'CONVERSATION_ALREADY_CLAIMED', 'CONVERSATION_STATE_INVALID', 'CONVERSATION_CLOSED', 'CONVERSATION_CLOSE_NOT_ALLOWED'].includes(code)) {
      throw new ConflictException({ code, message: 'The conversation state does not allow this operation.' });
    }
    if (code === 'CONVERSATION_ACCESS_DENIED') throw new ForbiddenException();
    throw error;
  }
}
