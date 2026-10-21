import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { KnowledgeDocumentDetailDto, KnowledgeDocumentDto, KnowledgeSourceDto } from '../../infrastructure/api/generated';
import { api, requestJson } from '../auth/authContext';

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
      const response = await api('/knowledge/documents', { method: 'POST', body });
      if (!response.ok) {
        throw new Error('KNOWLEDGE_UPLOAD_FAILED');
      }
      return response.json() as Promise<KnowledgeDocumentDto>;
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
