import { Alert, Button, Input } from 'antd';
import { useState } from 'react';

import type { ConversationMessage } from '../../domain/workspace';

interface ConversationPanelProps {
  readonly initialMessages: readonly ConversationMessage[];
  readonly inputLabel: string;
  readonly submitLabel: string;
  readonly author: ConversationMessage['author'];
  readonly suggestion?: string;
  readonly onSubmit?: (content: string) => Promise<unknown>;
  readonly onAskAi?: (question: string) => Promise<unknown>;
  readonly readOnly?: boolean;
}

export function ConversationPanel({
  initialMessages,
  inputLabel,
  submitLabel,
  suggestion,
  onSubmit,
  onAskAi,
  readOnly = false,
}: ConversationPanelProps) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const sendMessage = async (askAi = false) => {
    const body = draft.trim();
    if (!body || pending) return;
    setPending(true);
    setError('');
    try {
      if (askAi) await onAskAi?.(body);
      else await onSubmit?.(body);
      setDraft('');
    } catch {
      setError('Chưa gửi được yêu cầu. Nội dung được giữ lại để bạn thử lại.');
    } finally { setPending(false); }
  };

  return (
    <section className="conversation-panel" aria-label="Nội dung hội thoại">
      <div className="message-list" aria-live="polite">
        {initialMessages.map((message) => (
          <article
            className={`message message--${message.author.toLowerCase()}`}
            key={message.id}
          >
            <small>{message.author === 'Buyer' ? 'Người mua' : message.author === 'Support' ? 'Nhân viên hỗ trợ' : 'Trợ lý AI'}</small>
            <p>{message.body}</p>
          </article>
        ))}
      </div>
      {error ? <Alert type="error" title={error} /> : null}
      {readOnly ? (
        <p className="muted-copy">Hội thoại đã hoàn tất. Không thể gửi thêm tin nhắn ở trạng thái này.</p>
      ) : <label className="message-composer">
        <span>{inputLabel}</span>
        <Input.TextArea
          aria-label={inputLabel}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          disabled={pending}
          value={draft}
        />
        <span className="composer-actions">
          {suggestion ? (
            <Button onClick={() => setDraft(suggestion)}>Chèn gợi ý AI</Button>
          ) : null}
          {onAskAi ? <Button disabled={!draft.trim() || pending} onClick={() => void sendMessage(true)}>Hỏi AI có nguồn</Button> : null}
          <Button disabled={!draft.trim() || !onSubmit} loading={pending} onClick={() => void sendMessage()} type="primary">
            {submitLabel}
          </Button>
        </span>
      </label>}
    </section>
  );
}
