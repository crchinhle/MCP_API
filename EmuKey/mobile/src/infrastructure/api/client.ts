import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import type {
  ActivationChallengeDto,
  ActivationKeyDto,
  ActivateDeviceDto,
  DeviceChallengeDto,
  EntitlementDto,
  EntitlementValidationDto,
  CheckoutSessionDto,
  ComparePlansResponseDto,
  CreateOrderDto,
  OrderTermsDto,
  Phase6CommandDto,
  Phase6CommandStatusDto,
  LicenseDeviceDto,
  ProfileDto,
  PublicCatalogProductDto,
  RevokeDeviceDto,
  RotateActivationKeyDto,
  LicenseProjectionDto,
  OrderDto,
  PublicLicenseVerificationDto,
  RenewalPreviewDto,
} from './generated';

const SESSION_KEY = 'emukey_mobile_session_v1';
const ACTIVATION_KEY_PREFIX = 'emukey_activation_key_v1_';
const IDEMPOTENCY_PREFIX = 'emukey_order_intent_v1_';
const API_URL =
  (globalThis as typeof globalThis & {
    process?: { env?: { EXPO_PUBLIC_API_URL?: string } };
  }).process?.env?.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const REQUEST_TIMEOUT_MS = 8_000;

export type MobileOrderSummary = OrderDto;
export type MobileOrderDetail = OrderDto;
export type MobileProduct = PublicCatalogProductDto;
export type MobilePlanComparison = ComparePlansResponseDto;
export type MobileCheckoutSession = CheckoutSessionDto;
export type MobileOrderTerms = OrderTermsDto;
export type MobileRenewalPreview = RenewalPreviewDto;
export type MobileLicense = LicenseProjectionDto;
export type MobileLicenseVerification = PublicLicenseVerificationDto;
export type MobileDevice = {
  id: string;
  deviceRef: string;
  status: 'ACTIVE' | 'REVOKED';
  bindingGeneration: number;
  activatedAt: string | null;
  revokedAt: string | null;
};
export interface MobileUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  phone?: string | null;
  address?: string | null;
  organizationName?: string | null;
}
export interface MobileSession {
  accessToken: string;
  user: MobileUser;
}

export interface MobileConversation {
  id: string;
  customerUserId: string;
  assignedSupportUserId: string | null;
  status: 'AI_ACTIVE' | 'WAITING_SUPPORT' | 'SUPPORT_ACTIVE' | 'CLOSED';
  contextType: string;
  contextId: string | null;
  title: string | null;
}

export interface MobileConversationMessage {
  id: string;
  conversationId: string;
  clientMessageId: string;
  serverSequence: number;
  senderType: 'CUSTOMER' | 'SUPPORT' | 'AI' | 'SYSTEM';
  content: string;
  grounded?: boolean;
  sources?: string[];
}

export interface MobileNotification {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt?: string;
  readAt?: string | null;
  target?: { kind: 'LICENSE' | 'ORDER' | 'CONVERSATION' | 'PAYMENT' | 'SYSTEM'; id: string | null } | null;
}

export interface MobileNotificationPage {
  items: MobileNotification[];
  nextCursor: string | null;
}

let activeSession: MobileSession | null = null;

export class MobileApiError extends Error {
  constructor(readonly status: number, message = 'Yêu cầu API thất bại.') {
    super(message);
    this.name = 'MobileApiError';
  }
}

export async function restoreSession(): Promise<MobileSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MobileSession;
    if (!parsed.accessToken || parsed.user?.role !== 'CUSTOMER') return null;
    activeSession = parsed;
    return parsed;
  } catch {
    return null;
  }
}

async function saveSession(session: MobileSession | null): Promise<void> {
  activeSession = session;
  if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

async function request(path: string, init: RequestInit = {}, authenticated = true): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (authenticated && activeSession?.accessToken) {
    headers.set('authorization', `Bearer ${activeSession.accessToken}`);
  }
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
    if (authenticated && response.status === 401) await saveSession(null);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message: string | undefined;
    try {
      const body = (await response.json()) as {
        error?: { message?: string };
        message?: string;
      };
      message = body.error?.message ?? body.message;
    } catch {
      // The presentation layer provides a status-based fallback.
    }
    throw new MobileApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export async function forgotPassword(email: string): Promise<void> {
  await json<void>(await request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) }, false));
}

export async function login(email: string, password: string): Promise<MobileSession> {
  const session = await json<MobileSession>(
    await request(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) },
      false,
    ),
  );
  if (session.user.role !== 'CUSTOMER') {
    throw new MobileApiError(403, 'Ứng dụng này dành cho tài khoản người mua.');
  }
  await saveSession(session);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST' });
  } finally {
    await saveSession(null);
  }
}

