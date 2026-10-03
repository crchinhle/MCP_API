import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type CustomerType = 'BUSINESS' | 'INDIVIDUAL' | 'STUDENT';
export type AuthUser = { id: string; email: string; displayName: string; role: string; status: string; customerType?: CustomerType | null; emailVerifiedAt?: string | null; phone?: string | null; address?: string | null; organizationName?: string | null };
export type RegisterInput = { customerType: CustomerType; displayName: string; email: string; password: string };
export type ProfileInput = { displayName: string; phone?: string; address?: string; organizationName?: string };
const API_URL = (import.meta.env as Record<string, string | undefined>).VITE_API_URL ?? '/api/v1';
// Readiness, catalog and first-query paths can cross a cold database/RPC start;
// avoid treating a slow but healthy request as an expired authentication session.
const REQUEST_TIMEOUT_MS = 10_000;
const UNAUTHORIZED_EVENT = 'emukey:session-expired';
let accessToken: string | null = null;
type RefreshResult = { accessToken: string; user: AuthUser | undefined };
let refreshPromise: Promise<RefreshResult | null> | null = null;

export class ApiRequestError extends Error {
  readonly code: string | undefined;
  readonly status: number;
  readonly traceId: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, code?: string, message?: string, traceId?: string, retryAfterSeconds?: number) {
    super(message ?? `API request failed (${status})`);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.traceId = traceId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function readErrorEnvelope(body: unknown): { code: string | undefined; message: string | undefined; traceId: string | undefined } {
  const envelope = body && typeof body === 'object' && 'error' in body
    ? (body as { error?: unknown }).error
    : body;
  const error = envelope && typeof envelope === 'object'
    ? envelope as { code?: unknown; message?: unknown; traceId?: unknown }
    : {};
  return {
    code: typeof error.code === 'string' ? error.code : undefined,
    message: typeof error.message === 'string' ? error.message : undefined,
    traceId: typeof error.traceId === 'string' ? error.traceId : undefined,
  };
}

// AUTH-01: only a confirmed 401/403 session failure invalidates the session;
// offline, timeout and 5xx failures keep the current user and surface a retry.
function notifySessionExpired(): void {
  accessToken = null;
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
}

async function refreshSession(): Promise<RefreshResult | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const headers = new Headers({ 'content-type': 'application/json' });
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!response.ok) return null;
    const result = await response.json() as { accessToken?: string; user?: AuthUser };
    return typeof result.accessToken === 'string' ? { accessToken: result.accessToken, user: result.user } : null;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function api(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  // Refresh is cookie-based; sending an expired bearer token makes the API
  // reject an otherwise valid rotated refresh session before it can recover.
  if (accessToken && path !== '/auth/refresh') headers.set('authorization', `Bearer ${accessToken}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: 'no-store',
      headers,
      credentials: 'include',
      signal: init.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  // AUTH-09: an authenticated 403 means "wrong role/permission", never "log in".
  if (response.status === 403 && accessToken) return response;
  if (response.status === 401 && retry && path !== '/auth/refresh') {
    const refreshed = await refreshSession();
    if (refreshed) {
      accessToken = refreshed.accessToken;
      return api(path, init, false);
    }
    // AUTH-01: the refresh was rejected, so the session is genuinely invalid.
    notifySessionExpired();
  }
  return response;
}

function parseRetryAfter(response: Response): number | undefined {
  const header = response.headers?.get?.('retry-after');
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await api(path, init);
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    const { code, message, traceId } = readErrorEnvelope(body);
    throw new ApiRequestError(response.status, code, message, traceId, parseRetryAfter(response));
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export function describeApiError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiRequestError)) return fallback;
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (error.status === 403) return error.message || 'Bạn không có quyền thực hiện thao tác này.';
  if (error.status === 400) return error.message || 'Dữ liệu chưa hợp lệ.';
  if (error.status === 404) return error.message || 'Không tìm thấy dữ liệu yêu cầu.';
  if (error.status === 409) return error.message || 'Thao tác xung đột với trạng thái hiện tại.';
  if (error.status === 429) return error.message || 'Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.';
  if (error.status >= 500) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  return error.message || fallback;
}
type AuthValue = { user: AuthUser | null; loading: boolean; login: (email: string, password: string) => Promise<AuthUser>; register: (input: RegisterInput) => Promise<void>; verifyEmail: (token: string) => Promise<void>; resendVerification: (email: string) => Promise<void>; forgotPassword: (email: string) => Promise<void>; resetPassword: (token: string, password: string) => Promise<void>; updateProfile: (input: ProfileInput) => Promise<AuthUser>; logout: () => Promise<void>; setUser: (user: AuthUser | null) => void };
const Context = createContext<AuthValue | null>(null);
interface AuthProviderProps {
  readonly children: ReactNode;
  readonly initialUser?: AuthUser | null;
  readonly skipBootstrap?: boolean;
}

export function AuthProvider({ children, initialUser, skipBootstrap = false }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null); const [loading, setLoading] = useState(!skipBootstrap);
  useEffect(() => {
    if (skipBootstrap) return;
    void refreshSession()
      .then((result) => {
        if (result) {
          accessToken = result.accessToken;
          if (result.user) setUser(result.user);
        }
      })
      .catch(() => {
        accessToken = null;
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [skipBootstrap]);
  // AUTH-02: clear user state when a 401 refresh failure notifies expiry.
  useEffect(() => {
    const handleExpiry = () => {
      setUser(null);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(UNAUTHORIZED_EVENT, handleExpiry);
      return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleExpiry);
    }
  }, []);
  const post = async (path: string, body: object) => {
    const response = await api(path, { method: 'POST', body: JSON.stringify(body) }, false);
    if (!response.ok) {
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = undefined; }
      const { code, message, traceId } = readErrorEnvelope(payload);
      throw new ApiRequestError(response.status, code, message, traceId);
    }
  };
  const login = async (email: string, password: string) => {
    const response = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) }, false);
    if (!response.ok) {
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = undefined; }
      const { code, message, traceId } = readErrorEnvelope(payload);
      throw new ApiRequestError(response.status, code, message, traceId);
    }
    const result = await response.json() as { accessToken: string; user: AuthUser };
    accessToken = result.accessToken;
    setUser(result.user);
    return result.user;
  };
  const register = (input: RegisterInput) => post('/auth/register', {
    customerType: input.customerType,
    displayName: input.displayName,
    email: input.email.trim(),
    password: input.password,
  });
  const verifyEmail = (token: string) => post('/auth/verify-email', { token });
  const resendVerification = (email: string) => post('/auth/resend-verification', { email: email.trim() });
  const forgotPassword = (email: string) => post('/auth/forgot-password', { email });
  const resetPassword = (token: string, password: string) => post('/auth/reset-password', { token, password });
  const updateProfile = async (input: ProfileInput) => {
    const updated = await requestJson<AuthUser>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    setUser(updated);
    return updated;
  };
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' }, false);
    } finally {
      // Local logout must always complete even while offline. The server may
      // still need to revoke its cookie when connectivity returns.
      accessToken = null;
      setUser(null);
    }
  };
  return <Context.Provider value={{ user, loading, login, register, verifyEmail, resendVerification, forgotPassword, resetPassword, updateProfile, logout, setUser }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider is required'); return value; }
export function useOptionalAuth() { return useContext(Context); }
