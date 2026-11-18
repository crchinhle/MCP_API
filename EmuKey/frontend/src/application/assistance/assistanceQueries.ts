import { replaceEqualDeep, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { requestJson, useOptionalAuth } from '../auth/authContext';
import type {
  AiAnswerDto,
  CatalogSourceDto,
  CitationDetailDto,
} from '../../infrastructure/api/generated';

export type CatalogSource = CatalogSourceDto;
export type AssistantMetadata = Required<Pick<AiAnswerDto, 'catalogSources' | 'recommendations' | 'outcome' | 'intent'>>;

// Enhanced orchestration always supplies the additive metadata fields.
export type AssistantAnswer = AiAnswerDto & AssistantMetadata;

export interface ConversationDto {
  id: string;
  claimVersion?: number;
  claimExpiresAt?: string | null;
  customerUserId: string;
  assignedSupportUserId: string | null;
  status: 'AI_ACTIVE' | 'WAITING_SUPPORT' | 'SUPPORT_ACTIVE' | 'CLOSED';
  contextType: 'GENERAL' | 'PRODUCT' | 'PLAN' | 'ORDER' | 'LICENSE';
  contextId: string | null;
  title: string | null;
}

export interface MessageDto extends Partial<AssistantMetadata> {
  createdAt?: string;
  citationDetails?: CitationDetailDto[];
  id: string;
  conversationId: string;
  clientMessageId: string;
  serverSequence: number;
  senderType: 'CUSTOMER' | 'SUPPORT' | 'AI' | 'SYSTEM';
  content: string;
}

export const conversationStatusLabels: Record<
  ConversationDto['status'],
  string
> = {
  AI_ACTIVE: 'Trợ lý AI đang hỗ trợ',
  WAITING_SUPPORT: 'Chờ nhân viên hỗ trợ',
  SUPPORT_ACTIVE: 'Nhân viên đang xử lý',
  CLOSED: 'Đã hoàn tất',
};

export const conversationContextLabels: Record<
  ConversationDto['contextType'],
  string
> = {
  GENERAL: 'Hỗ trợ chung',
  PRODUCT: 'Sản phẩm',
  PLAN: 'Gói bản quyền',
  ORDER: 'Đơn hàng',
  LICENSE: 'Bản quyền',
};

export function useConversations() {
  const account = useOptionalAuth()?.user?.id;
  return useQuery({
    queryKey: ['assistance', 'conversations', account],
    queryFn: () => requestJson<ConversationDto[]>('/conversations'),
    refetchInterval: 2_000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchIntervalInBackground: false,
  });
}

export function useCreateConversation() {
  const account = useOptionalAuth()?.user?.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      mode?: 'AI' | 'SUPPORT';
      initialMessage?: string;
      clientRequestId?: string;
      title?: string;
      contextType?: ConversationDto['contextType'];
      contextId?: string;
    }) =>
      requestJson<ConversationDto>('/conversations', {
        body: JSON.stringify(input),
        method: 'POST',
      }),
    onSuccess: (created) => {
      queryClient.setQueryData<ConversationDto[]>(
        ['assistance', 'conversations', account],
        (current = []) => [
          ...current.filter((item) => item.id !== created.id),
          created,
        ],
      );
      void queryClient.invalidateQueries({
        queryKey: ['assistance', 'conversations'],
      });
    },
  });
}

export function useConversation(conversationId: string | undefined) {
  const account = useOptionalAuth()?.user?.id;
  return useQuery({
    enabled: Boolean(conversationId),
    queryKey: ['assistance', 'conversation', conversationId, account],
    queryFn: () =>
      requestJson<ConversationDto>(
        `/conversations/${encodeURIComponent(conversationId!)}`,
      ),
    refetchInterval: 2_000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchIntervalInBackground: false,
  });
}

interface MessageHistory {
  items: MessageDto[];
  hasOlder: boolean;
}

function mergeMessages(current: MessageDto[], incoming: MessageDto[]) {
  return [...new Map([...current, ...incoming].map(message => [message.id, message])).values()]
    .sort((a, b) => a.serverSequence - b.serverSequence);
}

