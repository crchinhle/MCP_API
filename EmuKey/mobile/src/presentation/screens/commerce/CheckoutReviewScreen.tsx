import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useCart } from '../../../application/cart/cartContext';
import { useCheckoutOrder } from '../../../application/orders/useCheckout';
import { orderStatusLabel } from '../../../application/orders/orderPresentation';
import type { CreateOrderDto } from '../../../infrastructure/api/generated';
import { KeyValueList } from '../../components/KeyValueList';
import { TermsAcceptance } from '../../components/TermsAcceptance';
import { AppHeader } from '../../components/layout/AppHeader';
import { BottomActionBar } from '../../components/layout/BottomActionBar';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatDateTimeVi, formatPlanDisplayName, formatVnd } from '../../formatters';
import { spacing } from '../../theme/tokens';

export interface CheckoutReviewScreenProps {
  readonly draftId?: string;
  readonly orderId?: string;
  readonly productId?: string;
  readonly planId?: string;
  readonly productName?: string;
  readonly planName?: string;
  readonly priceVnd?: number;
  readonly deviceQuantity?: number;
  readonly durationMonths?: 1 | 2 | 3 | 6 | 12;
  readonly customized?: boolean;
  readonly onBack: () => void;
  readonly onOpenTerms: (orderId: string) => void;
  readonly onOpenPayment: (orderId: string) => void;
}

