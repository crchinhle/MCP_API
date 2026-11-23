import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createConversation,
  listConversations,
  type MobileConversation,
} from '../../infrastructure/api/client';

export type SupportContextType = 'GENERAL' | 'PRODUCT' | 'PLAN' | 'ORDER' | 'LICENSE';

export const conversationStatusLabels: Record<MobileConversation['status'], string> = {
  AI_ACTIVE: 'Trợ lý AI đang hỗ trợ',
  WAITING_SUPPORT: 'Chờ nhân viên hỗ trợ',
  SUPPORT_ACTIVE: 'Nhân viên đang xử lý',
  CLOSED: 'Đã hoàn tất',
};

export const conversationContextLabels: Record<string, string> = {
  GENERAL: 'Hỗ trợ chung',
  PRODUCT: 'Sản phẩm',
  PLAN: 'Gói bản quyền',
  ORDER: 'Đơn hàng',
  LICENSE: 'Bản quyền',
};

export function useSupportRequests() {
  const [conversations, setConversations] = useState<MobileConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    const gen = ++generationRef.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const items = await listConversations();
      if (gen !== generationRef.current) return;
      setConversations(items);
    } catch {
      if (gen !== generationRef.current) return;
      setError('Không thể tải danh sách hội thoại hỗ trợ.');
    } finally {
      if (gen === generationRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    conversations,
    loading,
    refreshing,
    error,
    reload: () => load(false),
    refresh: () => load(true),
  };
}

export function useCreateSupportRequest() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intentRef = useRef<{ body: string; id: string } | undefined>(undefined);
  const lockRef = useRef(false);

  const submit = useCallback(
    async (input: {
      title?: string;
      description: string;
      contextType?: SupportContextType;
      contextId?: string;
    }): Promise<MobileConversation | null> => {
      const description = input.description.trim();
      if (!description || description.length > 8000 || lockRef.current) return null;

      const payload = {
        mode: 'SUPPORT' as const,
        contextType: input.contextType ?? ('GENERAL' as const),
        ...(input.contextId ? { contextId: input.contextId } : {}),
        title: input.title?.trim() || 'Yêu cầu hỗ trợ',
        initialMessage: description,
      };
      const serialized = JSON.stringify(payload);
      if (intentRef.current?.body !== serialized) {
        intentRef.current = { body: serialized, id: Crypto.randomUUID() };
      }

      lockRef.current = true;
      setPending(true);
      setError(null);
      try {
        const created = await createConversation({
          ...payload,
          clientRequestId: intentRef.current.id,
        });
        intentRef.current = undefined;
        return created;
      } catch {
        setError('Không thể tạo yêu cầu hỗ trợ. Vui lòng thử lại.');
        return null;
      } finally {
        lockRef.current = false;
        setPending(false);
      }
    },
    [],
  );

  return {
    pending,
    error,
    submit,
  };
}
