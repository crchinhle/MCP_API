import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getPublicKnowledgeDocument,
  listPublicKnowledgeDocuments,
} from '../../infrastructure/api/client';
import type {
  PublicKnowledgeDetailDto,
  PublicKnowledgeListResponseDto,
} from '../../infrastructure/api/generated';

export function usePublicKnowledgeList(params: {
  search?: string;
  tag?: string;
  productId?: string;
  page?: number;
  limit?: number;
}) {
  const [data, setData] = useState<PublicKnowledgeListResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const { search, tag, productId, page = 1, limit = 10 } = params;

  const load = useCallback(
    async (isRefresh = false) => {
      const gen = ++generationRef.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await listPublicKnowledgeDocuments({
          search,
          tag,
          productId,
          page,
          limit,
        });
        if (gen !== generationRef.current) return;
        setData(result);
      } catch {
        if (gen !== generationRef.current) return;
        setError('Không thể kết nối máy chủ để tải tài liệu hướng dẫn.');
      } finally {
        if (gen === generationRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [limit, page, productId, search, tag],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return {
    data,
    loading,
    refreshing,
    error,
    reload: () => load(false),
    refresh: () => load(true),
  };
}

export function usePublicKnowledgeDetail(documentId: string | undefined) {
  const [document, setDocument] = useState<PublicKnowledgeDetailDto | null>(null);
  const [loading, setLoading] = useState(Boolean(documentId));
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    if (!documentId) {
      setDocument(null);
      setLoading(false);
      return;
    }
    const gen = ++generationRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getPublicKnowledgeDocument(documentId);
      if (gen !== generationRef.current) return;
      setDocument(result);
    } catch {
      if (gen !== generationRef.current) return;
      setError('Không tìm thấy tài liệu hướng dẫn này hoặc tài liệu chưa được công bố.');
    } finally {
      if (gen === generationRef.current) setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    document,
    loading,
    error,
    reload: load,
  };
}
