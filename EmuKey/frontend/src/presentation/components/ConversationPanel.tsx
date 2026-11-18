import { LoadingOverlay } from './WorkspacePrimitives';
import { Alert, Button, Input } from 'antd';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { ConversationMessage } from '../../domain/workspace';
import type { CatalogSourceDto, CitationDetailDto } from '../../infrastructure/api/generated';
import { KnowledgeCitations } from './KnowledgeCitations';

interface ConversationPanelProps {
  readonly initialMessages: readonly (ConversationMessage & {citationDetails?:CitationDetailDto[]; catalogSources?: CatalogSourceDto[]})[];
  readonly draftKey?: string;
  readonly inputLabel: string;
  readonly submitLabel: string;
  readonly author: ConversationMessage['author'];
  readonly suggestion?: string;
  readonly onSubmit?: (content: string, clientMessageId: string) => Promise<unknown>;
  readonly onAskAi?: (question: string, clientMessageId: string) => Promise<unknown>;
  readonly readOnly?: boolean;
  readonly readOnlyReason?: string | undefined;
  readonly hasOlder?: boolean;
  readonly loadingOlder?: boolean;
  readonly olderError?: boolean;
  readonly onLoadOlder?: () => Promise<unknown>;
}

export function ConversationPanel({
  initialMessages,
  inputLabel,
  submitLabel,
  suggestion,
  onSubmit,
  onAskAi,
  readOnly = false,
  readOnlyReason = 'Hội thoại đã hoàn tất. Không thể gửi thêm tin nhắn ở trạng thái này.',
  draftKey,
  hasOlder = false,
  loadingOlder = false,
  olderError = false,
  onLoadOlder,
}: ConversationPanelProps) {
  const [draft, setDraft] = useState(() => {
    try { return draftKey ? sessionStorage.getItem(draftKey) ?? '' : ''; } catch { return ''; }
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const draftRequest = useRef<{ askAi: boolean; body: string; id: string } | undefined>(undefined);
  const lock = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const area = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const previousLast = useRef<string | undefined>(undefined);
  const [newMessages, setNewMessages] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const anchor = useRef<{ id: string; top: number } | undefined>(undefined);
  useLayoutEffect(() => {
    if (!anchor.current || !area.current) return;
    const node = [...area.current.querySelectorAll<HTMLElement>('[data-message-id]')].find(item => item.dataset.messageId === anchor.current?.id);
    if (node) area.current.scrollTop += node.getBoundingClientRect().top - anchor.current.top;
    anchor.current = undefined;
  }, [initialMessages[0]?.id]);
  const loadOlder = async () => {
    if (!area.current || !onLoadOlder || loadingOlder) return;
    const top = area.current.getBoundingClientRect().top;
    const node = [...area.current.querySelectorAll<HTMLElement>('[data-message-id]')].find(item => item.getBoundingClientRect().bottom >= top);
    if (node?.dataset.messageId) anchor.current = { id: node.dataset.messageId, top: node.getBoundingClientRect().top };
    atBottom.current = false;
    try { await onLoadOlder(); } catch { anchor.current = undefined; }
  };
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    const last = initialMessages.at(-1)?.id;
    if (last === previousLast.current) return;
    if (area.current && atBottom.current) area.current.scrollTop = area.current.scrollHeight;
    else if (previousLast.current) setNewMessages(true);
    previousLast.current = last;
  }, [initialMessages]);
  const updateDraft = (value: string) => {
    setDraft(value);
    try { if (draftKey) { if (value) sessionStorage.setItem(draftKey, value); else sessionStorage.removeItem(draftKey); } } catch { /* Storage is optional. */ }
  };
  const sendMessage = async (askAi = false) => {
    const body = draft.trim();
    if (!body || lock.current || readOnly || !online || !(askAi ? onAskAi : onSubmit)) return;
    if (!draftRequest.current && draftKey) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(`${draftKey}:request`) ?? 'null') as unknown;
        if (saved && typeof saved === 'object' && 'askAi' in saved && 'body' in saved && 'id' in saved &&
            typeof saved.askAi === 'boolean' && typeof saved.body === 'string' && typeof saved.id === 'string') {
          draftRequest.current = { askAi: saved.askAi, body: saved.body, id: saved.id };
        }
      } catch { /* Ignore malformed storage. */ }
    }
    if (draftRequest.current?.body !== body || draftRequest.current.askAi !== askAi) {
      draftRequest.current = { askAi, body, id: crypto.randomUUID() };
    }
    const clientMessageId = draftRequest.current.id;
    try { if (draftKey) sessionStorage.setItem(`${draftKey}:request`, JSON.stringify(draftRequest.current)); } catch { /* Storage is optional. */ }
    lock.current = true;
    setPending(true);
    setError('');
    try {
      if (askAi) await onAskAi?.(body, clientMessageId);
      else await onSubmit?.(body, clientMessageId);
      // A reopened thread owns its own draft and request intent. A response
      // from the previous panel must not clear that session storage.
      if (!active.current) return;
      updateDraft('');
      draftRequest.current = undefined;
      try { if (draftKey) sessionStorage.removeItem(`${draftKey}:request`); } catch { /* Storage is optional. */ }
      atBottom.current = true;
    } catch {
      if (active.current) setError('Chưa gửi được yêu cầu. Nội dung được giữ lại để bạn thử lại.');
    } finally { lock.current = false; if (active.current) setPending(false); }
  };

  return (
    <section className="conversation-panel" aria-label="Nội dung hội thoại">
      {!online ? <Alert type="warning" title="Bạn đang ngoại tuyến. Tin nhắn nháp được giữ lại; kết nối lại để tiếp tục." /> : null}
      {hasOlder ? <Button disabled={!online || loadingOlder} loading={loadingOlder} onClick={() => void loadOlder()}>Tải tin nhắn cũ</Button> : null}
      {olderError ? <Alert type="error" title="Chưa tải được lịch sử cũ. Nội dung hiện tại được giữ lại; bạn có thể thử lại." /> : null}
      <div className="message-list" role="log" aria-label="Lịch sử tin nhắn" aria-live="polite" ref={area} onScroll={() => {
        const element = area.current;
        if (element) atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
        if (atBottom.current) setNewMessages(false);
      }}>
        {initialMessages.map((message) => (
          <article
            className={`message message--${message.author.toLowerCase()}`}
            key={message.id}
            data-message-id={message.id}
          >
            <small>{message.author === 'Buyer' ? 'Người mua' : message.author === 'Support' ? 'Nhân viên hỗ trợ' : message.author === 'System' ? 'Thông báo hệ thống' : 'Trợ lý AI'}</small>
            <p>{message.body}</p>
            {message.author==='AI'?<KnowledgeCitations citations={message.citationDetails??[]} />:null}
            {message.author === 'AI' && message.catalogSources?.length ? <nav aria-label="Nguồn sản phẩm">{message.catalogSources.map(source => <a key={source.id} href={`/products/${encodeURIComponent(source.productCode)}`}>{source.productName} — {source.planName}</a>)}</nav> : null}
            {message.createdAt ? <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</time> : null}
          </article>
        ))}
      </div>
      {newMessages ? <Button onClick={() => { if (area.current) area.current.scrollTop = area.current.scrollHeight; atBottom.current = true; setNewMessages(false); }}>Có tin nhắn mới — Xem cuối hội thoại</Button> : null}
      {error ? <Alert type="error" title={error} /> : null}
      {readOnly ? (
        <p className="muted-copy">{readOnlyReason}</p>
      ) : <label className="message-composer">
        <span>{inputLabel}</span>
        <Input.TextArea
          aria-label={inputLabel}
          onChange={(event) => updateDraft(event.target.value)}
          maxLength={onAskAi ? 4000 : 8000}
          rows={3}
          disabled={pending}
          value={draft}
        />
        <span className="composer-actions">
          {suggestion ? (
            <Button onClick={() => updateDraft(suggestion)}>Chèn gợi ý AI</Button>
          ) : null}
          {onAskAi ? <Button type="primary" disabled={!draft.trim() || pending || !online} onClick={() => void sendMessage(true)}>Hỏi AI có nguồn</Button> : null}
          {onSubmit ? <Button disabled={!draft.trim() || pending || !online} onClick={() => void sendMessage()} type="primary">
            {submitLabel}
          </Button> : null}<LoadingOverlay active={pending} label="Đang gửi tin nhắn" />
        </span>
      </label>}
    </section>
  );
}
