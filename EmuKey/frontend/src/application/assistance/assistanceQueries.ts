import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { requestJson } from '../auth/authContext';

export interface ConversationDto {
  id: string;
  customerUserId: string;
  assignedSupportUserId: string | null;
  status: 'AI_ACTIVE' | 'WAITING_SUPPORT' | 'SUPPORT_ACTIVE' | 'CLOSED';
  contextType: 'GENERAL' | 'PRODUCT' | 'PLAN' | 'ORDER' | 'LICENSE';
  contextId: string | null;
  title: string | null;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  clientMessageId: string;
  serverSequence: number;
  senderType: 'CUSTOMER' | 'SUPPORT' | 'AI' | 'SYSTEM';
  content: string;
}

export const conversationStatusLabels: Record<ConversationDto['status'], string> = {
  AI_ACTIVE: 'Trợ lý AI đang hỗ trợ',
  WAITING_SUPPORT: 'Chờ nhân viên hỗ trợ',
  SUPPORT_ACTIVE: 'Nhân viên đang xử lý',
  CLOSED: 'Đã hoàn tất',
};

export const conversationContextLabels: Record<ConversationDto['contextType'], string> = {
  GENERAL: 'Hỗ trợ chung', PRODUCT: 'Sản phẩm', PLAN: 'Gói bản quyền', ORDER: 'Đơn hàng', LICENSE: 'Bản quyền',
};

export function useConversations() {
  return useQuery({
    queryKey: ['assistance', 'conversations'],
    queryFn: () => requestJson<ConversationDto[]>('/conversations'),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title?: string; contextType?: ConversationDto['contextType']; contextId?: string }) =>
      requestJson<ConversationDto>('/conversations', {
        body: JSON.stringify(input),
        method: 'POST',
      }),
    onSuccess: (created) => {
      queryClient.setQueryData<ConversationDto[]>(['assistance', 'conversations'], (current = []) =>
        [...current.filter((item) => item.id !== created.id), created],
      );
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'conversations'] });
    },
  });
}

export function useConversation(conversationId: string | undefined) {
  return useQuery({ enabled: Boolean(conversationId), queryKey: ['assistance', 'conversation', conversationId], queryFn: () => requestJson<ConversationDto>(`/conversations/${conversationId}`) });
}

export function useConversationMessages(conversationId: string | undefined) {
  return useQuery({
    enabled: Boolean(conversationId),
    queryKey: ['assistance', 'messages', conversationId],
    queryFn: () => requestJson<MessageDto[]>(`/conversations/${encodeURIComponent(conversationId!)}/messages`),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

export function useAppendConversationMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, clientMessageId, content }: { conversationId: string; clientMessageId: string; content: string }) => requestJson<MessageDto>(`/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ clientMessageId, content }) }),
    onSuccess: (_message, input) => {
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'conversation', input.conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'messages', input.conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'conversations'] });
    },
  });
}

export function useAskAi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, question, clientMessageId }: { conversationId: string; question: string; clientMessageId: string }) => requestJson<{ answer: string; citedSourceIds: string[]; grounded: boolean }>(`/conversations/${encodeURIComponent(conversationId)}/ai-ask`, { method: 'POST', body: JSON.stringify({ clientMessageId, question }) }),
    onSuccess: (_answer, input) => { void queryClient.invalidateQueries({ queryKey: ['assistance', 'conversation', input.conversationId] }); void queryClient.invalidateQueries({ queryKey: ['assistance', 'messages', input.conversationId] }); },
  });
}
