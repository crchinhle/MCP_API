import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import {
  listNotifications,
  markNotificationRead,
  type MobileNotification,
  type MobileNotificationPage,
} from '../../infrastructure/api/client';
import { useCustomerSession } from '../auth/useCustomerSession';
import { describeRequestError } from '../requestError';

const POLL_INTERVAL_MS = 15_000;

export interface NotificationContextValue {
  readonly items: readonly MobileNotification[];
  readonly unreadCount: number;
  readonly nextCursor: string | null;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly loadingMore: boolean;
  readonly error: string | null;
  readonly loadMoreError: string | null;
  readonly readError: string | null;
  readonly refresh: () => Promise<void>;
  readonly loadMore: () => Promise<void>;
  readonly markRead: (notificationId: string) => Promise<void>;
  readonly clearReadError: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function normalizePage(
  result: MobileNotificationPage | MobileNotification[],
): MobileNotificationPage {
  if (Array.isArray(result)) {
    return {
      items: result,
      nextCursor: null,
      unreadCount: result.filter((item) => !item.isRead).length,
    };
  }
  return result;
}

function dedupById(items: readonly MobileNotification[]): MobileNotification[] {
  const seen = new Set<string>();
  const out: MobileNotification[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

export function NotificationProvider({ children }: { readonly children: ReactNode }) {
  const { user, isAuthenticated } = useCustomerSession();
  const userId = isAuthenticated ? user?.id ?? null : null;

  const [items, setItems] = useState<MobileNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const refreshingRef = useRef(false);

  const fetchFirstPage = useCallback(
    async (mode: 'initial' | 'refresh' | 'poll') => {
      if (!userId) return;
      if (mode === 'refresh' && refreshingRef.current) return;
      const gen = generationRef.current;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') {
        refreshingRef.current = true;
        setRefreshing(true);
      }
      if (mode !== 'poll') setError(null);
      try {
        const page = normalizePage(await listNotifications());
        if (gen !== generationRef.current) return;
        setItems((current) =>
          mode === 'poll' ? dedupById([...page.items, ...current]) : dedupById(page.items),
        );
        setUnreadCount(
          Number.isFinite(page.unreadCount) ? Math.max(0, Number(page.unreadCount)) : 0,
        );
        if (mode !== 'poll') {
          setNextCursor(page.nextCursor ?? null);
          setLoadMoreError(null);
        }
        setError(null);
      } catch (cause) {
        if (gen !== generationRef.current) return;
        if (mode !== 'poll') {
          setError(
            describeRequestError(cause, 'Không thể tải thông báo. Vui lòng thử lại.'),
          );
        }
      } finally {
        if (mode === 'refresh') {
          refreshingRef.current = false;
        }
        if (gen === generationRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    generationRef.current += 1;
    refreshingRef.current = false;
    setItems([]);
    setUnreadCount(0);
    setNextCursor(null);
    setError(null);
    setLoadMoreError(null);
    setReadError(null);
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);

    if (!userId) return;

    void fetchFirstPage('initial');
    const timer = setInterval(() => {
      if (AppState.currentState !== 'background') {
        void fetchFirstPage('poll');
      }
    }, POLL_INTERVAL_MS);
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void fetchFirstPage('poll');
      }
    });
    return () => {
      clearInterval(timer);
      appSub?.remove?.();
    };
  }, [fetchFirstPage, userId]);

  const refresh = useCallback(async () => {
    await fetchFirstPage('refresh');
  }, [fetchFirstPage]);

  const loadMore = useCallback(async () => {
    if (!userId || !nextCursor || loadingMore) return;
    const gen = generationRef.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = normalizePage(await listNotifications(nextCursor));
      if (gen !== generationRef.current) return;
      setItems((current) => dedupById([...current, ...page.items]));
      setUnreadCount(Number.isFinite(page.unreadCount) ? Math.max(0, Number(page.unreadCount)) : 0);
      setNextCursor(page.nextCursor ?? null);
      setLoadMoreError(null);
    } catch (cause) {
      if (gen !== generationRef.current) return;
      setLoadMoreError(
        describeRequestError(cause, 'Không thể tải thêm thông báo. Vui lòng thử lại.'),
      );
    } finally {
      if (gen === generationRef.current) setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, userId]);

  const markRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;
      const gen = generationRef.current;
      const target = items.find((item) => item.id === notificationId);
      const wasUnread = target ? !target.isRead : false;
      setReadError(null);
      try {
        const updated = await markNotificationRead(notificationId);
        if (gen !== generationRef.current) return;
        setItems((current) =>
          current.map((item) =>
            item.id === notificationId ? { ...item, ...updated, isRead: true } : item,
          ),
        );
        if (wasUnread) {
          setUnreadCount((current) => Math.max(0, current - 1));
        }
        // Sync canonical global unreadCount from server without flashing loading spinner.
        void fetchFirstPage('poll');
      } catch {
        if (gen !== generationRef.current) return;
        setReadError('Không thể đánh dấu thông báo đã đọc. Vui lòng thử lại.');
      }
    },
    [fetchFirstPage, items, userId],
  );

  const clearReadError = useCallback(() => setReadError(null), []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      items,
      unreadCount,
      nextCursor,
      loading,
      refreshing,
      loadingMore,
      error,
      loadMoreError,
      readError,
      refresh,
      loadMore,
      markRead,
      clearReadError,
    }),
    [
      clearReadError,
      error,
      items,
      loadMore,
      loadMoreError,
      loading,
      loadingMore,
      markRead,
      nextCursor,
      readError,
      refresh,
      refreshing,
      unreadCount,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    return {
      items: [],
      unreadCount: 0,
      nextCursor: null,
      loading: false,
      refreshing: false,
      loadingMore: false,
      error: null,
      loadMoreError: null,
      readError: null,
      refresh: () => Promise.resolve(),
      loadMore: () => Promise.resolve(),
      markRead: () => Promise.resolve(),
      clearReadError: () => undefined,
    };
  }
  return ctx;
}
