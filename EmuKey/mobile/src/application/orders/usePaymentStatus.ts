import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import {
  createCheckout,
  getLicense,
  getOrder,
  getPaymentRetryDecision,
  listPaymentHistory,
  type MobileCheckoutSession,
  type MobileLicense,
  type MobileOrderDetail,
} from '../../infrastructure/api/client';
import type {
  PaymentHistoryDto,
  PaymentRetryDecisionDto,
} from '../../infrastructure/api/generated';
import { clearCheckoutIntent } from '../../infrastructure/checkout-intent';
import { useCustomerSession } from '../auth/useCustomerSession';
import { providerHandoffLabel, providerLicenseReady } from '../licenses/licensePresentation';
import { matchesPaymentReturn } from './sepayHelpers';

const POLL_INTERVAL_MS = 5_000;

export function usePaymentStatus(orderId: string, activeScreen = true) {
  const { user } = useCustomerSession();
  const [order, setOrder] = useState<MobileOrderDetail | null>(null);
  const [license, setLicense] = useState<MobileLicense | null>(null);
  const [checkout, setCheckout] = useState<MobileCheckoutSession | null>(null);
  const [decision, setDecision] = useState<PaymentRetryDecisionDto | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [licenseReady, setLicenseReady] = useState(false);
  const [licenseProgress, setLicenseProgress] = useState<string | null>(null);

  const checkoutRef = useRef<MobileCheckoutSession | null>(null);
  checkoutRef.current = checkout;
  const generationRef = useRef(0);
  const nextRefresh = useRef(0);
  const appliedRefresh = useRef(0);

  const refresh = useCallback(async () => {
    const gen = generationRef.current;
    const refreshId = ++nextRefresh.current;
    const canApply = () =>
      gen === generationRef.current && refreshId > appliedRefresh.current;
    try {
      const value = await getOrder(orderId);
      if (!canApply()) return;

      const [nextDecision, historyRows] =
        value.orderStatus === 'WAITING_PAYMENT'
          ? await Promise.all([
              getPaymentRetryDecision(value.id),
              listPaymentHistory().catch(() => [] as PaymentHistoryDto[]),
            ])
          : [null, [] as PaymentHistoryDto[]];
      if (!canApply()) return;

      let ready = false;
      let progress: string | null = null;
      let loadedLicense: MobileLicense | null = null;

      if (value.orderStatus === 'PAYMENT_ACCEPTED') {
        if (
          value.orderType === 'RENEWAL' &&
          value.targetLicenseId &&
          value.renewalStatus === 'CONFIRMED' &&
          value.renewalExpiresAt
        ) {
          loadedLicense = await getLicense(value.targetLicenseId);
          const expiryUpdated =
            Math.floor(Date.parse(loadedLicense.expiresAt) / 1000) >=
            Math.floor(Date.parse(value.renewalExpiresAt) / 1000);
          if (loadedLicense.fulfillmentMode === 'PROVIDER_HANDOFF') {
            progress = providerHandoffLabel(
              expiryUpdated
                ? loadedLicense
                : {
                    ...loadedLicense,
                    status: 'PENDING_ONCHAIN',
                    activationKeyTrustStatus: 'PENDING_FINALITY',
                  },
            );
          }
          ready =
            providerLicenseReady(loadedLicense) &&
            loadedLicense.status === 'ACTIVE' &&
            loadedLicense.activationKeyTrustStatus === 'TRUSTED' &&
            ['CONFIRMED', 'CHAIN_CONFIRMED'].includes(loadedLicense.finality) &&
            expiryUpdated;
        } else if (value.licenseId) {
          loadedLicense = await getLicense(value.licenseId);
          if (loadedLicense.fulfillmentMode === 'PROVIDER_HANDOFF') {
            progress = providerHandoffLabel(loadedLicense);
          }
          ready =
            providerLicenseReady(loadedLicense) &&
            loadedLicense.status === 'ACTIVE' &&
            loadedLicense.activationKeyTrustStatus === 'TRUSTED' &&
            ['CONFIRMED', 'CHAIN_CONFIRMED'].includes(loadedLicense.finality);
        }
      }

      if (!canApply()) return;
      if (
        value.orderStatus === 'PAYMENT_ACCEPTED' ||
        value.orderStatus === 'CANCELLED' ||
        value.orderStatus === 'EXPIRED'
      ) {
        void clearCheckoutIntent(user?.id, value.id);
      }
      appliedRefresh.current = refreshId;
      setOrder(value);
      setDecision(nextDecision);
      setPaymentHistory(
        historyRows.filter((item) => item.orderId === value.id),
      );
      setLicense(loadedLicense);
      setLicenseReady(ready);
      setLicenseProgress(progress);
      setError(null);
    } catch {
      if (!canApply()) return;
      appliedRefresh.current = refreshId;
      setDecision(null);
      setError('Không thể cập nhật trạng thái đơn hàng.');
    } finally {
      if (gen === generationRef.current && refreshId === appliedRefresh.current) {
        setLoading(false);
      }
    }
  }, [orderId, user?.id]);

  const handlePaymentReturn = useCallback(
    (url: string): boolean => {
      if (
        !matchesPaymentReturn(
          url,
          orderId,
          checkoutRef.current?.checkoutFields.success_url,
        )
      ) {
        return false;
      }
      setCheckout(null);
      setError(
        'Đã quay lại từ cổng thanh toán. Hệ thống đang kiểm tra trạng thái đơn từ backend.',
      );
      void refresh();
      return true;
    },
    [orderId, refresh],
  );

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handlePaymentReturn(url);
    });
    void Promise.resolve(Linking.getInitialURL?.())
      .then((url) => {
        if (url) handlePaymentReturn(url);
      })
      .catch(() => undefined);
    return () => subscription?.remove?.();
  }, [handlePaymentReturn]);

  const isTerminal =
    order?.orderStatus === 'CANCELLED' ||
    order?.orderStatus === 'EXPIRED' ||
    (order?.orderStatus === 'PAYMENT_ACCEPTED' && licenseReady);

  useEffect(() => {
    const invalidateRefresh = () => {
      generationRef.current += 1;
    };
    setLoading(true);
    void refresh();
    if (!activeScreen || isTerminal) return invalidateRefresh;

    const timer = setInterval(() => {
      if (AppState.currentState !== 'background') {
        void refresh();
      }
    }, POLL_INTERVAL_MS);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      invalidateRefresh();
      clearInterval(timer);
      foreground?.remove?.();
    };
  }, [activeScreen, isTerminal, orderId, refresh]);

  const openCheckout = useCallback(async (): Promise<MobileCheckoutSession | null> => {
    if (busy) return null;
    setBusy(true);
    setError(null);
    try {
      const latest = await getPaymentRetryDecision(orderId);
      setDecision(latest);
      if (!latest.allowed && !latest.canResume) {
        return null;
      }
      const session = await createCheckout(orderId);
      if (!session.checkoutUrl.startsWith('https://')) {
        throw new Error('UNSAFE_CHECKOUT_URL');
      }
      setCheckout(session);
      return session;
    } catch {
      setDecision(null);
      setError('Không thể tạo phiên thanh toán SePay.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [busy, orderId]);

  const closeCheckout = useCallback(() => {
    setCheckout(null);
    setDecision(null);
    void refresh();
  }, [refresh]);

  const hasOpenReview = paymentHistory.some((item) => item.reviewStatus === 'OPEN');

  return {
    order,
    license,
    checkout,
    decision,
    paymentHistory,
    hasOpenReview,
    loading,
    busy,
    error,
    licenseReady,
    licenseProgress,
    refresh,
    openCheckout,
    closeCheckout,
    handlePaymentReturn,
  };
}
