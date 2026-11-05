import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import type {
  AiAnswerDto,
  KnowledgeChunkDto,
  CitationDetailDto,
  ActivationChallengeDto,
  ActivationKeyDto,
  DeviceChallengeDto,
  CheckoutSessionDto,
  PaymentRetryDecisionDto,
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

const PUSH_TOKEN_KEY = 'emukey_mobile_push_token';
let pushRegistrationGeneration = 0;
let pushRegistrationWork: Promise<void> = Promise.resolve();

const SESSION_KEY = 'emukey_mobile_session_v1';
const ACTIVATION_KEY_PREFIX = 'emukey_activation_key_v1_';
const IDEMPOTENCY_PREFIX = 'emukey_order_intent_v1_';
// Expo only embeds statically referenced process.env.EXPO_PUBLIC_* values.
const API_URL = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';
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
  displayName?: string | null;
  platform?: string;
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
  refreshToken?: string;
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
  citationDetails?:CitationDetailDto[];
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
  unreadCount: number;
  items: MobileNotification[];
  nextCursor: string | null;
}

export async function getNotification(id:string):Promise<MobileNotification> {
  return json(await request(`/notifications/${encodeURIComponent(id)}`));
}

export async function getKnowledgeChunk(documentId: string, chunkId: string): Promise<KnowledgeChunkDto> {
  return json(await request(`/knowledge/documents/${encodeURIComponent(documentId)}/chunks/${encodeURIComponent(chunkId)}`));
}

let activeSession: MobileSession | null = null;
const sessionListeners = new Set<(session: MobileSession | null) => void>();
let refreshWork: Promise<void> | null = null;
let sessionGeneration = 0;
let accountGeneration = 0;
let storageWork: Promise<void> = Promise.resolve();

function serializeStorage(work: () => Promise<void>): Promise<void> {
  storageWork = storageWork.catch(() => undefined).then(work);
  return storageWork;
}

function privateIndex(userId: string): string { return `emukey_private_index_${userId}`; }
async function savePrivateValue(userId: string, key: string, value: string): Promise<void> {
  await serializeStorage(async () => {
    if ((activeSession?.user.id ?? 'anonymous') !== userId) throw new MobileApiError(401);
    const index = JSON.parse(await SecureStore.getItemAsync(privateIndex(userId)) ?? '[]') as string[];
    // Register before storing: interruption can leave an empty entry, never an unindexed secret.
    if (!index.includes(key)) await SecureStore.setItemAsync(privateIndex(userId), JSON.stringify([...index, key]));
    await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  });
}
async function clearPrivateValues(userId: string): Promise<void> {
  await serializeStorage(async () => {
    const index = JSON.parse(await SecureStore.getItemAsync(privateIndex(userId)) ?? '[]') as string[];
    for (const key of index) await SecureStore.deleteItemAsync(key);
    await SecureStore.deleteItemAsync(privateIndex(userId));
  });
}
export function subscribeSession(listener: (session: MobileSession | null) => void): () => void {
  sessionListeners.add(listener);
  return () => { sessionListeners.delete(listener); };
}

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
  sessionGeneration += 1;
  for (const listener of sessionListeners) listener(session);
  await serializeStorage(async () => {
    if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  });
}

async function invalidateSession(session: MobileSession): Promise<void> {
  if (activeSession !== session) return;
  accountGeneration += 1;
  try { await saveSession(null); }
  finally { await clearPrivateValues(session.user.id); }
}

