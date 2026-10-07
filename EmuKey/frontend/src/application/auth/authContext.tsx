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
const LOGOUT_INTENT_KEY = 'emukey:logged-out';
const AUTH_CHANNEL = 'emukey-auth';
const REFRESH_LOCK_KEY = 'emukey:refresh-lock';
const REFRESH_LOCK_TTL_MS = REQUEST_TIMEOUT_MS + 5_000;
const AUTH_TAB_ID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random()}`;
let accessToken: string | null = null;
export type RefreshResult =
  | { kind: 'success'; accessToken: string; user: AuthUser | undefined }
  | { kind: 'invalid'; stale?: boolean }
  | { kind: 'transient'; error?: unknown };
let refreshPromise: Promise<RefreshResult> | null = null;
let authGeneration = 0;
let authChannel: BroadcastChannel | null | undefined;
let authStorageListenerInstalled = false;
function storageSafe(action: () => void): boolean {
  try {
    action();
    return true;
  } catch {
    return false;
  }
}
function readLogoutIntent(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  let value: string | null = null;
  storageSafe(() => {
    value = window.localStorage.getItem(LOGOUT_INTENT_KEY);
  });
  return value === '1';
}
function writeLogoutIntent(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  storageSafe(() => window.localStorage.setItem(LOGOUT_INTENT_KEY, '1'));
}
function clearLogoutIntent(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  storageSafe(() => window.localStorage.removeItem(LOGOUT_INTENT_KEY));
}
function authChannelInstance(): BroadcastChannel | null {
  if (authChannel !== undefined) return authChannel;
  if (typeof BroadcastChannel === 'undefined') {
    authChannel = null;
    return authChannel;
  }
  try {
    authChannel = new BroadcastChannel(AUTH_CHANNEL);
  } catch {
    authChannel = null;
  }
  if (authChannel) {
    authChannel.onmessage = (event: MessageEvent<{ type?: unknown }>) => {
      const type = event.data && typeof event.data === 'object' ? event.data.type : undefined;
      if (type === 'LOGOUT' || type === 'SESSION_INVALID') {
        applyRemoteLogout();
      }
    };
  }
  return authChannel;
}
function postAuthSignal(type: 'LOGOUT' | 'SESSION_INVALID' | 'SESSION_REFRESHED'): void {
  try {
    authChannelInstance()?.postMessage({ type });
  } catch {
    // Cross-tab messaging is best effort; local auth state is authoritative.
  }
  // Touch the same key so tabs without BroadcastChannel still learn about
  // explicit sign-out through the storage event. The stored value itself is
  // only the signal type and timestamp; it never contains a credential.
  if (type === 'LOGOUT' || type === 'SESSION_INVALID') {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(AUTH_CHANNEL, `${type}:${Date.now()}`);
    } catch {
      // storage can fail in privacy mode; BroadcastChannel or local timeout
      // still applies on the tab that initiated the action.
    }
  }
}
function ensureStorageAuthListener(): void {
  if (authStorageListenerInstalled || typeof window === 'undefined') return;
  authStorageListenerInstalled = true;
  window.addEventListener('storage', (event) => {
    if (event.key !== AUTH_CHANNEL || typeof event.newValue !== 'string') return;
    if (event.newValue.startsWith('LOGOUT') || event.newValue.startsWith('SESSION_INVALID')) {
      applyRemoteLogout();
    }
  });
}
function invalidateAuthOperations(): void {
  authGeneration += 1;
}
// Cross-tab refresh coordination. navigator.locks is the preferred primitive;
// the localStorage lease is a best-effort fallback for browsers without it.
// Neither path transfers a token: the lock only serialises who may call
// POST /auth/refresh, because the refresh cookie rotates once per use and a
// concurrent replay would revoke the whole session family.
async function withRefreshLock<T>(task: () => Promise<T>, fallback: T): Promise<T> {
  const lockManager = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { locks?: { request: <R>(name: string, callback: () => Promise<R>) => Promise<R> } }).locks
    : undefined;
  if (lockManager?.request) return lockManager.request('emukey-auth-refresh', task);
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  const deadline = Date.now() + REFRESH_LOCK_TTL_MS;
  let acquired = false;
  while (!acquired && Date.now() < deadline) {
    try {
      const now = Date.now();
      const raw = window.localStorage.getItem(REFRESH_LOCK_KEY);
      const held = raw ? JSON.parse(raw) as { expiresAt?: number; id?: string } : null;
      if (typeof held?.expiresAt !== 'number' || held.expiresAt <= now) {
        const lease = { expiresAt: now + REFRESH_LOCK_TTL_MS, id: AUTH_TAB_ID };
        window.localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify(lease));
        // Allow a competing tab's claim to win before verifying ownership.
        await new Promise((resolve) => setTimeout(resolve, 50));
        const confirmed = JSON.parse(window.localStorage.getItem(REFRESH_LOCK_KEY) ?? 'null') as { expiresAt?: number; id?: string } | null;
        acquired = confirmed?.id === lease.id && confirmed.expiresAt === lease.expiresAt;
      }
    } catch {
      return fallback;
    }
    if (!acquired) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!acquired) return fallback;
  try {
    return await task();
  } finally {
    try {
      const raw = window.localStorage.getItem(REFRESH_LOCK_KEY);
      const held = raw ? JSON.parse(raw) as { id?: string } : null;
      if (held?.id === AUTH_TAB_ID) window.localStorage.removeItem(REFRESH_LOCK_KEY);
    } catch {
      // Ignore cleanup failures; the lease expires on its own.
    }
  }
}
function applyRemoteLogout(): void {
  // Never trust the message payload beyond this signal type: tokens must
  // never traverse BroadcastChannel or localStorage.
  writeLogoutIntent();
  invalidateAuthOperations();
  accessToken = null;
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
}

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

// AUTH-01: only a confirmed refresh 401 invalidates the session;
// offline, timeout and 5xx failures keep the current user and surface a retry.
function notifySessionExpired(): void {
  writeLogoutIntent();
  invalidateAuthOperations();
  accessToken = null;
  postAuthSignal('SESSION_INVALID');
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
}

async function refreshSession(): Promise<RefreshResult> {
  if (readLogoutIntent()) return { kind: 'invalid' };
  if (refreshPromise) return refreshPromise;
  const captured = authGeneration;
  refreshPromise = (async (): Promise<RefreshResult> => {
    let outcome: RefreshResult;
    try {
      outcome = await withRefreshLock(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const headers = new Headers({ 'content-type': 'application/json' });
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers,
            credentials: 'include',
            signal: controller.signal,
          });
          if (response.status === 401) return { kind: 'invalid' as const };
          if (response.status >= 500 && response.status < 600) return { kind: 'transient' as const, error: `HTTP ${response.status}` };
          if (!response.ok) return { kind: 'transient' as const, error: `HTTP ${response.status}` };
          const result = await response.json() as { accessToken?: string; user?: AuthUser };
          if (typeof result.accessToken !== 'string') return { kind: 'transient' as const, error: 'Malformed refresh response' };
          postAuthSignal('SESSION_REFRESHED');
          return { kind: 'success' as const, accessToken: result.accessToken, user: result.user };
        } catch (error) {
          return { kind: 'transient' as const, error };
        } finally {
          clearTimeout(timeout);
        }
      }, { kind: 'transient', error: 'Refresh coordination unavailable' });
    } catch (error) {
      outcome = { kind: 'transient', error };
    }
    // A late response is discarded instead of being applied to a newer login
    // or to a tab that explicitly logged out while refresh was in flight.
    if (captured !== authGeneration) return { kind: 'invalid', stale: true };
    return outcome;
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
    const outcome = await refreshSession();
    if (outcome.kind === 'success') {
      accessToken = outcome.accessToken;
      return api(path, init, false);
    }
    if (outcome.kind === 'invalid' && !outcome.stale) {
      notifySessionExpired();
    }
    if (outcome.kind === 'transient') {
      return new Response(JSON.stringify({ error: { code: 'SESSION_CHECK_UNAVAILABLE', message: 'Session refresh is temporarily unavailable.' } }), {
        headers: { 'content-type': 'application/json' },
        status: 503,
        statusText: 'Session refresh unavailable',
      });
    }
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
type AuthValue = {
  user: AuthUser | null;
  loading: boolean;
  sessionCheckError: boolean;
  retrySessionCheck: () => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  updateProfile: (input: ProfileInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
};
const Context = createContext<AuthValue | null>(null);
interface AuthProviderProps {
  readonly children: ReactNode;
  readonly initialUser?: AuthUser | null;
  readonly skipBootstrap?: boolean;
}

export function AuthProvider({ children, initialUser, skipBootstrap = false }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);
  const [loading, setLoading] = useState(!skipBootstrap);
  const [sessionCheckError, setSessionCheckError] = useState(false);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

  useEffect(() => {
    ensureStorageAuthListener();
    authChannelInstance();
  }, []);

  useEffect(() => {
    if (skipBootstrap) return;
    let active = true;
    const captured = authGeneration;
    setLoading(true);
    setSessionCheckError(false);
    if (readLogoutIntent()) {
      accessToken = null;
      setUser(null);
      setLoading(false);
      return () => { active = false; };
    }
    void refreshSession().then((result) => {
      if (!active || captured !== authGeneration) return;
      if (result.kind === 'success') {
        accessToken = result.accessToken;
        if (result.user) setUser(result.user);
      } else if (result.kind === 'invalid' && !result.stale) {
        notifySessionExpired();
        setUser(null);
      } else if (result.kind === 'transient') {
        setSessionCheckError(true);
      }
    }).finally(() => {
      // Logout or a cross-tab invalidation may advance the generation while the
      // request is pending; the late result is ignored, but bootstrap must still
      // leave its loading state so the logged-out UI can render.
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [bootstrapAttempt, skipBootstrap]);

  useEffect(() => {
    const handleExpiry = () => {
      accessToken = null;
      setUser(null);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(UNAUTHORIZED_EVENT, handleExpiry);
      return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleExpiry);
    }
  }, []);

  const retrySessionCheck = () => {
    setBootstrapAttempt((attempt) => attempt + 1);
  };
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
    const operationGeneration = ++authGeneration;
    const response = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) }, false);
    if (!response.ok) {
      let payload: unknown;
      try { payload = await response.json(); } catch { payload = undefined; }
      const { code, message, traceId } = readErrorEnvelope(payload);
      throw new ApiRequestError(response.status, code, message, traceId);
    }
    const result = await response.json() as { accessToken: string; user: AuthUser };
    if (operationGeneration !== authGeneration) throw new Error('Authentication operation was superseded.');
    clearLogoutIntent();
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
    writeLogoutIntent();
    invalidateAuthOperations();
    accessToken = null;
    setUser(null);
    postAuthSignal('LOGOUT');
    try {
      await api('/auth/logout', { method: 'POST' }, false);
    } catch {
      // The local intent remains authoritative when the server is offline.
    }
  };
  return <Context.Provider value={{ user, loading, sessionCheckError, retrySessionCheck, login, register, verifyEmail, resendVerification, forgotPassword, resetPassword, updateProfile, logout, setUser }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider is required'); return value; }
export function useOptionalAuth() { return useContext(Context); }
