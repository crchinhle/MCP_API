import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Empty } from 'antd';
import { useState } from 'react';

import { conversationContextLabels, conversationStatusLabels, useAppendConversationMessage, useAskAi, useConversationMessages, useConversations, useCreateConversation } from '../../application/assistance/assistanceQueries';
import { useRequestSupport } from '../../application/assistance/supportQueries';
import { ConversationPanel } from '../components/ConversationPanel';
import {
  PageLoading,
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

export function BuyerAssistanceScreen() {
  const conversations = useConversations();
  const [selectedId, setSelectedId] = useState<string>();
  const append = useAppendConversationMessage();
  const askAi = useAskAi();
  const create = useCreateConversation();
  const requestSupport = useRequestSupport();
  const conversation = conversations.data?.find((item) => item.id === selectedId) ?? conversations.data?.[0];
  const messages = useConversationMessages(conversation?.id);
  const startConversation = () => create.mutate(
    { contextType: 'GENERAL', title: 'Hội thoại hỗ trợ' },
    { onSuccess: (created) => { setSelectedId(created.id); askAi.reset(); } },
  );
  if (conversations.isLoading) return <PageLoading />;
  if (conversations.isError) return <Alert type="error" title="Không thể tải hội thoại" action={<Button onClick={() => void conversations.refetch()}>Thử lại</Button>} />;
  if (!conversation) {
    return (
      <>
        <PageHeader title="Hội thoại hỗ trợ" />
        {create.isError ? <Alert type="error" title="Không thể tạo hội thoại. Vui lòng thử lại." /> : null}
        <Empty description="Bạn chưa có hội thoại hỗ trợ." image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <><Button disabled={create.isPending} onClick={startConversation} type="primary">
            Bắt đầu hội thoại
          </Button><LoadingOverlay active={create.isPending} label="Đang xử lý yêu cầu: Bắt đầu hội thoại" /></>
        </Empty>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Hội thoại hỗ trợ"
        action={<span className="workspace-actions"><><Button disabled={create.isPending} onClick={startConversation} type="primary">Tạo yêu cầu mới</Button><LoadingOverlay active={create.isPending} label="Đang xử lý yêu cầu: Tạo yêu cầu mới" /></>{conversation.status === 'AI_ACTIVE' ? <><Button disabled={requestSupport.isPending} onClick={() => requestSupport.mutate({ conversationId: conversation.id, reason: 'AI chưa giải quyết được yêu cầu.' })}>Chuyển cho nhân viên</Button><LoadingOverlay active={requestSupport.isPending} label="Đang xử lý yêu cầu: Chuyển cho nhân viên" /></> : null}</span>}
      />
      {create.isError ? <Alert type="error" title="Không thể tạo hội thoại. Vui lòng thử lại." /> : null}
      <StatusChip tone={conversation.status === 'CLOSED' ? 'success' : 'info'}>{conversationStatusLabels[conversation.status]}</StatusChip>
      <div className="support-thread-tabs" aria-label="Hội thoại hỗ trợ">
        {(conversations.data ?? [conversation]).map((item) => (
          <Button
            key={item.id}
            onClick={() => { setSelectedId(item.id); askAi.reset(); }}
            type={item.id === conversation.id ? 'primary' : 'default'}
          >
            {item.title ?? item.id}
          </Button>
        ))}
      </div>
      <div className="support-layout" key={conversation.id}>
        <section className="workspace-card conversation-card">
          <header>
            <small>#{conversation.id}</small>
            <h2>{conversation.title ?? 'Hội thoại hỗ trợ'}</h2>
          </header>
          {messages.isError ? <Alert type="error" title="Không thể tải tin nhắn" action={<Button onClick={() => void messages.refetch()}>Thử lại</Button>} /> : null}
          {messages.isLoading ? <LoadingOverlay label="Đang tải tin nhắn" /> : null}
          <ConversationPanel
            author="Buyer"
            initialMessages={(messages.data ?? []).map((message) => ({
              body: message.content,
              id: message.id,
              author: message.senderType === 'CUSTOMER' ? ('Buyer' as const) : message.senderType === 'AI' ? ('AI' as const) : ('Support' as const),
            }))}
            inputLabel="Tin nhắn hỗ trợ"
            onSubmit={(content) => append.mutateAsync({ clientMessageId: crypto.randomUUID(), content, conversationId: conversation.id })}
            onAskAi={(question) => askAi.mutateAsync({ conversationId: conversation.id, question, clientMessageId: crypto.randomUUID() })}
            readOnly={conversation.status === 'CLOSED'}
            submitLabel="Gửi tin nhắn"
          />
          {askAi.data ? <section aria-label="Câu trả lời AI"><h3>Trợ lý AI</h3><p>{askAi.data.answer}</p><p className="muted-copy">{askAi.data.grounded ? `Nguồn tham khảo: ${askAi.data.citedSourceIds.join(', ')}` : 'Chưa tìm thấy nguồn xác thực. Bạn nên kiểm tra lại với nhân viên hỗ trợ.'}</p></section> : null}
        </section>
        <aside className="workspace-card detail-card">
          <h2>Thông tin liên quan</h2>
          <FactList
            facts={[
               { label: 'Nội dung cần hỗ trợ', value: conversationContextLabels[conversation.contextType] },
               { label: 'Trạng thái', value: conversationStatusLabels[conversation.status] },
            ]}
          />
        </aside>
      </div>
    </>
  );
}
