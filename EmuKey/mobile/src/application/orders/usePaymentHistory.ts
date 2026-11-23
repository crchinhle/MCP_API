import { useCallback, useEffect, useRef, useState } from 'react';

import { listPaymentHistory } from '../../infrastructure/api/client';
import type { PaymentHistoryDto } from '../../infrastructure/api/generated';
import { useCustomerSession } from '../auth/useCustomerSession';
import { describeRequestError } from '../requestError';

export function usePaymentHistory() {
  const { user } = useCustomerSession();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<PaymentHistoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const load = useCallback(
    async (isRefresh = false) => {
      const gen = ++generationRef.current;
      if (!userId) {
        hasLoadedRef.current = false;
        setItems([]);
        setError(null);
        setRefreshError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
        setRefreshError(null);
      } else {
        setLoading(true);
        setError(null);
        setRefreshError(null);
      }

      try {
        const rows = await listPaymentHistory();
        if (gen !== generationRef.current) return;
        hasLoadedRef.current = true;
        setItems(rows);
        setError(null);
        setRefreshError(null);
      } catch (cause) {
        if (gen !== generationRef.current) return;
        const message = describeRequestError(
          cause,
          'Không thể tải lịch sử thanh toán.',
        );
        if (isRefresh && hasLoadedRef.current) {
          setRefreshError(message);
        } else {
          setError(message);
        }
      } finally {
        if (gen === generationRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    hasLoadedRef.current = false;
    setItems([]);
    setError(null);
    setRefreshError(null);
    void load(false);
  }, [load]);

  return {
    items,
    loading,
    refreshing,
    error,
    refreshError,
    reload: () => load(false),
    refresh: () => load(true),
  };
}
