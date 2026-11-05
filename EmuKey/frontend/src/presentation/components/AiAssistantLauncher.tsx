import { LoadingOverlay } from './WorkspacePrimitives';
import { CustomerServiceOutlined } from '@ant-design/icons';
import { Button, FloatButton, Input, Popover, Tag } from 'antd';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { KnowledgeCitations } from './KnowledgeCitations';

import { useAskAi, useCreateConversation } from '../../application/assistance/assistanceQueries';
import { useOptionalAuth, type ApiRequestError } from '../../application/auth/authContext';

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
  const accountKey = `emukey-ai-conversation:${auth?.user?.id ?? 'guest'}`;
  const [conversationId, setConversationId] = useState<string | undefined>(() => sessionStorage.getItem(accountKey) ?? undefined);
  const intent = useRef<{ question: string; id: string } | undefined>(undefined);
  const create = useCreateConversation();
  const answer = useAskAi();
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const pending = create.isPending || answer.isPending;

  const ask = async () => {
    if (auth?.user?.role !== 'CUSTOMER' || !question.trim() || pending) return;
    setSubmittedQuestion(question.trim()); setError(false); answer.reset();
    try {
      const id = conversationId ?? (await create.mutateAsync({ contextType: 'GENERAL', title: 'Hỏi trợ lý AI' })).id;
      setConversationId(id);
      sessionStorage.setItem(accountKey,id);
      if (intent.current?.question !== question.trim()) intent.current={ question:question.trim(),id:crypto.randomUUID() };
      await answer.mutateAsync({ conversationId: id, clientMessageId: intent.current.id, question: question.trim() });
      intent.current=undefined;
    } catch (error) {
      setError(true);
      if ([403, 404, 409].includes(Number((error as ApiRequestError)?.status))) setUnavailable(true);
    }
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
            <p>Hỗ trợ sử dụng sản phẩm bạn đã mua. Chưa có bản quyền? Xem danh mục hoặc liên hệ nhân viên.</p>
            <Link to="/products">Xem và so sánh sản phẩm</Link>{' · '}<Link to={conversationId ? `/buyer/support?conversationId=${encodeURIComponent(conversationId)}` : '/buyer/support'}>Mở hội thoại hỗ trợ</Link>
            <><Input.Search aria-label="Câu hỏi cho trợ lý AI" enterButton="Hỏi" disabled={pending} onChange={(event) => setQuestion(event.target.value)} onSearch={() => void ask()} placeholder="Ví dụ: Làm sao quản lý thiết bị đã kích hoạt?" value={question} /><LoadingOverlay active={pending} label="Đang xử lý yêu cầu" /></>
            {pending ? <LoadingOverlay label="Đang hỏi trợ lý AI" /> : null}
            {error ? <p role="alert">{unavailable ? 'Hội thoại này đã kết thúc hoặc chuyển sang nhân viên. Mở hội thoại hỗ trợ để tiếp tục.' : 'Không thể nhận câu trả lời. Vui lòng thử lại.'}</p> : null}
            {unavailable ? <Button onClick={() => { sessionStorage.removeItem(accountKey); setConversationId(undefined); intent.current = undefined; answer.reset(); setUnavailable(false); setError(false); }}>Bắt đầu hội thoại AI khác</Button> : null}
            {answer.data ? <div role="status"><strong>{submittedQuestion}</strong><p>{answer.data.answer}</p><KnowledgeCitations citations={answer.data.citationDetails??[]} /></div> : null}
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