export function useConversationMessages(conversationId: string | undefined, preview = false) {
  const account = useOptionalAuth()?.user?.id;
  const client = useQueryClient();
  const queryKey = ['assistance', preview ? 'queue-preview' : 'messages', conversationId, account] as const;
  const endpoint = `/conversations/${encodeURIComponent(conversationId!)}/messages`;
  const query = useQuery({
    enabled: Boolean(conversationId),
    queryKey,
    queryFn: async (): Promise<MessageHistory> => {
      const previous = client.getQueryData<MessageHistory>(queryKey);
      const after = previous?.items.at(-1)?.serverSequence;
      const incoming = await requestJson<MessageDto[]>(preview ? `${endpoint}/queue-preview` : `${endpoint}${after ? `?after=${after}&limit=100` : ''}`);
      if (preview) return { items: incoming, hasOlder: false };
      return { items: incoming, hasOlder: previous?.hasOlder ?? incoming.length === 50 };
    },
    // Merge at QueryClient's synchronous cache write, not before its promise
    // continuation. An older-page mutation can commit in that interval.
    structuralSharing: (oldData, newData) => {
      const current = oldData as MessageHistory | undefined;
      const incoming = newData as MessageHistory;
      return preview ? incoming : replaceEqualDeep(current, {
        items: mergeMessages(current?.items ?? [], incoming.items),
        // Reaching the beginning is monotonic, even across concurrent polls.
        hasOlder: (current?.hasOlder ?? true) && incoming.hasOlder,
      });
    },
    refetchInterval: 2_000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    refetchIntervalInBackground: false,
  });
  const older = useMutation({
    mutationFn: async () => {
      const key = queryKey;
      const first = client.getQueryData<MessageHistory>(key)?.items[0]?.serverSequence;
      const items = first && !preview ? await requestJson<MessageDto[]>(`${endpoint}?before=${first}&limit=50`) : [];
      return { key, items };
    },
    onSuccess: ({ key, items }) => client.setQueryData<MessageHistory>(key, current => ({
      items: mergeMessages(current?.items ?? [], items), hasOlder: items.length === 50,
    })),
  });
  return { ...query, data: query.data?.items, hasOlder: !preview && (query.data?.hasOlder ?? false),
    loadOlder: older.mutateAsync, isLoadingOlder: older.isPending, olderError: older.isError };
}

export function useAppendConversationMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      clientMessageId,
      content,
    }: {
      conversationId: string;
      clientMessageId: string;
      content: string;
    }) =>
      requestJson<MessageDto>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ clientMessageId, content }),
      }),
    onSuccess: (_message, input) => {
      void queryClient.invalidateQueries({
        queryKey: ['assistance', 'conversation', input.conversationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['assistance', 'messages', input.conversationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['assistance', 'conversations'],
      });
    },
  });
}

export function useAskAi() {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: ({
      conversationId,
      question,
      clientMessageId,
    }: {
      conversationId: string;
      question: string;
      clientMessageId: string;
    }) =>
      requestJson<AssistantAnswer>(
        `/conversations/${encodeURIComponent(conversationId)}/ai-ask`,
        { method: 'POST', body: JSON.stringify({ clientMessageId, question }) },
      ),
    onSuccess: (_answer, input) => {
      void queryClient.invalidateQueries({
        queryKey: ['assistance', 'conversation', input.conversationId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['assistance', 'messages', input.conversationId],
      });
    },
  });
}

export function useAskPublicAi() {
  return useMutation({
    retry: false,
    mutationFn: (input: {
      question: string;
      clientMessageId: string;
      sessionId?: string;
      sessionToken?: string;
    }) =>
      requestJson<AssistantAnswer & { sessionId: string; sessionToken: string }>(
        '/public/assistant/ask',
        { method: 'POST', body: JSON.stringify(input) },
      ),
  });
}

export function useLinkGuestHistory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: string; sessionToken: string; accepted: true }) => requestJson<ConversationDto>('/conversations/link-guest-history', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['assistance', 'conversations'] }); },
  });
}
