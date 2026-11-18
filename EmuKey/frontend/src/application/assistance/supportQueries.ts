import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestJson, useOptionalAuth } from '../auth/authContext';
import { useConversationMessages, type ConversationDto, type MessageDto } from './assistanceQueries';

export function useSupportQueue(resolved = false) {
  const account = useOptionalAuth()?.user?.id;
  return useQuery({
    queryKey: ['assistance', 'support-queue', resolved, account],
    queryFn: () => requestJson<ConversationDto[]>(resolved ? '/conversations' : '/conversations/queue'),
    refetchInterval: 3_000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
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
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'messages', input.conversationId] });
    },
  });
}

export function useClaimConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => requestJson<ConversationDto>(`/conversations/${encodeURIComponent(conversationId)}/claim`, { method: 'POST' }),
    onError: () => { void queryClient.invalidateQueries({ queryKey: ['assistance', 'support-queue'] }); },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assistance'] });
    },
  });
}

export function useSupportConversationMessages(conversationId: string | undefined, preview = false) {
  return useConversationMessages(conversationId, preview);
}

export function useReleaseSupportConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, claimVersion }: { conversationId: string; claimVersion: number }) =>
      requestJson<ConversationDto>(`/conversations/${encodeURIComponent(conversationId)}/release`, { method: 'POST', body: JSON.stringify({ claimVersion }) }),
    onError: () => { void queryClient.invalidateQueries({ queryKey: ['assistance', 'support-queue'] }); },
    onSuccess: (_conversation, { conversationId }) => {
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'support-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'messages', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'queue-preview', conversationId] });
    },
  });
}

export function useAppendSupportMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, clientMessageId, content, claimVersion }: { conversationId: string; clientMessageId: string; content: string; claimVersion: number }) =>
      requestJson<MessageDto>(`/conversations/${conversationId}/messages`, {
        body: JSON.stringify({ clientMessageId, content, claimVersion }),
        method: 'POST',
      }),
    onError: () => { void queryClient.invalidateQueries({ queryKey: ['assistance', 'support-queue'] }); },
    onSuccess: (_message, input) => {
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'messages', input.conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'support-queue'] });
    },
  });
}

export function useCloseSupportConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, claimVersion }: { conversationId: string; claimVersion: number }) =>
      requestJson<ConversationDto>(`/conversations/${conversationId}/close`, { method: 'POST', body: JSON.stringify({ claimVersion }) }),
    onError: () => { void queryClient.invalidateQueries({ queryKey: ['assistance', 'support-queue'] }); },
    onSuccess: (_conversation, { conversationId }) => {
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'support-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['assistance', 'messages', conversationId] });
    },
  });
}
