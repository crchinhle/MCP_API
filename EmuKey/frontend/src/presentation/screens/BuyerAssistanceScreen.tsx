import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Empty, Input, Modal } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOptionalAuth } from '../../application/auth/authContext';

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
  const auth = useOptionalAuth();
  const creationKey = `support-create:${auth?.user?.id}`;
  const [restored] = useState(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(creationKey) ?? 'null') as unknown;
      if (value && typeof value === 'object' && 'title' in value && 'description' in value &&
          typeof value.title === 'string' && typeof value.description === 'string') {
        const request = 'request' in value ? value.request : null;
        return { title: value.title, description: value.description,
          request: request && typeof request === 'object' && 'body' in request && 'id' in request &&
            typeof request.body === 'string' && typeof request.id === 'string' ? { body: request.body, id: request.id } : undefined };
      }
    } catch { /* An unavailable browser store does not prevent support. */ }
    return { title: '', description: '', request: undefined };
  });
  const [creating, setCreating] = useState(Boolean(restored.description));
  const [title, setTitle] = useState(restored.title);
  const [description, setDescription] = useState(restored.description);
  const createIntent = useRef<{ body: string; id: string } | undefined>(restored.request);
  const createLock = useRef(false);
  useEffect(() => {
    try { sessionStorage.setItem(creationKey, JSON.stringify({ title, description, request: createIntent.current })); } catch { /* Storage is optional. */ }
  }, [creationKey, title, description]);
  const conversations = useConversations();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('conversationId') ?? searchParams.get('conversation');
  const setSelectedId = (id: string) => setSearchParams({ conversationId: id });
  const append = useAppendConversationMessage();
  const askAi = useAskAi();
  const create = useCreateConversation();
  const requestSupport = useRequestSupport();
  const conversation = selectedId ? conversations.data?.find((item) => item.id === selectedId) : conversations.data?.[0];
  const messages = useConversationMessages(conversation?.id);
  const startConversation = async () => {
    if (createLock.current || !description.trim()) return;
    const context = (['ORDER', 'LICENSE', 'PRODUCT', 'PLAN'] as const).find(type => searchParams.get(`${type.toLowerCase()}Id`));
    const input = { mode: 'SUPPORT' as const, contextType: context ?? 'GENERAL' as const,
      ...(context ? { contextId: searchParams.get(`${context.toLowerCase()}Id`)! } : {}),
      title: title.trim() || 'Yêu cầu hỗ trợ', initialMessage: description.trim() };
    const body = JSON.stringify(input);
    if (createIntent.current?.body !== body) createIntent.current = { body, id: crypto.randomUUID() };
    try { sessionStorage.setItem(creationKey, JSON.stringify({ title, description, request: createIntent.current })); } catch { /* Storage is optional. */ }
    createLock.current = true;
    try {
      const created = await create.mutateAsync({ ...input, clientRequestId: createIntent.current.id });
      setSelectedId(created.id); askAi.reset(); setCreating(false); setTitle(''); setDescription(''); createIntent.current = undefined;
    } catch { /* The form and intent remain available for retry. */ }
    finally { createLock.current = false; }
  };
  const createForm = <Modal title="Tạo yêu cầu hỗ trợ" open={creating} onCancel={() => { if (!create.isPending) setCreating(false); }} footer={null}>
    <form className="support-request-form" onSubmit={event => { event.preventDefault(); void startConversation(); }}>
      <label>Chủ đề<Input aria-label="Chủ đề hỗ trợ" value={title} maxLength={255} disabled={create.isPending} onChange={event => setTitle(event.target.value)} /></label>
      <label>Mô tả vấn đề<Input.TextArea aria-label="Mô tả vấn đề" value={description} maxLength={8000} rows={4} required disabled={create.isPending} onChange={event => setDescription(event.target.value)} /></label>
      {create.isError ? <Alert type="error" title="Không thể tạo hội thoại. Vui lòng thử lại." /> : null}
      <Button type="primary" htmlType="submit" loading={create.isPending} disabled={!description.trim()}>Gửi yêu cầu hỗ trợ</Button>
    </form>
  </Modal>;
  if (conversations.isLoading) return <PageLoading />;
  if (conversations.isError) return <Alert type="error" title="Không thể tải hội thoại" action={<Button onClick={() => void conversations.refetch()}>Thử lại</Button>} />;
  if (selectedId && !conversation) return <Alert type="warning" title="Không tìm thấy hội thoại được yêu cầu." description="Hội thoại có thể chưa tải xong hoặc bạn không có quyền truy cập." action={<><Button onClick={() => void conversations.refetch()}>Thử lại</Button><Button onClick={() => setSearchParams({})}>Xem các hội thoại của tôi</Button></>} />;
  if (!conversation) {
    return (
      <>
        <PageHeader title="Hội thoại hỗ trợ" />
        {createForm}
        <Empty description="Bạn chưa có hội thoại hỗ trợ." image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <><Button disabled={create.isPending} onClick={() => setCreating(true)} type="primary">
            Tạo yêu cầu mới
          </Button><LoadingOverlay active={create.isPending} label="Đang xử lý yêu cầu: Bắt đầu hội thoại" /></>
        </Empty>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Hội thoại hỗ trợ"
        action={<span className="workspace-actions"><Button onClick={() => setCreating(true)} type="primary">Tạo yêu cầu mới</Button>{conversation.status === 'AI_ACTIVE' ? <><Button disabled={requestSupport.isPending || askAi.isPending} onClick={() => requestSupport.mutate({ conversationId: conversation.id, reason: 'Khách hàng yêu cầu nhân viên hỗ trợ.' })}>Chuyển cho nhân viên</Button><LoadingOverlay active={requestSupport.isPending} label="Đang chuyển cho nhân viên" /></> : null}</span>}
      />
      {createForm}
      {requestSupport.isError ? <Alert type="error" title="Chưa chuyển được yêu cầu. Vui lòng thử lại." /> : null}
      {requestSupport.isSuccess && requestSupport.variables.conversationId === conversation.id ? <Alert type="success" title="Đã gửi yêu cầu đến nhân viên hỗ trợ." /> : null}
      <StatusChip tone={conversation.status === 'CLOSED' ? 'success' : 'info'}>{conversationStatusLabels[conversation.status]}</StatusChip>
      <div className="support-thread-tabs" aria-label="Hội thoại hỗ trợ">
        {(conversations.data ?? [conversation]).map((item) => (
          <Button
            key={item.id}
            onClick={() => { setSelectedId(item.id); askAi.reset(); }}
            type={item.id === conversation.id ? 'primary' : 'default'}
          >
            {item.title ?? 'Hội thoại hỗ trợ'}
          </Button>
        ))}
      </div>
      <div className="support-layout" key={conversation.id}>
        <section className="workspace-card conversation-card">
          <header>
            <h2>{conversation.title ?? 'Hội thoại hỗ trợ'}</h2>
          </header>
          {messages.isError ? <Alert type="error" title="Không thể tải tin nhắn" action={<Button onClick={() => void messages.refetch()}>Thử lại</Button>} /> : null}
          {messages.isLoading ? <LoadingOverlay label="Đang tải tin nhắn" /> : null}
          {messages.isFetching && messages.data ? <small role="status">Đang đồng bộ tin nhắn…</small> : null}
          <ConversationPanel
            hasOlder={messages.hasOlder}
            loadingOlder={messages.isLoadingOlder}
            olderError={messages.olderError}
            onLoadOlder={() => messages.loadOlder()}
            author="Buyer"
            draftKey={`support-draft:${auth?.user?.id}:${conversation.id}`}
            initialMessages={(messages.data ?? []).map((message) => ({
              body: message.content,
              citationDetails:message.citationDetails??[],
              id: message.id,
              ...(message.createdAt ? { createdAt: message.createdAt } : {}),
              catalogSources: [...(message.catalogSources ?? []), ...(message.recommendations ?? [])].filter((source, index, all) => all.findIndex(item => item.id === source.id) === index),
              author: message.senderType === 'CUSTOMER' ? ('Buyer' as const) : message.senderType === 'AI' ? ('AI' as const) : message.senderType === 'SYSTEM' ? ('System' as const) : ('Support' as const),
            }))}
            inputLabel="Tin nhắn hỗ trợ"
            {...(conversation.status === 'WAITING_SUPPORT' || conversation.status === 'SUPPORT_ACTIVE' ? { onSubmit: (content: string, clientMessageId: string) => append.mutateAsync({ clientMessageId, content, conversationId: conversation.id }) } : {})}
            {...(conversation.status === 'AI_ACTIVE' ? { onAskAi: (question: string, clientMessageId: string) => askAi.mutateAsync({ conversationId: conversation.id, question, clientMessageId }) } : {})}
            readOnly={conversation.status === 'CLOSED'}
            submitLabel="Gửi tin nhắn"
          />
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
