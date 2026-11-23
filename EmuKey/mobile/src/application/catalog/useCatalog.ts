import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  comparePlans,
  listProducts,
  type MobilePlanComparison,
  type MobileProduct,
} from '../../infrastructure/api/client';

export type CatalogSort = 'default' | 'price-asc';

export function useCatalogProducts() {
  const [products, setProducts] = useState<MobileProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await listProducts();
      if (!mountedRef.current) return;
      setProducts(result);
    } catch {
      if (!mountedRef.current) return;
      setError('Không thể tải danh mục sản phẩm.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    products,
    loading,
    refreshing,
    error,
    reload: () => load(false),
    refresh: () => load(true),
  };
}

export function useCatalogProduct(productId: string | undefined) {
  const catalog = useCatalogProducts();
  const product = useMemo(
    () => (productId ? catalog.products.find((item) => item.id === productId) ?? null : null),
    [catalog.products, productId],
  );
  return {
    ...catalog,
    product,
  };
}

export function useComparePlans(ids: readonly string[]) {
  const [comparison, setComparison] = useState<MobilePlanComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const key = ids.join(',');

  const load = useCallback(async () => {
    const cleanIds = ids.filter(Boolean).slice(0, 4);
    if (cleanIds.length < 2) {
      setComparison(null);
      setError(null);
      setLoading(false);
      return;
    }
    const gen = ++generationRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await comparePlans(cleanIds);
      if (gen !== generationRef.current) return;
      setComparison(data);
    } catch {
      if (gen !== generationRef.current) return;
      setError('Không thể so sánh các gói đã chọn.');
    } finally {
      if (gen === generationRef.current) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    comparison,
    loading,
    error,
    reload: load,
  };
}
