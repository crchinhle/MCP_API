import {
  CloseOutlined,
  CustomerServiceOutlined,
  PlusOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { Button, FloatButton } from 'antd';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Link } from 'react-router-dom';
import {
  useAskAi,
  useAskPublicAi,
  useConversation,
  useConversationMessages,
  useCreateConversation,
  type AssistantMetadata,
  type CatalogSource,
  type MessageDto,
} from '../../application/assistance/assistanceQueries';
import { useRequestSupport } from '../../application/assistance/supportQueries';
import {
  useOptionalAuth,
  type ApiRequestError,
} from '../../application/auth/authContext';
import { KnowledgeCitations } from './KnowledgeCitations';
import './AiAssistant.css';

const panelId = 'emukey-ai-assistant-panel';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ChatMessage = Pick<
  MessageDto,
  'id' | 'clientMessageId' | 'senderType' | 'content' | 'citationDetails' | 'createdAt'
> &
  Partial<AssistantMetadata>;
type GuestSession = { sessionId?: string | undefined; messages: ChatMessage[] };
type FailedIntent = { question: string; id: string };

function readStorage(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value?: string) {
  try {
    if (value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* Chat remains usable when browser storage is disabled. */
  }
}
function restoreGuest(key: string): GuestSession {
  try {
    const saved = JSON.parse(readStorage(key) ?? 'null') as GuestSession | null;
    if (
      saved?.sessionId &&
      uuid.test(saved.sessionId) &&
      Array.isArray(saved.messages)
    ) {
      return {
        sessionId: saved.sessionId,
        messages: saved.messages.slice(-40),
      };
    }
  } catch {
    /* Invalid or unavailable storage starts a new session. */
  }
  return { messages: [] };
}

function isPersisted(message: ChatMessage, history: MessageDto[]) {
  if (
    history.some(
      (saved) =>
        saved.clientMessageId === message.clientMessageId &&
        saved.senderType === message.senderType,
    )
  )
    return true;
  if (message.senderType !== 'AI') return false;
  // The backend derives a different idempotency UUID for the AI response.
  // Match it to the answer following this customer turn, never by answer text.
  const questionIndex = history.findIndex(
    (saved) =>
      saved.senderType === 'CUSTOMER' &&
      saved.clientMessageId === message.clientMessageId,
  );
  if (questionIndex < 0) return false;
  for (const saved of history.slice(questionIndex + 1)) {
    if (saved.senderType === 'CUSTOMER') return false;
    if (saved.senderType === 'AI') return true;
  }
  return false;
}

function CatalogSources({ sources }: { sources: CatalogSource[] }) {
  const unique = sources.filter(
    (source, index) =>
      sources.findIndex((item) => item.productCode === source.productCode) ===
      index,
  );
  return unique.length ? (
    <nav className="emu-ai-sources" aria-label="Nguồn sản phẩm">
      {unique.map((source) => (
        <Button
          key={source.productCode}
          href={`/products/${encodeURIComponent(source.productCode)}`}
        >
          Xem nguồn: {source.productName}
        </Button>
      ))}
    </nav>
  ) : null;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const ai = message.senderType === 'AI';
  if (message.senderType === 'SYSTEM') return <article className="emu-ai-system"><small>Thông báo hệ thống</small><p>{message.content}</p>{message.createdAt ? <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time> : null}</article>;
  return (
    <article
      className={`emu-ai-message ${message.senderType === 'CUSTOMER' ? 'emu-ai-message-user' : ''}`}
    >
      <span className="emu-ai-speaker">
        {message.senderType === 'CUSTOMER'
          ? 'Bạn'
          : ai
            ? 'Trợ lý AI'
            : 'Hỗ trợ'}
      </span>
      <div className="emu-ai-bubble">
        <p>{message.content}</p>
        {message.createdAt ? <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</time> : null}
        {ai ? (
          <>
            <CatalogSources
              sources={[
                ...(message.recommendations ?? []),
                ...(message.catalogSources ?? []),
              ]}
            />
            {message.citationDetails?.length ? (
              <KnowledgeCitations citations={message.citationDetails} />
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

export function AiAssistantLauncher() {
  const auth = useOptionalAuth();
  return (
    <AssistantSession
      key={`${auth?.user?.id ?? 'guest'}:${auth?.user?.role ?? 'guest'}`}
    />
  );
}

function AssistantSession() {
  const auth = useOptionalAuth();
  const customer = auth?.user?.role === 'CUSTOMER';
  const account = auth?.user?.id ?? 'guest';
  const conversationKey = `emukey-ai-conversation:${account}`;
  const guestKey = `emukey-ai-guest-session:${account}`;
  const [guest, setGuest] = useState(() => restoreGuest(guestKey));
  const [conversationId, setConversationId] = useState<string | undefined>(
    () => (customer ? (readStorage(conversationKey) ?? undefined) : undefined),
  );
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [failed, setFailed] = useState<FailedIntent>();
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [busy, setBusy] = useState(false);
  // Synchronous guard: state updates alone cannot lock same-tick submissions.
  // https://react.dev/reference/react/useRef#referencing-a-value-with-a-ref
  const lock = useRef(false);
  const active = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<ComponentRef<typeof FloatButton>>(null);
  const messageArea = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const create = useCreateConversation();
  const askCustomer = useAskAi();
  const askPublic = useAskPublicAi();
  const support = useRequestSupport();
  const conversation = useConversation(customer ? conversationId : undefined);
  const history = useConversationMessages(
    customer ? conversationId : undefined,
  );
  const handed =
    handedOff ||
    Boolean(conversation.data && conversation.data.status !== 'AI_ACTIVE');
  const historyFailed = customer && (history.isError || conversation.isError);
  const restoring =
    customer &&
    Boolean(conversationId) &&
    (history.isPending || conversation.isPending);
  const serverMessages = [...(history.data ?? [])].sort(
    (a, b) => a.serverSequence - b.serverSequence,
  );
  const messages = customer
    ? [
        ...serverMessages,
        ...localMessages.filter(
          (message) => !isPersisted(message, serverMessages),
        ),
      ]
    : guest.messages;
  const lastAi = [...messages]
    .reverse()
    .find((message) => message.senderType === 'AI');
  const canSupport =
    lastAi?.outcome &&
    ['SUPPORT_REQUIRED', 'NO_SOURCES', 'PROVIDER_UNAVAILABLE'].includes(
      lastAi.outcome,
    );

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (open && !busy) input.current?.focus();
  }, [open, busy]);
  useEffect(() => {
    const area = messageArea.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [messages.length, busy, open]);
  useEffect(() => {
    if (!open || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const resize = () => {
      document
        .getElementById(panelId)
        ?.style.setProperty('--emu-ai-viewport', `${viewport.height}px`);
      document
        .getElementById(panelId)
        ?.style.setProperty('--emu-ai-top', `${viewport.offsetTop}px`);
    };
    resize();
    viewport.addEventListener('resize', resize);
    viewport.addEventListener('scroll', resize);
    return () => {
      viewport.removeEventListener('resize', resize);
      viewport.removeEventListener('scroll', resize);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    launcher.current?.focus();
  };
  const newChat = () => {
    if (lock.current) return;
    store(customer ? conversationKey : guestKey);
    setConversationId(undefined);
    setGuest({ messages: [] });
    setLocalMessages([]);
    setFailed(undefined);
    setError('');
    setBlocked(false);
    setHandedOff(false);
    setQuestion('');
    input.current?.focus();
  };
  const submit = async (retry?: FailedIntent) => {
    const text = (retry?.question ?? question).trim();
    if (
      !text ||
      text.length > 4000 ||
      lock.current ||
      handed ||
      blocked ||
      restoring ||
      historyFailed ||
      auth?.loading
    )
      return;
    lock.current = true;
    setBusy(true);
    setError('');
    const intent =
      retry ??
      (failed?.question === text
        ? failed
        : { question: text, id: crypto.randomUUID() });
    const userMessage: ChatMessage = {
      id: intent.id,
      clientMessageId: intent.id,
      senderType: 'CUSTOMER',
      content: text,
    };
    const appendUser = (current: ChatMessage[]) =>
      current.some((message) => message.clientMessageId === intent.id)
        ? current
        : [...current, userMessage];
    if (customer) setLocalMessages(appendUser);
    else
      setGuest((current) => ({
        ...current,
        messages: appendUser(current.messages),
      }));
    try {
      let result;
      if (customer) {
        const id =
          conversationId ??
          (
            await create.mutateAsync({
              contextType: 'GENERAL',
              title: 'Hỏi trợ lý AI',
            })
          ).id;
        if (!active.current) return;
        setConversationId(id);
        store(conversationKey, id);
        result = await askCustomer.mutateAsync({
          conversationId: id,
          question: text,
          clientMessageId: intent.id,
        });
      } else {
        result = await askPublic.mutateAsync({
          question: text,
          clientMessageId: intent.id,
          ...(guest.sessionId ? { sessionId: guest.sessionId } : {}),
        });
      }
      if (!active.current) return;
      const response: ChatMessage = {
        ...result,
        id: `${intent.id}:ai`,
        clientMessageId: intent.id,
        senderType: 'AI',
        content: result.answer,
      };
      if (customer) setLocalMessages((current) => [...current, response]);
      else {
        const sessionId =
          'sessionId' in result &&
          typeof result.sessionId === 'string' &&
          uuid.test(result.sessionId)
            ? result.sessionId
            : guest.sessionId;
        setGuest((current) => {
          const next = {
            sessionId,
            messages: [
              ...current.messages.filter(
                (message) => message.id !== response.id,
              ),
              response,
            ].slice(-40),
          };
          if (sessionId) store(guestKey, JSON.stringify(next));
          return next;
        });
      }
      if (!customer && result.outcome === 'PROVIDER_UNAVAILABLE') {
        setQuestion(text);
        setFailed(intent);
        setError('Dịch vụ AI tạm thời không khả dụng. Bạn có thể thử gửi lại.');
      } else {
        setQuestion('');
        setFailed(undefined);
      }
    } catch (cause) {
      if (!active.current) return;
      const status = Number((cause as ApiRequestError)?.status);
      const code = (cause as ApiRequestError)?.code;
      setFailed(intent);
      setBlocked(false);
      if (code === 'AI_REQUEST_IN_PROGRESS') {
        setError(
          'Yêu cầu AI đang được xử lý. Vui lòng chờ một chút rồi thử gửi lại.',
        );
      } else if (code === 'AI_SOURCES_CHANGED') {
        // This intent can no longer be replayed against its original sources.
        setFailed(undefined);
        setQuestion(text);
        setError(
          'Nguồn tham khảo đã thay đổi. Vui lòng gửi lại câu hỏi để nhận câu trả lời mới.',
        );
        if (!customer)
          setGuest((current) => {
            const next = {
              ...current,
              messages: current.messages.filter(
                (message) => message.id !== `${intent.id}:ai`,
              ),
            };
            if (next.sessionId) store(guestKey, JSON.stringify(next));
            return next;
          });
      } else if (
        [401, 403, 404].includes(status) ||
        [
          'CONVERSATION_STATE_INVALID',
          'CONVERSATION_CLOSED',
          'CONVERSATION_ACCESS_DENIED',
          'CONVERSATION_NOT_FOUND',
        ].includes(code ?? '')
      ) {
        setBlocked(true);
        setError(
          status === 401
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : status === 403
              ? 'Bạn không có quyền truy cập hội thoại này.'
              : status === 404
                ? 'Phiên hội thoại không còn khả dụng hoặc đã hết hạn. Hãy bắt đầu hội thoại mới.'
                : 'Hội thoại đã kết thúc hoặc chuyển sang hỗ trợ.',
        );
      } else
        setError(
          status === 429
            ? 'Bạn gửi quá nhiều yêu cầu. Vui lòng chờ một chút rồi thử lại.'
            : status === 409
              ? 'Yêu cầu AI chưa thể hoàn tất. Vui lòng thử gửi lại.'
              : status === 400
                ? 'Câu hỏi chưa hợp lệ. Vui lòng chỉnh sửa và gửi lại.'
                : status >= 500
                  ? 'Dịch vụ AI tạm thời không khả dụng. Bạn có thể thử gửi lại.'
                  : 'Không thể kết nối. Kiểm tra mạng và thử gửi lại.',
        );
    } finally {
      lock.current = false;
      if (active.current) {
        setBusy(false);
        input.current?.focus();
      }
    }
  };
  const requestSupport = async () => {
    if (!conversationId || !canSupport || handed || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await support.mutateAsync({
        conversationId,
        reason: 'Khách hàng yêu cầu nhân viên hỗ trợ sau tư vấn AI.',
      });
      if (active.current) setHandedOff(true);
    } catch {
      if (active.current)
        setError('Chưa thể chuyển sang nhân viên hỗ trợ. Vui lòng thử lại.');
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  };

  return (
    <>
      <FloatButton
        ref={launcher}
        className="ai-assistant-launcher"
        aria-label="Mở trợ lý AI"
        aria-controls={panelId}
        aria-expanded={open}
        icon={<CustomerServiceOutlined />}
        type="primary"
        onClick={() => (open ? close() : setOpen(true))}
      />
      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby="emu-ai-title"
          className="emu-ai-panel"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <header className="emu-ai-header">
            <div>
              <h2 id="emu-ai-title">Trợ lý AI EmuKey</h2>
              <p>Tư vấn sản phẩm và hướng dẫn sử dụng</p>
            </div>
            <Button
              aria-label="Hội thoại mới"
              title="Hội thoại mới"
              type="text"
              icon={<PlusOutlined />}
              disabled={busy}
              onClick={newChat}
            />
            <Button
              aria-label="Đóng trợ lý AI"
              type="text"
              icon={<CloseOutlined />}
              onClick={close}
            />
          </header>
          <div
            className="emu-ai-messages"
            ref={messageArea}
            role="log"
            aria-label="Tin nhắn hội thoại"
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={busy || restoring}
          >
            {!messages.length && !restoring ? (
              <div className="emu-ai-welcome">
                <CustomerServiceOutlined aria-hidden="true" />
                <h3>Tôi có thể giúp gì cho bạn?</h3>
                <p>
                  Hỏi về sản phẩm, so sánh gói bản quyền hoặc tìm hướng dẫn sử
                  dụng từ nguồn đã xác thực.
                </p>
                <Link to="/products">Khám phá sản phẩm</Link>
              </div>
            ) : null}
            {restoring ? <p role="status">Đang khôi phục hội thoại…</p> : null}
            {messages.map((message) => (
              <MessageBubble
                key={`${message.id}:${message.senderType}`}
                message={message}
              />
            ))}
            {busy ? (
              <p className="emu-ai-working" role="status">
                {support.isPending
                  ? 'Đang chuyển yêu cầu hỗ trợ…'
                  : 'Trợ lý đang xử lý…'}
              </p>
            ) : null}
          </div>
          <footer className="emu-ai-footer">
            {historyFailed ? (
              <div role="alert">
                <p>
                  Không thể khôi phục hội thoại. Vui lòng tải lại lịch sử hoặc
                  bắt đầu hội thoại mới.
                </p>
                <Button
                  onClick={() => {
                    void history.refetch();
                    void conversation.refetch();
                  }}
                >
                  Tải lại lịch sử
                </Button>
              </div>
            ) : null}
            {error ? (
              <div role="alert" className="emu-ai-error">
                <p>{error}</p>
                {failed && !blocked ? (
                  <Button disabled={busy} onClick={() => void submit(failed)}>
                    Thử gửi lại
                  </Button>
                ) : null}
                {blocked ? (
                  <Button disabled={busy} onClick={newChat}>
                    Bắt đầu hội thoại mới
                  </Button>
                ) : null}
              </div>
            ) : null}
            {handed ? (
              <div className="emu-ai-handoff" role="status">
                <p>
                  {conversation.data?.status === 'CLOSED'
                    ? 'Hội thoại đã hoàn tất.'
                    : 'Đã chuyển sang nhân viên hỗ trợ.'}
                </p>
                <Link
                  to={`/buyer/support?conversationId=${encodeURIComponent(conversationId!)}`}
                >
                  Mở hội thoại hỗ trợ
                </Link>
              </div>
            ) : canSupport ? (
              <div className="emu-ai-support">
                {customer ? (
                  <Button
                    disabled={busy || blocked}
                    onClick={() => void requestSupport()}
                  >
                    Liên hệ nhân viên hỗ trợ
                  </Button>
                ) : (
                  <Link to="/auth">Liên hệ nhân viên hỗ trợ</Link>
                )}
              </div>
            ) : null}
            <form
              className="emu-ai-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <label htmlFor="emu-ai-question">Câu hỏi cho trợ lý AI</label>
              <div>
                <textarea
                  id="emu-ai-question"
                  ref={input}
                  rows={2}
                  maxLength={4000}
                  placeholder="Nhập câu hỏi của bạn…"
                  value={question}
                  disabled={
                    busy ||
                    handed ||
                    blocked ||
                    restoring ||
                    historyFailed ||
                    auth?.loading
                  }
                  onChange={(event) => {
                    setQuestion(event.target.value);
                    if (failed && event.target.value.trim() !== failed.question)
                      setFailed(undefined);
                  }}
                  onCompositionStart={() => {
                    composing.current = true;
                  }}
                  onCompositionEnd={() => {
                    composing.current = false;
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !composing.current &&
                      !event.nativeEvent.isComposing &&
                      event.keyCode !== 229
                    ) {
                      event.preventDefault();
                      void submit();
                    }
                  }}
                />
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  aria-label="Gửi câu hỏi"
                  loading={busy}
                  disabled={
                    !question.trim() ||
                    busy ||
                    handed ||
                    blocked ||
                    restoring ||
                    historyFailed ||
                    Boolean(auth?.loading)
                  }
                />
              </div>
              <small>Enter để gửi · Shift+Enter để xuống dòng</small>
            </form>
          </footer>
        </section>
      ) : null}
    </>
  );
}
