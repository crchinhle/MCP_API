import { useCallback, useEffect, useRef, useState } from 'react';

import {
  acceptServiceTerms,
  createOrder,
  getOrder,
  getOrderTerms,
  MobileApiError,
  type MobileOrderDetail,
  type MobileOrderTerms,
} from '../../infrastructure/api/client';
import type { CreateOrderDto } from '../../infrastructure/api/generated';
import {
  clearCheckoutIntent,
  readCheckoutIntent,
} from '../../infrastructure/checkout-intent';
import { useCustomerSession } from '../auth/useCustomerSession';

export type TermsLoadState = 'idle' | 'loading' | 'ready' | 'error';
export type RecoveryResult = 'recovered' | 'none' | 'error';

const TERMINAL_CHECKOUT_STATUSES = new Set([
  'PAYMENT_ACCEPTED',
  'CANCELLED',
  'EXPIRED',
]);

export function useCheckoutOrder(initialOrderId?: string) {
  const { user } = useCustomerSession();
  const userId = user?.id;
  const [order, setOrder] = useState<MobileOrderDetail | null>(null);
  const [terms, setTerms] = useState<MobileOrderTerms | null>(null);
  const [termsState, setTermsState] = useState<TermsLoadState>('idle');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actionLockRef = useRef(false);
  const lockOwnerRef = useRef<number | null>(null);
  const nextLockIdRef = useRef(0);
  const recoveringRef = useRef(false);
  const recoveryBlockedRef = useRef(false);
  const recoveryGenerationRef = useRef(0);
  const lastTermsIdentityRef = useRef<string>('');

  const loadTerms = useCallback(async (orderId: string) => {
    setError(null);
    setTermsState('loading');
    try {
      const loaded = await getOrderTerms(orderId);
      const identity = `${orderId}:${loaded.version}:${loaded.hash}`;
      if (lastTermsIdentityRef.current !== identity) {
        setAccepted(false);
        lastTermsIdentityRef.current = identity;
      }
      setTerms(loaded);
      setTermsState('ready');
      return loaded;
    } catch {
      setTermsState('error');
      setError('Không thể tải điều khoản. Vui lòng thử lại.');
      return null;
    }
  }, []);

  const resumeOrder = useCallback(
    async (orderId: string): Promise<MobileOrderDetail | null> => {
      if (actionLockRef.current) return null;
      const opId = ++nextLockIdRef.current;
      actionLockRef.current = true;
      lockOwnerRef.current = opId;
      setBusy(true);
      setError(null);
      try {
        const fetched = await getOrder(orderId);
        setOrder(fetched);
        if (TERMINAL_CHECKOUT_STATUSES.has(fetched.orderStatus)) {
          await clearCheckoutIntent(user?.id, fetched.id);
        } else if (fetched.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE') {
          await loadTerms(fetched.id);
        }
        return fetched;
      } catch {
        setError('Không thể mở đơn hàng.');
        return null;
      } finally {
        if (lockOwnerRef.current === opId) {
          actionLockRef.current = false;
          lockOwnerRef.current = null;
        }
        setBusy(false);
      }
    },
    [loadTerms, user?.id],
  );

  const recoverPendingIntent = useCallback(
    async (
      planId: string,
      draftId?: string,
      deviceQuantity?: number,
      durationMonths?: number,
    ): Promise<RecoveryResult> => {
      if (!user?.id || initialOrderId || order) return 'none';
      if (actionLockRef.current && !recoveringRef.current) return 'none';

      const opId = ++nextLockIdRef.current;
      const gen = ++recoveryGenerationRef.current;
      actionLockRef.current = true;
      lockOwnerRef.current = opId;
      recoveringRef.current = true;
      recoveryBlockedRef.current = false;
      setRecovering(true);
      setRecoveryError(null);

      try {
        const intent = await readCheckoutIntent(user.id, {
          planId,
          ...(draftId ? { draftId } : {}),
          ...(deviceQuantity !== undefined ? { deviceQuantity } : {}),
          ...(durationMonths !== undefined ? { durationMonths } : {}),
        });
        if (recoveryGenerationRef.current !== gen || !intent) return 'none';

        const fetched = await getOrder(intent.orderId);
        if (recoveryGenerationRef.current !== gen) return 'none';
        if (fetched.orderType === 'RENEWAL') return 'none';
        if (TERMINAL_CHECKOUT_STATUSES.has(fetched.orderStatus)) {
          await clearCheckoutIntent(user.id, intent.orderId);
          return 'none';
        }
        setOrder(fetched);
        if (fetched.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE') {
          await loadTerms(fetched.id);
        }
        return 'recovered';
      } catch {
        if (recoveryGenerationRef.current !== gen) return 'none';
        recoveryBlockedRef.current = true;
        setRecoveryError('Không thể kiểm tra đơn hàng chưa hoàn tất. Vui lòng thử lại.');
        return 'error';
      } finally {
        if (lockOwnerRef.current === opId) {
          actionLockRef.current = false;
          lockOwnerRef.current = null;
        }
        if (recoveryGenerationRef.current === gen) {
          recoveringRef.current = false;
          setRecovering(false);
        }
      }
    },
    [initialOrderId, loadTerms, order, user?.id],
  );

  useEffect(() => {
    if (initialOrderId) {
      void resumeOrder(initialOrderId);
    }
  }, [initialOrderId, resumeOrder]);

  const prepareOrder = useCallback(
    async (
      input: CreateOrderDto,
      draftId?: string,
    ): Promise<MobileOrderDetail | null> => {
      if (actionLockRef.current || recoveringRef.current || recoveryBlockedRef.current) {
        return null;
      }
      const opId = ++nextLockIdRef.current;
      actionLockRef.current = true;
      lockOwnerRef.current = opId;
      setBusy(true);
      setError(null);
      try {
        const created = userId
          ? await createOrder(input, undefined, { userId, ...(draftId ? { draftId } : {}) })
          : await createOrder(input);
        setOrder(created);
        if (created.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE') {
          await loadTerms(created.id);
        }
        return created;
      } catch (cause) {
        if (cause instanceof MobileApiError && cause.status === 404) {
          setError('Gói bản quyền không còn khả dụng. Vui lòng chọn lại gói.');
        } else {
          setError('Không thể tạo đơn hàng. Bạn có thể thử lại an toàn.');
        }
        return null;
      } finally {
        if (lockOwnerRef.current === opId) {
          actionLockRef.current = false;
          lockOwnerRef.current = null;
        }
        setBusy(false);
      }
    },
    [loadTerms, userId],
  );

  const acceptTerms = useCallback(async (): Promise<MobileOrderDetail | null> => {
    if (
      actionLockRef.current ||
      !order ||
      !accepted ||
      !terms ||
      termsState !== 'ready'
    ) {
      return null;
    }
    actionLockRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const updated = await acceptServiceTerms(order, terms);
      setOrder(updated);
      if (TERMINAL_CHECKOUT_STATUSES.has(updated.orderStatus)) {
        await clearCheckoutIntent(user?.id, updated.id);
      }
      return updated;
    } catch (cause) {
      if (cause instanceof MobileApiError && cause.status === 409) {
        const refreshed = await getOrder(order.id).catch(() => null);
        let reloadedTerms: MobileOrderTerms | null = null;
        if (refreshed) {
          setOrder(refreshed);
          if (TERMINAL_CHECKOUT_STATUSES.has(refreshed.orderStatus)) {
            await clearCheckoutIntent(user?.id, refreshed.id);
          } else if (refreshed.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE') {
            reloadedTerms = await loadTerms(refreshed.id);
          }
        }
        if (!refreshed || refreshed.orderStatus !== 'WAITING_SERVICE_TERMS_ACCEPTANCE' || reloadedTerms) {
          setError('Trạng thái đơn hoặc phiên bản điều khoản đã thay đổi. Đã tải lại thông tin mới nhất.');
        }
      } else {
        setError('Không thể xác nhận điều khoản của đơn hàng.');
      }
      return null;
    } finally {
      actionLockRef.current = false;
      setBusy(false);
    }
  }, [accepted, order, terms, termsState, user?.id]);

  const resetOrder = useCallback(() => {
    setOrder(null);
    setTerms(null);
    setTermsState('idle');
    setAccepted(false);
    setError(null);
    lastTermsIdentityRef.current = '';
  }, []);

  return {
    order,
    terms,
    termsState,
    accepted,
    setAccepted,
    busy,
    recovering,
    recoveryError,
    error,
    setError,
    loadTerms,
    resumeOrder,
    recoverPendingIntent,
    prepareOrder,
    acceptTerms,
    resetOrder,
  };
}