async function request(path: string, init: RequestInit = {}, authenticated = true, retried = false): Promise<Response> {
  const sessionAtStart = activeSession;
  const accountAtStart = accountGeneration;
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
    if (authenticated && accountAtStart !== accountGeneration) throw new MobileApiError(401);
    if (authenticated && response.status === 401 && !retried && sessionAtStart) {
      if (accountAtStart !== accountGeneration || activeSession?.user.id !== sessionAtStart.user.id) throw new MobileApiError(401);
      const replay = () => {
        if (accountAtStart !== accountGeneration || activeSession?.user.id !== sessionAtStart.user.id) throw new MobileApiError(401);
        if (!['GET', 'HEAD'].includes((init.method ?? 'GET').toUpperCase()) && !headers.has('Idempotency-Key')) {
          throw new MobileApiError(409, 'Phiên đã được làm mới. Vui lòng thực hiện lại thao tác.');
        }
        return request(path, init, authenticated, true);
      };
      if (activeSession !== sessionAtStart) return replay();
      if (!sessionAtStart.refreshToken) { await invalidateSession(sessionAtStart); return response; }
      refreshWork ??= (async () => {
        const generation = sessionGeneration;
        const refreshed = await request('/auth/mobile/refresh', {
          method: 'POST', body: JSON.stringify({ refreshToken: sessionAtStart.refreshToken }),
        }, false);
        if (refreshed.status === 401 || refreshed.status === 403) {
          if (generation === sessionGeneration) await invalidateSession(sessionAtStart);
          throw new MobileApiError(401);
        }
        const next = await json<MobileSession>(refreshed);
        if (generation !== sessionGeneration) throw new MobileApiError(401);
        if (!next.refreshToken || next.user.id !== sessionAtStart.user.id || next.user.role !== 'CUSTOMER') {
          await invalidateSession(sessionAtStart); throw new MobileApiError(401);
        }
        await saveSession(next);
      })().finally(() => { refreshWork = null; });
      await refreshWork;
      return replay();
    }
    if (authenticated && response.status === 401 && retried && activeSession && activeSession.user.id === sessionAtStart?.user.id) await invalidateSession(activeSession);
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
  const generation = ++accountGeneration;
  sessionGeneration += 1;
  const session = await json<MobileSession>(
    await request(
      '/auth/mobile/login',
      { method: 'POST', body: JSON.stringify({ email: email.trim(), password }) },
      false,
    ),
  );
  if (session.user.role !== 'CUSTOMER') {
    throw new MobileApiError(403, 'Ứng dụng này dành cho tài khoản người mua.');
  }
  if (generation !== accountGeneration) throw new MobileApiError(401);
  if (activeSession && activeSession.user.id !== session.user.id) await clearPrivateValues(activeSession.user.id);
  if (generation !== accountGeneration) throw new MobileApiError(401);
  await saveSession(session);
  return session;
}

export async function logout(): Promise<void> {
  const userId = activeSession?.user.id;
  accountGeneration += 1;
  sessionGeneration += 1;
  pushRegistrationGeneration += 1;
  await pushRegistrationWork.catch(() => undefined);
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    try { if (token) await removePushToken(token); }
    finally { if (activeSession?.refreshToken) await request('/auth/mobile/logout', { method: 'POST', body: JSON.stringify({ refreshToken: activeSession.refreshToken }) }, false); }
  } finally {
    try { if (userId) await clearPrivateValues(userId); }
    finally {
      try { await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY); }
      finally { await saveSession(null); }
    }
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

export async function getPaymentRetryDecision(id: string): Promise<PaymentRetryDecisionDto> {
  return json(await request(`/orders/${encodeURIComponent(id)}/payment-retry`));
}

export async function createCheckout(id: string): Promise<MobileCheckoutSession> {
  return json(
    await request(`/orders/${encodeURIComponent(id)}/checkout`, { method: 'POST' }),
  );
}

export async function listLicenses(): Promise<MobileLicense[]> {
  return json(await request('/licenses'));
}
export async function getLicense(id:string):Promise<MobileLicense> {return json(await request(`/licenses/${encodeURIComponent(id)}`));}

export async function retrieveActivationKey(id: string, keyVersion?: number): Promise<ActivationKeyDto> {
  const userId = activeSession?.user.id ?? 'anonymous';
  const intentKey = `emukey_key_delivery_${userId}_${id}_${keyVersion ?? 'current'}`;
  const deliveryId = await SecureStore.getItemAsync(intentKey) ?? Crypto.randomUUID();
  await savePrivateValue(userId, intentKey, deliveryId);
  const result = await json<ActivationKeyDto>(
    await request(`/licenses/${encodeURIComponent(id)}/activation-key/retrieve`, {
      method: 'POST', headers: { 'Idempotency-Key': deliveryId }, body: JSON.stringify({ deliveryId }),
    }),
  );
  if ((activeSession?.user.id ?? 'anonymous') !== userId || (keyVersion !== undefined && result.keyVersion !== keyVersion)) throw new MobileApiError(409);
  const receipt: SavedActivationKey = { ...result, acknowledged: false };
  await savePrivateValue(userId, activationStorageKey(userId, id), JSON.stringify(receipt));
  await acknowledgeSavedKey(userId, id, receipt);
  return result;
}

