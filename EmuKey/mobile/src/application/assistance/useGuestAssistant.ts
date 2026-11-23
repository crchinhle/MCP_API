import * as Crypto from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';

import {
  askPublicAi,
  MobileApiError,
  type MobileConversationMessage,
} from '../../infrastructure/api/client';

export function useGuestAssistant() {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<MobileConversationMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const failedIntentRef = useRef<{ question: string; id: string } | undefined>(undefined);
  const lockRef = useRef(false);

  const ask = useCallback(
    async (explicitQuestion?: string): Promise<boolean> => {
      const question = (explicitQuestion ?? draft).trim();
      if (!question || question.length > 4000 || lockRef.current) return false;

      const intent =
        failedIntentRef.current?.question === question
          ? failedIntentRef.current
          : { question, id: Crypto.randomUUID() };
      failedIntentRef.current = intent;

      const userMessage: MobileConversationMessage = {
        id: intent.id,
        conversationId: sessionId ?? 'guest',
        clientMessageId: intent.id,
        serverSequence: messages.length + 1,
        senderType: 'CUSTOMER',
        content: question,
      };

      setMessages((current) =>
        current.some((item) => item.clientMessageId === intent.id)
          ? current
          : [...current, userMessage],
      );

      lockRef.current = true;
      setPending(true);
      setError(null);
      try {
        const result = await askPublicAi({
          question,
          clientMessageId: intent.id,
          ...(sessionId ? { sessionId } : {}),
        });
        if (result.sessionId) setSessionId(result.sessionId);
        const aiMessage: MobileConversationMessage = {
          id: `${intent.id}:ai`,
          conversationId: result.sessionId || sessionId || 'guest',
          clientMessageId: intent.id,
          serverSequence: messages.length + 2,
          senderType: 'AI',
          content: result.answer,
          grounded: result.grounded,
          citationDetails: result.citationDetails,
          ...(result.intent ? { intent: result.intent } : {}),
          ...(result.outcome ? { outcome: result.outcome } : {}),
          ...(result.catalogSources ? { catalogSources: result.catalogSources } : {}),
          ...(result.recommendations ? { recommendations: result.recommendations } : {}),
        };
        setMessages((current) => [
          ...current.filter((item) => item.id !== aiMessage.id),
          aiMessage,
        ]);
        if (result.outcome === 'PROVIDER_UNAVAILABLE') {
          setError('Dịch vụ AI tạm thời không khả dụng. Bạn có thể thử gửi lại.');
        } else {
          failedIntentRef.current = undefined;
          if (!explicitQuestion) setDraft('');
        }
        return true;
      } catch (cause) {
        if (cause instanceof MobileApiError && cause.status === 429) {
          setError('Bạn gửi quá nhiều yêu cầu. Vui lòng chờ một chút rồi thử lại.');
        } else {
          setError('Không thể hỏi trợ lý AI lúc này. Vui lòng thử lại.');
        }
        return false;
      } finally {
        lockRef.current = false;
        setPending(false);
      }
    },
    [draft, messages.length, sessionId],
  );

  const reset = useCallback(() => {
    setSessionId(undefined);
    setMessages([]);
    setDraft('');
    setError(null);
    failedIntentRef.current = undefined;
  }, []);

  return {
    sessionId,
    messages,
    draft,
    setDraft,
    pending,
    error,
    ask,
    reset,
  };
}