export async function listOrders(): Promise<MobileOrderSummary[]> {
  return json(await request('/orders'));
}

export async function getOrder(id: string): Promise<MobileOrderDetail> {
  return json(await request(`/orders/${encodeURIComponent(id)}`));
}

export async function getProfile(): Promise<MobileUser> {
  return json(await request('/auth/profile'));
}

export async function updateProfile(input: ProfileDto): Promise<MobileUser> {
  const profile = await json<MobileUser>(
    await request('/auth/profile', { method: 'PUT', body: JSON.stringify(input) }),
  );
  if (activeSession) await saveSession({ ...activeSession, user: profile });
  return profile;
}

export async function listProducts(): Promise<MobileProduct[]> {
  return json(await request('/products', {}, false));
}

export async function comparePlans(ids: readonly string[]): Promise<MobilePlanComparison> {
  return json(
    await request(
      `/plans/compare?ids=${encodeURIComponent(ids.join(','))}`,
      {},
      false,
    ),
  );
}

async function idempotencyKeyFor(input: CreateOrderDto): Promise<{ storageKey: string; key: string }> {
  const intent = `${activeSession?.user.id ?? 'anonymous'}:${JSON.stringify(input)}`;
  const storageKey = `${IDEMPOTENCY_PREFIX}${bytesToHex(sha256(intent))}`;
  const existing = await SecureStore.getItemAsync(storageKey);
  if (existing) return { storageKey, key: existing };
  const key = Crypto.randomUUID();
  await SecureStore.setItemAsync(storageKey, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return { storageKey, key };
}

export async function createOrder(
  input: CreateOrderDto,
  licenseKey?: string,
): Promise<MobileOrderDetail> {
  const intent = await idempotencyKeyFor(input);
  const result = await json<MobileOrderDetail>(
    await request('/orders', {
      method: 'POST',
      headers: {
        'Idempotency-Key': intent.key,
        ...(licenseKey ? { 'X-License-Key': licenseKey } : {}),
      },
      body: JSON.stringify(input),
    }),
  );
  await SecureStore.deleteItemAsync(intent.storageKey);
  return result;
}

export async function getOrderTerms(id: string): Promise<MobileOrderTerms> {
  return json(await request(`/orders/${encodeURIComponent(id)}/service-terms`));
}

export async function getRenewalPreview(licenseId: string): Promise<MobileRenewalPreview> {
  return json(await request(`/orders/renewal-preview/${encodeURIComponent(licenseId)}`));
}

export async function acceptServiceTerms(order: MobileOrderDetail, terms: Pick<MobileOrderTerms, 'version' | 'hash'>): Promise<MobileOrderDetail> {
  return json(
      await request(`/orders/${encodeURIComponent(order.id)}/accept-service-terms`, {
      method: 'POST',
      body: JSON.stringify({
        accepted: true,
        version: terms.version,
        hash: terms.hash,
      }),
    }),
  );
}

export async function createCheckout(id: string): Promise<MobileCheckoutSession> {
  return json(
    await request(`/orders/${encodeURIComponent(id)}/checkout`, { method: 'POST' }),
  );
}

export async function listLicenses(): Promise<MobileLicense[]> {
  return json(await request('/licenses'));
}

export async function retrieveActivationKey(id: string): Promise<ActivationKeyDto> {
  return json(
    await request(`/licenses/${encodeURIComponent(id)}/activation-key/retrieve`, {
      method: 'POST',
    }),
  );
}

export async function storeActivationKey(licenseId: string, key: string): Promise<void> {
  await SecureStore.setItemAsync(`${ACTIVATION_KEY_PREFIX}${licenseId}`, key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadActivationKey(licenseId: string): Promise<string | null> {
  return SecureStore.getItemAsync(`${ACTIVATION_KEY_PREFIX}${licenseId}`);
}

export async function requestLicensingActionVerification(licenseId: string, action: 'ROTATE_KEY' | 'REVOKE_DEVICE' | 'REMOTE_REVOKE_DEVICE' | 'KEY_RECOVERY', deviceId?: string): Promise<{ accepted: boolean }> {
  return json(await request('/licenses/action-verification', { method: 'POST', body: JSON.stringify({ action, ...(deviceId ? { deviceId } : {}), licenseId }) }));
}

export async function getCommandStatus(commandId: string): Promise<Phase6CommandStatusDto> {
  return json(await request(`/commands/${encodeURIComponent(commandId)}`));
}

export async function listDevices(licenseId: string): Promise<MobileDevice[]> {
  return json(await request(`/licenses/${encodeURIComponent(licenseId)}/devices`));
}

export async function createActivationChallenge(input: ActivationChallengeDto, authenticated = true): Promise<DeviceChallengeDto> {
  return json(await request('/activations/challenge', { method: 'POST', body: JSON.stringify(input) }, authenticated));
}

export async function activateDevice(input: ActivateDeviceDto): Promise<LicenseDeviceDto> {
  return json(await request('/activations', { method: 'POST', body: JSON.stringify(input) }, false));
}

export async function revokeDevice(licenseId: string, deviceId: string, input: RevokeDeviceDto): Promise<LicenseDeviceDto> {
  return json(await request(`/licenses/${encodeURIComponent(licenseId)}/devices/${encodeURIComponent(deviceId)}/revoke`, { method: 'POST', body: JSON.stringify(input) }));
}

export async function remoteRevokeDevice(licenseId: string, deviceId: string, input: { actionToken: string; currentPassword: string }): Promise<LicenseDeviceDto> {
  return json(await request(`/licenses/${encodeURIComponent(licenseId)}/devices/${encodeURIComponent(deviceId)}/remote-revoke`, { method: 'POST', body: JSON.stringify(input) }));
}

export async function issueEntitlement(licenseId: string, deviceId: string, challenge: string, proof: string): Promise<EntitlementDto> {
  return json(await request('/entitlements/issue', { method: 'POST', body: JSON.stringify({ challenge, deviceId, licenseId, proof }) }, false));
}

export async function rotateActivationKey(licenseId: string, input: RotateActivationKeyDto): Promise<Phase6CommandDto> {
  return json(await request(`/licenses/${encodeURIComponent(licenseId)}/activation-key/rotate`, { method: 'POST', body: JSON.stringify(input) }));
}

export async function recoverActivationKey(licenseId: string, input: { actionToken: string; currentPassword: string }): Promise<Phase6CommandDto> {
  return json(await request(`/licenses/${encodeURIComponent(licenseId)}/activation-key/recover`, { method: 'POST', body: JSON.stringify(input) }));
}

export async function refreshEntitlement(licenseId: string, deviceId: string, challenge: string, proof: string): Promise<EntitlementDto> {
  return json(await request('/entitlements/refresh', { method: 'POST', body: JSON.stringify({ challenge, deviceId, licenseId, proof }) }, false));
}

export async function verifyEntitlement(token: string): Promise<EntitlementValidationDto> {
  return json(await request('/entitlements/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  }, false));
}

export async function verifyPublicLicense(
  publicId: string,
): Promise<PublicLicenseVerificationDto> {
  return json(
    await request(`/public/licenses/${encodeURIComponent(publicId)}/verify`, {}, false),
  );
}

export async function listConversations(): Promise<MobileConversation[]> {
  return json(await request('/conversations'));
}

export async function listConversationMessages(conversationId: string): Promise<MobileConversationMessage[]> {
  return json(await request(`/conversations/${encodeURIComponent(conversationId)}/messages`));
}

export async function closeConversation(conversationId: string): Promise<MobileConversation> {
  return json(
    await request(`/conversations/${encodeURIComponent(conversationId)}/close`, {
      method: 'POST',
    }),
  );
}

export async function createConversation(title = 'Hội thoại hỗ trợ'): Promise<MobileConversation> {
  return json(await request('/conversations', {
    method: 'POST',
    body: JSON.stringify({ contextType: 'GENERAL', title }),
  }));
}

export async function appendConversationMessage(conversationId: string, clientMessageId: string, content: string): Promise<{ serverSequence: number; content: string }> {
  return json(await request(`/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body: JSON.stringify({ clientMessageId, content }) }));
}

export async function askConversationAi(conversationId: string, question: string, clientMessageId?: string): Promise<{ answer: string; citedSourceIds: string[]; grounded: boolean }> {
  return json(await request(`/conversations/${encodeURIComponent(conversationId)}/ai-ask`, { method: 'POST', body: JSON.stringify({ question, ...(clientMessageId ? { clientMessageId } : {}) }) }));
}

export async function listNotifications(cursor?: string, limit = 20): Promise<MobileNotificationPage | MobileNotification[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return json(await request(`/notifications?${params.toString()}`));
}

export async function markNotificationRead(notificationId: string): Promise<MobileNotification> {
  return json(await request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' }));
}

export async function registerPushToken(token: string, provider: 'FCM' | 'EXPO'): Promise<void> {
  await json<void>(await request('/notifications/push-tokens', { method: 'POST', body: JSON.stringify({ provider, token }) }));
}

export async function removePushToken(token: string): Promise<void> {
  await json<void>(await request('/notifications/push-tokens/remove', { method: 'POST', body: JSON.stringify({ token }) }));
}
