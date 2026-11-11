import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  KnowledgeCapabilitiesDto,
  KnowledgeDocumentDetailDto,
  KnowledgeDocumentDto,
  KnowledgeSourceDto,
  PublicKnowledgeDetailDto,
  PublicKnowledgeListResponseDto,
} from '../../infrastructure/api/generated';
import { requestJson } from '../auth/authContext';

export function useKnowledgeCapabilities(enabled: boolean) {
  return useQuery({
    queryKey: ['knowledge', 'capabilities'],
    enabled,
    queryFn: () => requestJson<KnowledgeCapabilitiesDto>('/knowledge/capabilities'),
    staleTime: 60_000,
  });
}

export function knowledgeDocumentState(document: KnowledgeDocumentDto, documents: readonly KnowledgeDocumentDto[]) {
  if (document.isCurrent) return 'PUBLISHED';
  if (
    documents.some(
      (other) =>
        other.providerUserId === document.providerUserId &&
        other.logicalDocumentKey === document.logicalDocumentKey &&
        other.isCurrent &&
        other.version > document.version,
    )
  )
    return 'PREVIOUS';
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
      planId?: string;
      logicalDocumentKey: string;
      sourceType: 'PDF' | 'TXT';
      title: string;
      summary?: string;
      tags?: string[];
    }) => {
      const body = new FormData();
      body.append('file', input.file);
      body.append('productId', input.productId);
      if (input.planId) body.append('planId', input.planId);
      body.append('logicalDocumentKey', input.logicalDocumentKey);
      body.append('sourceType', input.sourceType);
      body.append('title', input.title);
      if (input.summary) body.append('summary', input.summary);
      if (input.tags && input.tags.length > 0) {
        input.tags.forEach((tag) => body.append('tags', tag));
      }
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
    mutationFn: ({ id, expectedCurrentVersion }: { id: string; expectedCurrentVersion: number }) =>
      requestJson<KnowledgeDocumentDto>(`/knowledge/documents/${encodeURIComponent(id)}/publish`, {
        method: 'POST',
        body: JSON.stringify({ expectedCurrentVersion }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge', 'documents'] });
      void queryClient.invalidateQueries({ queryKey: ['knowledge', 'public'] });
    },
  });
}

export function useKnowledgeSearch(question: string) {
  return useQuery({
    enabled: question.trim().length > 0,
    queryKey: ['knowledge', 'query', question],
    queryFn: () =>
      requestJson<KnowledgeSourceDto[]>('/knowledge/query', {
        body: JSON.stringify({ question: question.trim() }),
        method: 'POST',
      }),
  });
}

// PUBLIC READ HOOKS FOR HELP CENTER
export function usePublicKnowledgeDocuments(params: {
  search?: string;
  tag?: string;
  productId?: string;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.search && params.search.trim()) searchParams.set('search', params.search.trim());
  if (params.tag && params.tag.trim() && params.tag.trim() !== 'Tất cả') searchParams.set('tag', params.tag.trim());
  if (params.productId) searchParams.set('productId', params.productId);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  const url = `/knowledge/public/documents${qs ? `?${qs}` : ''}`;

  return useQuery({
    queryKey: ['knowledge', 'public', 'list', params],
    queryFn: () => requestJson<PublicKnowledgeListResponseDto>(url),
    staleTime: 30_000,
  });
}

export function usePublicKnowledgeDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['knowledge', 'public', 'detail', id],
    enabled: Boolean(id),
    queryFn: () => requestJson<PublicKnowledgeDetailDto>(`/knowledge/public/documents/${encodeURIComponent(id!)}`),
    staleTime: 60_000,
  });
}
