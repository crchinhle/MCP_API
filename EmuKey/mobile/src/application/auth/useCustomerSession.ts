import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  logout as apiLogout,
  restoreSession,
  subscribeSession,
  type MobileSession,
  type MobileUser,
} from '../../infrastructure/api/client';
import { clearCheckoutIntent } from '../../infrastructure/checkout-intent';

const NON_CUSTOMER_ERROR = 'Ứng dụng này dành cho tài khoản khách hàng.';

export interface CustomerSessionContextValue {
  readonly session: MobileSession | null;
  readonly loading: boolean;
  readonly isAuthenticated: boolean;
  readonly user: MobileUser | null;
  readonly roleError: string | null;
  readonly clearRoleError: () => void;
  readonly setSession: (session: MobileSession | null) => void;
  readonly updateUser: (user: MobileUser) => void;
  readonly signOut: () => Promise<void>;
}

const CustomerSessionContext = createContext<CustomerSessionContextValue | null>(null);

export function CustomerSessionProvider({ children }: { readonly children: ReactNode }) {
  const [session, setSessionState] = useState<MobileSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const rejectNonCustomer = () => {
      setSessionState(null);
      setRoleError(NON_CUSTOMER_ERROR);
      void apiLogout().catch(() => undefined);
    };

    const unsubscribe = subscribeSession((next) => {
      if (!active) return;
      if (next && next.user.role !== 'CUSTOMER') {
        rejectNonCustomer();
        return;
      }
      if (next) setRoleError(null);
      setSessionState(next);
    });
    void restoreSession()
      .then((restored) => {
        if (!active) return;
        if (restored && restored.user.role !== 'CUSTOMER') {
          rejectNonCustomer();
          return;
        }
        setSessionState(restored);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const clearRoleError = useCallback(() => setRoleError(null), []);

  const setSession = useCallback((next: MobileSession | null) => {
    if (next && next.user.role !== 'CUSTOMER') {
      setSessionState(null);
      setRoleError(NON_CUSTOMER_ERROR);
      void apiLogout().catch(() => undefined);
      return;
    }
    if (next) setRoleError(null);
    setSessionState(next);
  }, []);

  const updateUser = useCallback((user: MobileUser) => {
    if (user.role !== 'CUSTOMER') return;
    setSessionState((current) => (current ? { ...current, user } : current));
  }, []);

  const signOut = useCallback(async () => {
    const uid = session?.user.id;
    try {
      await apiLogout();
    } finally {
      await clearCheckoutIntent(uid);
      setSessionState(null);
    }
  }, [session?.user.id]);

  const value = useMemo<CustomerSessionContextValue>(
    () => ({
      session,
      loading,
      isAuthenticated: Boolean(session && session.user.role === 'CUSTOMER'),
      user: session?.user ?? null,
      roleError,
      clearRoleError,
      setSession,
      updateUser,
      signOut,
    }),
    [clearRoleError, loading, roleError, session, setSession, signOut, updateUser],
  );

  return createElement(
    CustomerSessionContext.Provider,
    { value },
    children,
  );
}

const DEFAULT_SESSION_CONTEXT: CustomerSessionContextValue = {
  session: null,
  loading: false,
  isAuthenticated: false,
  user: null,
  roleError: null,
  clearRoleError: () => undefined,
  setSession: () => undefined,
  updateUser: () => undefined,
  signOut: () => Promise.resolve(),
};

export function useCustomerSession(): CustomerSessionContextValue {
  return useContext(CustomerSessionContext) ?? DEFAULT_SESSION_CONTEXT;
}