export function CheckoutReviewScreen({
  draftId,
  orderId,
  planId,
  productName,
  planName,
  priceVnd,
  deviceQuantity,
  durationMonths,
  customized = false,
  onBack,
  onOpenTerms,
  onOpenPayment,
}: CheckoutReviewScreenProps) {
  const { attachOrderToDraft } = useCart();
  const { order, busy, recovering, recoveryError, error, prepareOrder, recoverPendingIntent } =
    useCheckoutOrder(orderId);
  const [priceAckRequired, setPriceAckRequired] = useState(false);

  useEffect(() => {
    if (!orderId && planId) {
      void recoverPendingIntent(planId, draftId, customized ? deviceQuantity : undefined, customized ? durationMonths : undefined);
    }
  }, [customized, deviceQuantity, draftId, durationMonths, orderId, planId, recoverPendingIntent]);

  const priceChanged = Boolean(
    order && typeof priceVnd === 'number' && order.priceVndSnapshot !== priceVnd,
  );

  useEffect(() => {
    if (priceChanged) setPriceAckRequired(true);
  }, [priceChanged]);

  const confirmConfiguration = async () => {
    if (order) {
      if (order.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE') {
        onOpenTerms(order.id);
      } else {
        onOpenPayment(order.id);
      }
      return;
    }
    if (!planId) return;
    const payload: CreateOrderDto = {
      planId,
      ...(customized && deviceQuantity ? { deviceQuantity } : {}),
      ...(customized && durationMonths ? { durationMonths } : {}),
    };
    const created = await prepareOrder(payload, draftId);
    if (!created) return;
    if (draftId) {
      await attachOrderToDraft(draftId, created.id);
    }
    if (typeof priceVnd === 'number' && created.priceVndSnapshot !== priceVnd) {
      // Price changed on server: pause here so buyer explicitly reviews new snapshot.
      setPriceAckRequired(true);
      return;
    }
    if (created.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE') {
      onOpenTerms(created.id);
    } else if (
      created.orderStatus === 'WAITING_PAYMENT' ||
      created.orderStatus === 'PAYMENT_ACCEPTED'
    ) {
      onOpenPayment(created.id);
    }
  };

  const snapshot = order?.purchaseSnapshot;
  const basePlanPrice = snapshot?.basePriceVnd ?? priceVnd;
  const basePriceChanged = Boolean(
    order &&
      snapshot &&
      typeof priceVnd === 'number' &&
      snapshot.basePriceVnd !== priceVnd,
  );
  const isConfigCalculated = Boolean(
    order && priceChanged && customized && !basePriceChanged,
  );

  return (
    <Screen
      footer={
        <BottomActionBar
          primary={
            <AppButton
              disabled={recovering || Boolean(recoveryError) || (!order && !planId)}
              label={
                order
                  ? order.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE'
                    ? 'Đọc & đồng ý điều khoản'
                    : 'Xem thanh toán'
                  : 'Xác nhận cấu hình'
              }
              loading={busy || recovering}
              onPress={() => void confirmConfiguration()}
              size="large"
            />
          }
          summaryLabel={
            order
              ? 'Tổng thanh toán chính thức'
              : customized
                ? `Tổng theo ${deviceQuantity ?? '—'} thiết bị · ${durationMonths ?? '—'} tháng xác nhận khi tạo đơn`
                : 'Giá gói tham khảo'
          }
          summaryValue={
            order
              ? formatVnd(order.priceVndSnapshot)
              : !customized && typeof priceVnd === 'number'
                ? formatVnd(priceVnd)
                : undefined
          }
        />
      }
      header={<AppHeader onBack={onBack} title="Xác nhận đơn hàng" />}
    >
      <SurfaceCard>
        <AppText variant="cardTitle">
          {order ? order.productNameSnapshot : productName ?? 'Sản phẩm bản quyền'}
        </AppText>
        <AppText tone="secondary" variant="secondary">
          {formatPlanDisplayName(order ? order.planNameSnapshot : planName ?? 'Gói đã chọn')}
        </AppText>
        {order ? (
          <AppText tone="primary" variant="priceDetail">
            {formatVnd(order.priceVndSnapshot)}
          </AppText>
        ) : !customized && typeof priceVnd === 'number' ? (
          <AppText tone="primary" variant="priceDetail">
            {formatVnd(priceVnd)}
          </AppText>
        ) : null}

        <KeyValueList
          rows={[
            ...(order
              ? [
                  { label: 'Mã đơn hàng', value: order.orderNumber, mono: true },
                  { label: 'Nhà cung cấp', value: order.providerNameSnapshot },
                  { label: 'Trạng thái', value: orderStatusLabel(order.orderStatus) },
                  { label: 'Hạn thanh toán', value: formatDateTimeVi(order.paymentDueAt) },
                ]
              : []),
            ...(snapshot
              ? [
                  { label: 'Người mua', value: `${snapshot.buyerName} (${snapshot.buyerEmail})` },
                  { label: 'Giá gói gốc', value: formatVnd(snapshot.basePriceVnd) },
                ]
              : typeof priceVnd === 'number' && (order || customized)
                ? [{ label: 'Giá gói gốc (tham khảo)', value: formatVnd(priceVnd) }]
                : []),
            {
              label: 'Cấu hình đã chọn',
              value: `${order ? order.maxActiveDevicesSnapshot : deviceQuantity ?? '—'} thiết bị · ${order ? order.durationMonthsSnapshot : durationMonths ?? '—'} tháng`,
            },
          ]}
        />
      </SurfaceCard>

      {priceAckRequired && order ? (
        <InlineNotice
          message={
            isConfigCalculated
              ? `Tổng thanh toán theo cấu hình (${order.maxActiveDevicesSnapshot} thiết bị · ${order.durationMonthsSnapshot} tháng) là ${formatVnd(order.priceVndSnapshot)} (giá gói cơ bản: ${formatVnd(basePlanPrice ?? order.priceVndSnapshot)}). Vui lòng xác nhận trước khi tiếp tục.`
              : `Giá thanh toán của gói đã cập nhật thành ${formatVnd(order.priceVndSnapshot)} so với mức tham khảo trước đó (${formatVnd(priceVnd ?? order.priceVndSnapshot)}). Vui lòng kiểm tra lại trước khi tiếp tục.`
          }
          title={isConfigCalculated ? 'Đã tính giá theo cấu hình' : 'Giá gói đã cập nhật'}
          tone={isConfigCalculated ? 'info' : 'warning'}
        />
      ) : null}

      {!order ? (
        <InlineNotice
          message={
            customized && deviceQuantity && durationMonths
              ? `Tổng thanh toán chính thức cho cấu hình ${deviceQuantity} thiết bị · ${durationMonths} tháng sẽ được xác nhận khi nhấn "Xác nhận cấu hình".`
              : 'Nhấn "Xác nhận cấu hình" để tạo đơn hàng và nhận tổng thanh toán chính thức.'
          }
          tone="info"
        />
      ) : null}

      {recovering ? (
        <InlineNotice
          message="Đang kiểm tra đơn hàng chưa hoàn tất..."
          tone="info"
        />
      ) : null}

      {recoveryError ? (
        <InlineNotice
          actionLabel="Thử lại"
          actionLoading={recovering}
          message={recoveryError}
          onAction={() => {
            if (planId) {
              void recoverPendingIntent(planId, draftId, customized ? deviceQuantity : undefined, customized ? durationMonths : undefined);
            }
          }}
          tone="error"
        />
      ) : null}

      {error ? <InlineNotice message={error} tone="error" /> : null}
    </Screen>
  );
}

