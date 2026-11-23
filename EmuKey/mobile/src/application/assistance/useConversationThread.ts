import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  appendConversationMessage,
  askConversationAi,
  closeConversation,
  getConversation,
  listConversationMessages,
  MobileApiError,
  requestConversationSupport,
  type MobileConversation,
  type MobileConversationMessage,
} from '../../infrastructure/api/client';

const POLL_INTERVAL_MS = 5_000;

function mergeSortedMessages(
  incoming: readonly MobileConversationMessage[],
): MobileConversationMessage[] {
  const byKey = new Map<string, MobileConversationMessage>();
  for (const msg of incoming) {
    const dedupKey = msg.id || `${msg.senderType}:${msg.clientMessageId}`;
    byKey.set(dedupKey, msg);
  }
  return [...byKey.values()].sort((a, b) => a.serverSequence - b.serverSequence);
}

export function useConversationThread(conversationId: string | undefined) {
  const [conversation, setConversation] = useState<MobileConversation | null>(null);
  const [messages, setMessages] = useState<MobileConversationMessage[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  const requestGenerationRef = useRef(0);
  const nextLoadRef = useRef(0);
  const appliedLoadRef = useRef(0);
  const loadedGenerationRef = useRef<number | null>(null);
  const outgoingIdsRef = useRef<Record<string, { body: string; id: string }>>({});
  const sendLockRef = useRef(false);

  const activeId = conversation?.id ?? conversationId;
  const draft = activeId ? drafts[activeId] ?? '' : '';

  const setDraft = useCallback(
    (value: string) => {
      if (!activeId) return;
      setDrafts((current) => ({ ...current, [activeId]: value }));
    },
    [activeId],
  );

  const loadThread = useCallback(
    async (targetId: string, gen: number, isInitial = false) => {
      if (gen !== requestGenerationRef.current) return;
      const load = ++nextLoadRef.current;
      const canApply = () =>
        gen === requestGenerationRef.current && load > appliedLoadRef.current;
      if (isInitial) setLoading(true);
      try {
        const [conv, msgs] = await Promise.all([
          getConversation(targetId),
          listConversationMessages(targetId),
        ]);
        if (!canApply()) return;
        appliedLoadRef.current = load;
        loadedGenerationRef.current = gen;
        setConversation(conv);
        setMessages(mergeSortedMessages(msgs));
        setError(null);
        setSyncWarning(null);
      } catch {
        if (!canApply()) return;
        appliedLoadRef.current = load;
        if (loadedGenerationRef.current !== gen) {
          setError('Không thể tải nội dung hội thoại.');
        } else {
          setSyncWarning('Mất kết nối tạm thời — đang tự động kết nối lại.');
        }
      } finally {
        if (gen === requestGenerationRef.current && load === appliedLoadRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const gen = ++requestGenerationRef.current;
    setConversation(null);
    setMessages([]);
    setError(null);
    setSyncWarning(null);
    if (!conversationId) {
      setLoading(false);
      return;
    }
    void loadThread(conversationId, gen, true);
    return () => {
      requestGenerationRef.current += 1;
    };
  }, [conversationId, loadThread]);

  useEffect(() => {
    if (!conversationId || conversation?.status === 'CLOSED') return;
    const gen = requestGenerationRef.current;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'background') {
        void loadThread(conversationId, gen, false);
      }
    }, POLL_INTERVAL_MS);
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadThread(conversationId, gen, false);
    });
    return () => {
      clearInterval(timer);
      appSub?.remove?.();
    };
  }, [conversation?.status, conversationId, loadThread]);

  const sendMessage = useCallback(async (): Promise<boolean> => {
    const target = conversation;
    const content = draft.trim();
    if (
      !target ||
      !content ||
      content.length > 8000 ||
      target.status === 'CLOSED' ||
      target.status === 'AI_ACTIVE' ||
      sendLockRef.current
    ) {
      return false;
    }
    const gen = requestGenerationRef.current;
    const prevOutgoing = outgoingIdsRef.current[target.id];
    const clientMessageId =
      prevOutgoing?.body === content ? prevOutgoing.id : Crypto.randomUUID();
    outgoingIdsRef.current[target.id] = { body: content, id: clientMessageId };

    sendLockRef.current = true;
    setSending(true);
    setError(null);
    try {
      await appendConversationMessage(target.id, clientMessageId, content);
      delete outgoingIdsRef.current[target.id];
      setDrafts((current) => ({ ...current, [target.id]: '' }));
      await loadThread(target.id, gen, false);
      return true;
    } catch {
      if (gen === requestGenerationRef.current) {
        setError('Không thể gửi tin nhắn. Nội dung được giữ lại để thử lại.');
      }
      return false;
    } finally {
      sendLockRef.current = false;
      if (gen === requestGenerationRef.current) setSending(false);
    }
  }, [conversation, draft, loadThread]);

  const askAi = useCallback(
    async (explicitQuestion?: string): Promise<boolean> => {
      const target = conversation;
      const question = (explicitQuestion ?? draft).trim();
      if (
        !target ||
        !question ||
        question.length > 4000 ||
        target.status !== 'AI_ACTIVE' ||
        sendLockRef.current
      ) {
        return false;
      }
      const gen = requestGenerationRef.current;
      const prevOutgoing = outgoingIdsRef.current[target.id];
      const clientMessageId =
        prevOutgoing?.body === question ? prevOutgoing.id : Crypto.randomUUID();
      outgoingIdsRef.current[target.id] = { body: question, id: clientMessageId };

      sendLockRef.current = true;
      setSending(true);
      setError(null);
      try {
        await askConversationAi(target.id, question, clientMessageId);
        delete outgoingIdsRef.current[target.id];
        if (!explicitQuestion) {
          setDrafts((current) => ({ ...current, [target.id]: '' }));
        }
        await loadThread(target.id, gen, false);
        return true;
      } catch (cause) {
        if (gen === requestGenerationRef.current) {
          if (cause instanceof MobileApiError && cause.code === 'AI_REQUEST_IN_PROGRESS') {
            setError('Yêu cầu AI đang được xử lý. Vui lòng chờ rồi thử lại.');
          } else {
            setError(
              'Không thể hỏi AI lúc này. Bạn có thể thử gửi lại hoặc chuyển cho nhân viên.',
            );
          }
        }
        return false;
      } finally {
        sendLockRef.current = false;
        if (gen === requestGenerationRef.current) setSending(false);
      }
    },
    [conversation, draft, loadThread],
  );

  const escalateToSupport = useCallback(
    async (reason = 'Khách hàng yêu cầu nhân viên hỗ trợ.'): Promise<boolean> => {
      const target = conversation;
      if (!target || target.status !== 'AI_ACTIVE' || escalating) return false;
      const gen = requestGenerationRef.current;
      setEscalating(true);
      setError(null);
      try {
        const updated = await requestConversationSupport(target.id, reason);
        if (gen !== requestGenerationRef.current) return false;
        setConversation(updated);
        await loadThread(target.id, gen, false);
        return true;
      } catch {
        if (gen === requestGenerationRef.current) {
          setError('Chưa chuyển được sang nhân viên hỗ trợ. Vui lòng thử lại.');
        }
        return false;
      } finally {
        if (gen === requestGenerationRef.current) setEscalating(false);
      }
    },
    [conversation, escalating, loadThread],
  );

  const closeThread = useCallback(async (): Promise<boolean> => {
    const target = conversation;
    if (!target || target.status === 'CLOSED' || closing) return false;
    const gen = requestGenerationRef.current;
    setClosing(true);
    setError(null);
    try {
      const closed = await closeConversation(target.id);
      if (gen !== requestGenerationRef.current) return false;
      setConversation(closed);
      return true;
    } catch {
      if (gen === requestGenerationRef.current) {
        setError('Không thể đóng hội thoại.');
      }
      return false;
    } finally {
      if (gen === requestGenerationRef.current) setClosing(false);
    }
  }, [closing, conversation]);

  return {
    conversation,
    messages,
    draft,
    setDraft,
    loading,
    sending,
    closing,
    escalating,
    error,
    syncWarning,
    reload: () => {
      if (!conversationId) return Promise.resolve();
      return loadThread(conversationId, requestGenerationRef.current, !conversation);
    },
    sendMessage,
    askAi,
    escalateToSupport,
    closeThread,
  };
}
