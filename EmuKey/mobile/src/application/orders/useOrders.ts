import { useCallback, useEffect, useRef, useState } from 'react';

import {
  cancelOrder as apiCancelOrder,
  getOrder,
  listLicenses,
  listOrders,
  MobileApiError,
  type MobileLicense,
  type MobileOrderDetail,
  type MobileOrderSummary,
} from '../../infrastructure/api/client';
import { describeRequestError } from '../requestError';

export function useOrders() {
  const [orders, setOrders] = useState<MobileOrderSummary[]>([]);
  const [licenses, setLicenses] = useState<MobileLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    const gen = ++generationRef.current;
    if (isRefresh) {
      setRefreshing(true);
      setRefreshError(null);
    } else {
      setLoading(true);
      setError(null);
      setRefreshError(null);
    }
    try {
      const [orderRows, licenseRows] = await Promise.all([
        listOrders(),
        listLicenses().catch(() => [] as MobileLicense[]),
      ]);
      if (gen !== generationRef.current) return;
      hasLoadedRef.current = true;
      setOrders(orderRows);
      setLicenses(licenseRows);
      setError(null);
      setRefreshError(null);
    } catch (cause) {
      if (gen !== generationRef.current) return;
      const message = describeRequestError(cause, 'Không thể tải danh sách đơn hàng.');
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    orders,
    licenses,
    loading,
    refreshing,
    error,
    refreshError,
    reload: () => load(false),
    refresh: () => load(true),
  };
}

export function useOrderDetail(orderId: string) {
  const [order, setOrder] = useState<MobileOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++generationRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getOrder(orderId);
      if (gen !== generationRef.current) return;
      setOrder(data);
    } catch {
      if (gen !== generationRef.current) return;
      setError('Không thể tải đơn hàng.');
    } finally {
      if (gen === generationRef.current) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = useCallback(async (): Promise<MobileOrderDetail | null> => {
    if (!order || cancelling) return null;
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await apiCancelOrder(order.id);
      setOrder(updated);
      return updated;
    } catch (cause) {
      if (cause instanceof MobileApiError && cause.status === 409) {
        setCancelError(
          'Trạng thái đơn hàng đã thay đổi. Đang cập nhật lại trạng thái mới nhất.',
        );
        await load();
      } else {
        setCancelError('Không thể hủy đơn hàng. Vui lòng thử lại.');
      }
      return null;
    } finally {
      setCancelling(false);
    }
  }, [cancelling, load, order]);

  return {
    order,
    loading,
    error,
    cancelling,
    cancelError,
    clearCancelError: () => setCancelError(null),
    reload: load,
    cancel,
  };
}