/**
 * Legacy compatibility wrapper for the `Checkout` route and existing tests.
 */
export function CheckoutScreen({
  navigation,
  route,
}: {
  readonly navigation: { replace: (screen: 'Payment', params: { orderId: string }) => void; goBack?: () => void };
  readonly route: {
    params: {
      orderId?: string;
      planId: string;
      planName: string;
      priceVnd: number;
      productName: string;
    };
  };
}) {
  const {
    order,
    terms,
    termsState,
    accepted,
    setAccepted,
    busy,
    error,
    loadTerms,
    prepareOrder,
    resumeOrder,
    acceptTerms,
  } = useCheckoutOrder();

  const startOrder = async () => {
    const result = route.params.orderId
      ? await resumeOrder(route.params.orderId)
      : await prepareOrder({ planId: route.params.planId });
    if (
      result &&
      (result.orderStatus === 'WAITING_PAYMENT' ||
        result.orderStatus === 'PAYMENT_ACCEPTED')
    ) {
      navigation.replace('Payment', { orderId: result.id });
    }
  };

  const continueToPayment = async () => {
    const updated = await acceptTerms();
    if (updated) navigation.replace('Payment', { orderId: updated.id });
  };

  return (
    <Screen
      header={
        <AppHeader
          onBack={navigation.goBack}
          title="Hoàn tất mua bản quyền"
        />
      }
    >
      <SurfaceCard>
        <AppText variant="cardTitle">
          {order ? order.productNameSnapshot : route.params.productName}
        </AppText>
        <AppText tone="secondary" variant="secondary">
          {order ? order.planNameSnapshot : route.params.planName}
        </AppText>
        <AppText tone="primary" variant="priceDetail">
          {formatVnd(order ? order.priceVndSnapshot : route.params.priceVnd)}
        </AppText>
        {order && order.priceVndSnapshot !== route.params.priceVnd ? (
          <InlineNotice
            message={`Tổng thanh toán đã cập nhật theo đơn hàng: ${formatVnd(order.priceVndSnapshot)}.`}
            tone="warning"
          />
        ) : null}
      </SurfaceCard>

      {!order ? (
        <AppButton
          label="Tiếp tục"
          loading={busy}
          onPress={() => void startOrder()}
          size="large"
        />
      ) : order.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' ? (
        <View style={styles.termsBlock}>
          <TermsAcceptance
            accepted={accepted}
            disabled={busy}
            onChangeAccepted={setAccepted}
            onRetry={() => void loadTerms(order.id)}
            state={termsState}
            terms={terms}
          />
          <AppButton
            disabled={busy || termsState !== 'ready' || !accepted}
            label="Tiếp tục thanh toán"
            loading={busy}
            onPress={() => void continueToPayment()}
            size="large"
          />
        </View>
      ) : (
        <InlineNotice message={orderStatusLabel(order.orderStatus)} tone="info" />
      )}

      {error ? <InlineNotice message={error} tone="error" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  termsBlock: {
    gap: spacing.md,
  },
});
