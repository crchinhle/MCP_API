import { LoadingOverlay } from './WorkspacePrimitives';
import { CustomerServiceOutlined } from '@ant-design/icons';
import { Button, FloatButton, Input, Popover, Tag } from 'antd';
import { useState } from 'react';

import { useAskAi, useCreateConversation } from '../../application/assistance/assistanceQueries';
import { useOptionalAuth } from '../../application/auth/authContext';

const assistantPanelId = 'emukey-ai-assistant-panel';

export function AiAssistantLauncher() {
  const auth = useOptionalAuth();
  return <AssistantSession key={auth?.user?.id ?? 'guest'} />;
}

function AssistantSession() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const auth = useOptionalAuth();
  const [conversationId, setConversationId] = useState<string>();
  const create = useCreateConversation();
  const answer = useAskAi();
  const [error, setError] = useState(false);
  const pending = create.isPending || answer.isPending;

  const ask = async () => {
    if (auth?.user?.role !== 'CUSTOMER' || !question.trim() || pending) return;
    setSubmittedQuestion(question.trim()); setError(false); answer.reset();
    try {
      const id = conversationId ?? (await create.mutateAsync({ contextType: 'GENERAL', title: 'Hỏi trợ lý AI' })).id;
      setConversationId(id);
      await answer.mutateAsync({ conversationId: id, clientMessageId: crypto.randomUUID(), question: question.trim() });
    } catch { setError(true); }
  };

  return (
    <Popover
      content={
        <section
          aria-label="Trợ lý AI Emukey"
          className="ai-assistant-panel"
          id={assistantPanelId}
        >
          <Tag color="purple">AI</Tag>
          <h2>Trợ lý AI Emukey</h2>
          {auth?.user?.role === 'CUSTOMER' ? <>
            <p>Hỏi về số thiết bị, thời hạn và quyền sử dụng phù hợp.</p>
            <><Input.Search aria-label="Câu hỏi cho trợ lý AI" enterButton="Hỏi" disabled={pending} onChange={(event) => setQuestion(event.target.value)} onSearch={() => void ask()} placeholder="Ví dụ: Gói nào cho 3 thiết bị?" value={question} /><LoadingOverlay active={pending} label="Đang xử lý yêu cầu" /></>
            {pending ? <LoadingOverlay label="Đang hỏi trợ lý AI" /> : null}
            {error ? <p role="alert">Không thể nhận câu trả lời. Vui lòng thử lại.</p> : null}
            {answer.data ? <div role="status"><strong>{submittedQuestion}</strong><p>{answer.data.answer}</p><small>{answer.data.grounded ? `Nguồn tham khảo: ${answer.data.citedSourceIds.join(', ')}` : 'Chưa có đủ nguồn xác thực; hãy liên hệ hỗ trợ.'}</small></div> : null}
          </> : <>
            <p>{auth?.user ? 'Trợ lý tư vấn này dành cho tài khoản người mua.' : 'Đăng nhập tài khoản người mua để hỏi trợ lý theo nguồn tài liệu chính thức.'}</p>
            {!auth?.user ? <Button href="/auth" type="primary">Đăng nhập</Button> : null}
          </>}
        </section>
      }
      onOpenChange={setOpen}
      open={open}
      placement="topRight"
      trigger="click"
    >
      <FloatButton
        aria-controls={assistantPanelId}
        aria-expanded={open}
        className="ai-assistant-launcher"
        aria-label="Mở chat chăm sóc khách hàng"
        icon={<CustomerServiceOutlined />}
        tooltip={open ? undefined : 'Chat chăm sóc khách hàng'}
        type="primary"
      />
    </Popover>
  );
}
