import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
export class AssistanceSupportService {
    repository;
    ai;
    constructor(repository, ai) {
        this.repository = repository;
        this.ai = ai;
    }
    async createConversation(actor, dto) {
        this.requireCustomer(actor);
        if ((dto.contextType ?? 'GENERAL') === 'GENERAL' && dto.contextId)
            throw new ConflictException({ code: 'INVALID_CONVERSATION_CONTEXT' });
        if ((dto.contextType ?? 'GENERAL') !== 'GENERAL' && !dto.contextId)
            throw new ConflictException({ code: 'INVALID_CONVERSATION_CONTEXT' });
        try {
            return await this.repository.createConversation(actor.sub, dto);
        }
        catch (error) {
            if (error instanceof Error && error.message === 'CONVERSATION_CONTEXT_NOT_FOUND')
                throw new NotFoundException({ code: 'CONVERSATION_CONTEXT_NOT_FOUND' });
            throw error;
        }
    }
    list(actor) {
        if (!['CUSTOMER', 'SUPPORT_STAFF', 'SYSTEM_ADMIN'].includes(actor.role))
            throw new ForbiddenException();
        return this.repository.listForActor(actor);
    }
    queue(actor) {
        if (actor.role !== 'SUPPORT_STAFF' && actor.role !== 'SYSTEM_ADMIN')
            throw new ForbiddenException();
        return this.repository.listSupportQueue(actor);
    }
    async find(actor, conversationId) {
        const conversation = await this.repository.findConversationForActor(actor, conversationId);
        if (!conversation)
            throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND' });
        return conversation;
    }
    async requestSupport(actor, conversationId, reason) {
        this.requireCustomer(actor);
        try {
            return await this.repository.requestSupport(actor.sub, conversationId, reason);
        }
        catch (error) {
            this.translate(error);
        }
    }
    async claim(actor, conversationId) {
        if (actor.role !== 'SUPPORT_STAFF')
            throw new ForbiddenException();
        try {
            return await this.repository.claimConversation(actor.sub, conversationId);
        }
        catch (error) {
            this.translate(error);
        }
    }
    async release(actor, conversationId) {
        if (actor.role !== 'SUPPORT_STAFF')
            throw new ForbiddenException();
        try {
            return await this.repository.releaseConversation(actor.sub, conversationId);
        }
        catch (error) {
            this.translate(error);
        }
    }
    async appendMessage(actor, conversationId, dto) {
        const senderType = actor.role === 'CUSTOMER' ? 'CUSTOMER' : actor.role === 'SUPPORT_STAFF' ? 'SUPPORT' : null;
        if (!senderType)
            throw new ForbiddenException();
        const conversation = await this.repository.findConversationForActor(actor, conversationId);
        if (!conversation)
            throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND' });
        if (senderType === 'SUPPORT' && conversation.assignedSupportUserId !== actor.sub)
            throw new ForbiddenException();
        try {
            return await this.repository.appendMessage({ ...dto, actorUserId: actor.sub, conversationId, senderType });
        }
        catch (error) {
            this.translate(error);
        }
    }
    async listMessages(actor, conversationId) {
        const messages = await this.repository.listMessages(actor, conversationId);
        if (!messages)
            throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND' });
        return messages;
    }
    async listQueuePreviewMessages(actor, conversationId) {
        if (actor.role !== 'SUPPORT_STAFF' && actor.role !== 'SYSTEM_ADMIN')
            throw new ForbiddenException();
        const messages = await this.repository.listQueuePreviewMessages(actor, conversationId);
        if (!messages)
            throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND' });
        return messages;
    }
    async close(actor, conversationId) {
        try {
            return await this.repository.closeConversation(actor, conversationId);
        }
        catch (error) {
            this.translate(error);
        }
    }
    async askAi(actor, conversationId, question, clientMessageId) {
        this.requireCustomer(actor);
        const conversation = await this.repository.findConversationForActor(actor, conversationId);
        if (!conversation)
            throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND' });
        if (!this.ai)
            throw new ConflictException({ code: 'AI_ADAPTER_UNAVAILABLE' });
        try {
            return await this.ai.answer({ conversationId, customerUserId: actor.sub, question, clientMessageId });
        }
        catch (error) {
            this.translate(error);
        }
    }
    requireCustomer(actor) {
        if (actor.role !== 'CUSTOMER')
            throw new ForbiddenException();
    }
    translate(error) {
        const code = error instanceof Error ? error.message : 'CONVERSATION_OPERATION_FAILED';
        if (code === 'CONVERSATION_NOT_FOUND')
            throw new NotFoundException({ code });
        if (['CONVERSATION_MESSAGE_CONFLICT', 'CONVERSATION_ALREADY_CLAIMED', 'CONVERSATION_STATE_INVALID', 'CONVERSATION_CLOSED', 'CONVERSATION_CLOSE_NOT_ALLOWED'].includes(code)) {
            throw new ConflictException({ code, message: 'The conversation state does not allow this operation.' });
        }
        if (code === 'CONVERSATION_ACCESS_DENIED')
            throw new ForbiddenException();
        throw error;
    }
}
//# sourceMappingURL=assistance-support.service.js.map