interface SavedActivationKey { activationKey: string; keyVersion?: number; deliveryId?: string; acknowledged: boolean }
function activationStorageKey(userId: string, licenseId: string): string { return `${ACTIVATION_KEY_PREFIX}${userId}_${licenseId}`; }

async function acknowledgeSavedKey(userId: string, licenseId: string, receipt: SavedActivationKey): Promise<void> {
  if (!receipt.deliveryId || !receipt.keyVersion || receipt.acknowledged) return;
  if ((activeSession?.user.id ?? 'anonymous') !== userId) throw new MobileApiError(401);
  await json(await request(`/licenses/${encodeURIComponent(licenseId)}/activation-key/ack`, {
    method: 'POST', headers: { 'Idempotency-Key': receipt.deliveryId },
    body: JSON.stringify({ deliveryId: receipt.deliveryId, keyVersion: receipt.keyVersion }),
  }));
  await savePrivateValue(userId, activationStorageKey(userId, licenseId), JSON.stringify({ ...receipt, acknowledged: true }));
}

export async function storeActivationKey(licenseId: string, key: string): Promise<void> {
  const userId = activeSession?.user.id ?? 'anonymous';
  await savePrivateValue(userId, activationStorageKey(userId, licenseId), JSON.stringify({ activationKey: key, acknowledged: true } satisfies SavedActivationKey));
}

export async function loadActivationKey(licenseId: string, keyVersion?: number): Promise<string | null> {
  const userId = activeSession?.user.id ?? 'anonymous';
  const storageKey = activationStorageKey(userId, licenseId);
  const raw = await SecureStore.getItemAsync(storageKey);
  if (!raw) return null;
  let receipt: SavedActivationKey;
  try { receipt = JSON.parse(raw) as SavedActivationKey; }
  catch { await SecureStore.deleteItemAsync(storageKey); return null; }
  if (keyVersion !== undefined && receipt.keyVersion !== keyVersion) {
    await SecureStore.deleteItemAsync(storageKey); return null;
  }
  await acknowledgeSavedKey(userId, licenseId, receipt);
  if ((activeSession?.user.id ?? 'anonymous') !== userId) throw new MobileApiError(401);
  return receipt.activationKey;
}

export async function requestLicensingActionVerification(licenseId: string, action: 'ROTATE_KEY' | 'REVOKE_DEVICE' | 'REMOTE_REVOKE_DEVICE' | 'KEY_RECOVERY', deviceId?: string): Promise<{ accepted: boolean }> {
  const userId = activeSession?.user.id ?? 'anonymous';
  const license = await getLicense(licenseId);
  await savePrivateValue(userId, `emukey_pending_license_action_${userId}`, JSON.stringify({ licenseId, action, deviceId, keyVersion: license.keyVersion, createdAt: Date.now() }));
  return json(await request('/licenses/action-verification', { method: 'POST', body: JSON.stringify({ action, ...(deviceId ? { deviceId } : {}), licenseId }) }));
}

export async function pendingLicensingAction(): Promise<{ licenseId: string } | null> {
  if (!activeSession) return null;
  const userId = activeSession.user.id;
  const key = `emukey_pending_license_action_${userId}`;
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  const intent = JSON.parse(raw) as { licenseId: string; deviceId?: string; action: string; keyVersion: number; createdAt: number };
  if (intent.createdAt + 86_400_000 < Date.now()) { await SecureStore.deleteItemAsync(key); return null; }
  const license = await getLicense(intent.licenseId);
  if (activeSession?.user.id !== userId) return null;
  let completed = license.keyVersion > intent.keyVersion;
  if (intent.deviceId) completed = (await listDevices(intent.licenseId)).some((device) => device.id === intent.deviceId && device.status === 'REVOKED');
  if (completed) await SecureStore.deleteItemAsync(key);
  return { licenseId: intent.licenseId };
}

