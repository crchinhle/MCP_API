import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '../auth/authContext';
import type { ConversationDto, MessageDto } from './assistanceQueries';

export function useSupportQueue(resolved = false) {
  return useQuery({
    queryKey: ['assistance', 'support-queue', resolved],
    queryFn: () => requestJson<ConversationDto[]>(resolved ? '/conversations' : '/conversations/queue'),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}

export function useRequestSupport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, reason }: { conversationId: string; reason: string }) => requestJson<ConversationDto>(`/conversations/${encodeURIComponent(conversationId)}/request-support`, { body: JSON.stringify({ reason }), method: 'POST' }),
    onSuccess: (_conversation, input) => {
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'support-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'conversation', input.conversationId] });
    },
  });
}

export function useClaimConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => requestJson<ConversationDto>(`/conversations/${encodeURIComponent(conversationId)}/claim`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assistance'] });
    },
  });
}

export function useSupportConversationMessages(conversationId: string | undefined, preview = false) {
  return useQuery({
    enabled: Boolean(conversationId),
    queryKey: ['assistance', preview ? 'queue-preview' : 'messages', conversationId],
    queryFn: () => requestJson<MessageDto[]>(`/conversations/${encodeURIComponent(conversationId!)}/messages${preview ? '/queue-preview' : ''}`),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

export function useReleaseSupportConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      requestJson<ConversationDto>(`/conversations/${encodeURIComponent(conversationId)}/release`, { method: 'POST' }),
    onSuccess: (_conversation, conversationId) => {
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'support-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'messages', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'queue-preview', conversationId] });
    },
  });
}

export function useAppendSupportMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, clientMessageId, content }: { conversationId: string; clientMessageId: string; content: string }) =>
      requestJson<MessageDto>(`/conversations/${conversationId}/messages`, {
        body: JSON.stringify({ clientMessageId, content }),
        method: 'POST',
      }),
    onSuccess: (_message, input) => {
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'messages', input.conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'support-queue'] });
    },
  });
}

export function useCloseSupportConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      requestJson<ConversationDto>(`/conversations/${conversationId}/close`, { method: 'POST' }),
    onSuccess: (_conversation, conversationId) => {
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'support-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'messages', conversationId] });
    },
  });
}
