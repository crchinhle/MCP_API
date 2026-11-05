import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { KnowledgeCapabilitiesDto, KnowledgeDocumentDetailDto, KnowledgeDocumentDto, KnowledgeSourceDto } from '../../infrastructure/api/generated';
import { requestJson } from '../auth/authContext';

export function useKnowledgeCapabilities(enabled: boolean) {
  return useQuery({ queryKey: ['knowledge', 'capabilities'], enabled,
    queryFn: () => requestJson<KnowledgeCapabilitiesDto>('/knowledge/capabilities'), staleTime: 60_000 });
}

export function knowledgeDocumentState(document: KnowledgeDocumentDto, documents: readonly KnowledgeDocumentDto[]) {
  if (document.isCurrent) return 'PUBLISHED';
  if (documents.some((other) => other.providerUserId === document.providerUserId && other.logicalDocumentKey === document.logicalDocumentKey && other.isCurrent && other.version > document.version)) return 'PREVIOUS';
  return document.status;
}

export function useKnowledgeDocuments() {
  return useQuery({
    queryKey: ['knowledge', 'documents'],
    queryFn: () => requestJson<KnowledgeDocumentDto[]>('/knowledge/documents'),
  });
}

export function useKnowledgeDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['knowledge', 'documents', id],
    enabled: Boolean(id),
    queryFn: () => requestJson<KnowledgeDocumentDetailDto>(`/knowledge/documents/${encodeURIComponent(id!)}`),
  });
}

export function useCreateKnowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      file: File;
      productId: string;
      logicalDocumentKey: string;
      sourceType: 'PDF' | 'TXT';
      title: string;
    }) => {
      const body = new FormData();
      body.append('file', input.file);
      body.append('productId', input.productId);
      body.append('logicalDocumentKey', input.logicalDocumentKey);
      body.append('sourceType', input.sourceType);
      body.append('title', input.title);
      return requestJson<KnowledgeDocumentDto>('/knowledge/documents', { method: 'POST', body });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge', 'documents'] });
    },
  });
}

export function usePublishKnowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expectedCurrentVersion }: { id: string; expectedCurrentVersion: number }) => requestJson<KnowledgeDocumentDto>(`/knowledge/documents/${encodeURIComponent(id)}/publish`, { method: 'POST', body: JSON.stringify({ expectedCurrentVersion }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge', 'documents'] });
    },
  });
}

export function useKnowledgeSearch(question: string) {
  return useQuery({
    enabled: question.trim().length > 0,
    queryKey: ['knowledge', 'query', question],
    queryFn: () => requestJson<KnowledgeSourceDto[]>('/knowledge/query', {
      body: JSON.stringify({ question: question.trim() }),
      method: 'POST',
    }),
  });
}