export async function updateDeviceMetadata(licenseId: string, deviceId: string, displayName: string): Promise<LicenseDeviceDto> {
  return json(await request(`/licenses/${encodeURIComponent(licenseId)}/devices/${encodeURIComponent(deviceId)}`, {
    method: 'PATCH', body: JSON.stringify({ displayName }),
  }));
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

export async function revokeDevice(licenseId: string, deviceId: string, input: RevokeDeviceDto): Promise<LicenseDeviceDto> {
  return json(await request(`/licenses/${encodeURIComponent(licenseId)}/devices/${encodeURIComponent(deviceId)}/revoke`, { method: 'POST', body: JSON.stringify(input) }));
}

export async function remoteRevokeDevice(licenseId: string, deviceId: string, input: { actionToken: string; currentPassword: string }): Promise<LicenseDeviceDto> {
  return json(await request(`/licenses/${encodeURIComponent(licenseId)}/devices/${encodeURIComponent(deviceId)}/remote-revoke`, { method: 'POST', body: JSON.stringify(input) }));
}

export async function rotateActivationKey(licenseId: string, input: RotateActivationKeyDto): Promise<Phase6CommandDto> {
  return json(await request(`/licenses/${encodeURIComponent(licenseId)}/activation-key/rotate`, { method: 'POST', body: JSON.stringify(input) }));
}

export async function recoverActivationKey(licenseId: string, input: { actionToken: string; currentPassword: string }): Promise<Phase6CommandDto> {
  return json(await request(`/licenses/${encodeURIComponent(licenseId)}/activation-key/recover`, { method: 'POST', body: JSON.stringify(input) }));
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

export async function createConversation(title = 'Hội thoại hỗ trợ', orderId?: string): Promise<MobileConversation> {
  return json(await request('/conversations', {
    method: 'POST',
    body: JSON.stringify({ contextType: orderId ? 'ORDER' : 'GENERAL', ...(orderId ? { contextId: orderId } : {}), title }),
  }));
}

export async function appendConversationMessage(conversationId: string, clientMessageId: string, content: string): Promise<{ serverSequence: number; content: string }> {
  return json(await request(`/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body: JSON.stringify({ clientMessageId, content }) }));
}

export async function askConversationAi(conversationId: string, question: string, clientMessageId?: string): Promise<AiAnswerDto> {
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
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
}

export async function removePushToken(token: string): Promise<void> {
  await json<void>(await request('/notifications/push-tokens/remove', { method: 'POST', body: JSON.stringify({ token }) }));
}

// Native tokens from Expo Notifications are FCM on Android, APNs on iOS.
// The installed backend adapter supports FCM; never label an APNs token as FCM.
export function observeDevicePushTokens(): () => void {
  const generation = ++pushRegistrationGeneration;
  let subscription: { remove(): void } | undefined;
  const active = () => generation === pushRegistrationGeneration;
  const register = (token: string) => {
    pushRegistrationWork = pushRegistrationWork.catch(() => undefined).then(async () => {
      if (!active()) return;
      const previous = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
      if (!active()) return;
      if (previous && previous !== token) await removePushToken(previous);
      if (active()) await registerPushToken(token, 'FCM');
    });
    void pushRegistrationWork.catch(() => undefined);
  };
  void (async () => {
    const { Platform } = await import('react-native');
    if (Platform.OS !== 'android' || !active()) return;
    const notifications = await import('expo-notifications');
    await notifications.setNotificationChannelAsync('default', { name: 'EmuKey', importance: notifications.AndroidImportance.DEFAULT });
    const existing = await notifications.getPermissionsAsync();
    if (!active()) return;
    const permission = existing.granted ? existing : await notifications.requestPermissionsAsync();
    if (!permission.granted || !active()) return;
    const token = await notifications.getDevicePushTokenAsync();
    if (!active()) return;
    register(String(token.data));
    subscription = notifications.addPushTokenListener((next) => { if (active()) register(String(next.data)); });
  })().catch(() => { /* Push setup must not block account access; retried on next login. */ });
  return () => { if (active()) pushRegistrationGeneration += 1; subscription?.remove(); };
}

export function observeNotificationResponses(onNotification:(id:string)=>void):()=>void {
  let active=true;
  let subscription:{remove():void}|undefined;
  void import('expo-notifications').then(async (notifications)=>{
    const handle=(response:import('expo-notifications').NotificationResponse|null)=>{
      const id=response?.notification.request.content.data?.notificationId;
      if (active && typeof id==='string' && /^[0-9a-f-]{36}$/i.test(id)) onNotification(id);
    };
    if (!active) return;
    subscription=notifications.addNotificationResponseReceivedListener(handle);
    handle(await notifications.getLastNotificationResponseAsync());
    if (active) await notifications.clearLastNotificationResponseAsync();
  }).catch(()=>undefined);
  return ()=>{active=false;subscription?.remove();};
}
