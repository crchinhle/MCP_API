import { ConflictException, ForbiddenException } from '@nestjs/common';

import { AssistanceSupportService } from '../../src/modules/assistance-support/assistance-support.service.js';

const customer = { role: 'CUSTOMER' as const, sessionVersion: 1, sub: '00000000-0000-4000-8000-000000000004' };
const support = { role: 'SUPPORT_STAFF' as const, sessionVersion: 1, sub: '00000000-0000-4000-8000-000000000005' };
const admin = { role: 'SYSTEM_ADMIN' as const, sessionVersion: 1, sub: '00000000-0000-4000-8000-000000000006' };
const conversation = {
  assignedSupportUserId: null,
  contextId: null,
  contextType: 'GENERAL',
  customerUserId: customer.sub,
  id: '00000000-0000-4000-8000-000000000701',
  status: 'AI_ACTIVE',
  title: 'Activation help',
};

function fixture() {
  const repository = {
    appendMessage: vi.fn().mockResolvedValue({
      clientMessageId: '00000000-0000-4000-8000-000000000702',
      content: 'Hello',
      conversationId: conversation.id,
      senderType: 'CUSTOMER',
      serverSequence: 1,
    }),
    claimConversation: vi.fn().mockResolvedValue({ ...conversation, assignedSupportUserId: support.sub, status: 'SUPPORT_ACTIVE' }),
    closeConversation: vi.fn().mockResolvedValue({ ...conversation, status: 'CLOSED' }),
    createConversation: vi.fn().mockResolvedValue(conversation),
    findConversationForActor: vi.fn().mockResolvedValue(conversation),
    listForActor: vi.fn().mockResolvedValue([conversation]),
    listQueuePreviewMessages: vi.fn().mockResolvedValue([
      { clientMessageId: 'c1', content: 'I need help', conversationId: conversation.id, senderType: 'CUSTOMER', serverSequence: 1 },
    ]),
    releaseConversation: vi.fn().mockResolvedValue({ ...conversation, status: 'WAITING_SUPPORT' }),
    requestSupport: vi.fn().mockResolvedValue({ ...conversation, status: 'WAITING_SUPPORT' }),
  };
  return { repository, service: new AssistanceSupportService(repository as never) };
}

describe('AssistanceSupportService', () => {
  it.each(['CONVERSATION_CLOSED', 'CONVERSATION_STATE_INVALID', 'CONVERSATION_MESSAGE_CONFLICT'])('maps AI state failure %s to a conflict', async (code) => {
    const { repository } = fixture();
    const service = new AssistanceSupportService(repository as never, { answer: vi.fn().mockRejectedValue(new Error(code)) } as never);
    await expect(service.askAi(customer, conversation.id, 'Question', '00000000-0000-4000-8000-000000000702')).rejects.toBeInstanceOf(ConflictException);
  });
  it('allows an owned customer to create and append an idempotent message', async () => {
    const { repository, service } = fixture();

    await expect(service.createConversation(customer, { title: 'Activation help' })).resolves.toEqual(conversation);
    await expect(service.appendMessage(customer, conversation.id, {
      clientMessageId: '00000000-0000-4000-8000-000000000702',
      content: 'Hello',
    })).resolves.toMatchObject({ serverSequence: 1 });
    expect(repository.appendMessage).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: customer.sub,
      conversationId: conversation.id,
      senderType: 'CUSTOMER',
    }));
  });

  it('rejects a support actor from appending before claiming the conversation', async () => {
    const { repository, service } = fixture();
    repository.findConversationForActor.mockResolvedValueOnce({ ...conversation, assignedSupportUserId: null });

    await expect(service.appendMessage(support, conversation.id, {
      clientMessageId: '00000000-0000-4000-8000-000000000703',
      content: 'Reply',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.appendMessage).not.toHaveBeenCalled();
  });

  it('maps a second support claim to a conflict', async () => {
    const { repository, service } = fixture();
    repository.claimConversation.mockRejectedValueOnce(new Error('CONVERSATION_ALREADY_CLAIMED'));

    await expect(service.claim(support, conversation.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('SUP-03: escalates with a customer-supplied reason', async () => {
    const { repository, service } = fixture();

    await service.requestSupport(customer, conversation.id, 'Activation failed for my license');
    expect(repository.requestSupport).toHaveBeenCalledWith(customer.sub, conversation.id, 'Activation failed for my license');
  });

  it('SUP-21: lets staff preview an unclaimed queue item without claiming it', async () => {
    const { repository, service } = fixture();

    await expect(service.listQueuePreviewMessages(support, conversation.id)).resolves.toHaveLength(1);
    expect(repository.listQueuePreviewMessages).toHaveBeenCalledWith(support, conversation.id);
    expect(repository.claimConversation).not.toHaveBeenCalled();
  });

  it('SUP-21: rejects queue preview for non-staff roles', async () => {
    const { service } = fixture();

    await expect(service.listQueuePreviewMessages(customer, conversation.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('SUP-22: releases a claimed conversation back to the queue', async () => {
    const { repository, service } = fixture();
    repository.findConversationForActor.mockResolvedValue({ ...conversation, assignedSupportUserId: support.sub, status: 'SUPPORT_ACTIVE' });

    await expect(service.release(support, conversation.id)).resolves.toMatchObject({ status: 'WAITING_SUPPORT' });
    expect(repository.releaseConversation).toHaveBeenCalledWith(support.sub, conversation.id);
  });

  it('SUP-22: only the assigned support agent can release', async () => {
    const { repository, service } = fixture();
    const otherSupport = { ...support, sub: '00000000-0000-4000-8000-000000000099' };
    repository.releaseConversation.mockRejectedValueOnce(new Error('CONVERSATION_STATE_INVALID'));

    await expect(service.release(otherSupport, conversation.id)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects release by a customer or admin', async () => {
    const { service } = fixture();

    await expect(service.release(customer, conversation.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.release(admin, conversation.id)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
