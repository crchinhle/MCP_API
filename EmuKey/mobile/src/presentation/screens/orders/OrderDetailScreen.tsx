import * as Clipboard from 'expo-clipboard';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../../navigation/navigationTypes';

import {
  canCancelOrder,
  formatEntitlementsList,
  orderStatusLabel,
  orderStatusTone,
} from '../../../application/orders/orderPresentation';
import { useOrderDetail } from '../../../application/orders/useOrders';
import { createConversation } from '../../../infrastructure/api/client';
import { KeyValueList } from '../../components/KeyValueList';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatDateTimeVi, formatVnd } from '../../formatters';
import { spacing } from '../../theme/tokens';

export interface OrderDetailScreenProps {
  readonly route: { params: { id: string } };
  readonly navigation: Pick<
    NativeStackNavigationProp<RootStackParamList>,
    'navigate'
  > & {
    goBack?: () => void;
  };
  readonly onRequestSupport?: (orderId: string, orderNumber: string) => void;
  readonly onOpenTerms?: (orderId: string) => void;
  readonly onOpenPayment?: (orderId: string) => void;
  readonly onOpenLicense?: (licenseId: string) => void;
}

export function OrderDetailScreen({
  route,
  navigation,
  onRequestSupport,
  onOpenTerms,
  onOpenPayment,
  onOpenLicense,
}: OrderDetailScreenProps) {
  const {
    order,
    loading,
    error,
    cancelling,
    cancelError,
    clearCancelError,
    reload,
    cancel,
  } = useOrderDetail(route.params.id);

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [copiedOrderNumber, setCopiedOrderNumber] = useState(false);
  const [supportPending, setSupportPending] = useState(false);
  const [supportError, setSupportError] = useState(false);

  const handleRequestSupport = async () => {
    if (!order || supportPending) return;
    if (onRequestSupport) {
      onRequestSupport(order.id, order.orderNumber);
      return;
    }
    setSupportPending(true);
    setSupportError(false);
    try {
      const conversation = await createConversation(
        `Hỗ trợ đơn ${order.orderNumber}`,
        order.id,
      );
      navigation.navigate('Assistance', { conversationId: conversation.id });
    } catch {
      setSupportError(true);
    } finally {
      setSupportPending(false);
    }
  };

  if (loading && !order) {
    return (
      <Screen header={<AppHeader onBack={navigation.goBack} title="Chi tiết đơn hàng" />}>
        <FeedbackState mode="loading" title="Đang tải đơn hàng..." />
      </Screen>
    );
  }

  if (error || !order) {
    return (
      <Screen header={<AppHeader onBack={navigation.goBack} title="Chi tiết đơn hàng" />}>
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reload()}
          title={error ?? 'Không thể tải đơn hàng.'}
        />
      </Screen>
    );
  }

  const entitlements = formatEntitlementsList(order.entitlementsSnapshot).filter(
    (item) => item.included,
  );
  const relatedLicenseId = order.licenseId ?? order.targetLicenseId;

  return (
    <Screen
      header={
        <AppHeader
          onBack={navigation.goBack}
          title="Chi tiết đơn hàng"
        />
      }
    >
      <SurfaceCard>
        <View style={styles.headerRow}>
          <View style={styles.headerCol}>
            <AppText accessibilityRole="header" selectable variant="sectionTitle">
              {order.orderNumber}
            </AppText>
            <AppText variant="cardTitle">{order.productNameSnapshot}</AppText>
            <AppText tone="secondary" variant="secondary">
              {order.planNameSnapshot} · phiên bản {order.planVersionSnapshot}
            </AppText>
          </View>
          <StatusBadge
            label={orderStatusLabel(order.orderStatus)}
            tone={orderStatusTone(order.orderStatus)}
          />
        </View>

        <View style={styles.copyOrderRow}>
          <AppButton
            icon="copy"
            label={copiedOrderNumber ? 'Đã chép mã đơn' : 'Sao chép mã đơn'}
            onPress={() => {
              void Clipboard.setStringAsync(order.orderNumber).then(() => {
                setCopiedOrderNumber(true);
              });
            }}
            variant="tertiary"
          />
        </View>

        <AppText tone="primary" variant="priceDetail">
          {formatVnd(order.priceVndSnapshot)}
        </AppText>

        <KeyValueList
          rows={[
            { label: 'Nhà cung cấp', value: order.providerNameSnapshot },
            {
              label: 'Loại đơn',
              value:
                order.orderType === 'RENEWAL'
                  ? 'Gia hạn bản quyền'
                  : 'Mua bản quyền mới',
            },
            { label: 'Thời hạn', value: `${order.durationMonthsSnapshot} tháng` },
            {
              label: 'Số thiết bị tối đa',
              value: `${order.maxActiveDevicesSnapshot} thiết bị`,
            },
            { label: 'Ngày tạo đơn', value: formatDateTimeVi(order.createdAt) },
            { label: 'Hạn thanh toán', value: formatDateTimeVi(order.paymentDueAt) },
            {
              label: 'Điều khoản dịch vụ',
              value: order.serviceTermsAcceptedAt
                ? `Đã đồng ý lúc ${formatDateTimeVi(order.serviceTermsAcceptedAt)}`
                : 'Chưa đồng ý',
            },
          ]}
        />
      </SurfaceCard>

      {entitlements.length > 0 ? (
        <SurfaceCard>
          <AppText variant="cardTitle">Quyền lợi trong snapshot</AppText>
          {entitlements.map((item) => (
            <AppText key={item.key} tone="secondary" variant="secondary">
              • {item.label}
            </AppText>
          ))}
        </SurfaceCard>
      ) : null}

      <View style={styles.actions}>
        {order.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' ? (
          <AppButton
            fullWidth
            label="Tiếp tục mua hàng"
            onPress={() => {
              if (onOpenTerms) onOpenTerms(order.id);
              else {
                navigation.navigate('Checkout', {
                  orderId: order.id,
                  planId: order.planId,
                  planName: order.planNameSnapshot,
                  productName: order.productNameSnapshot,
                  priceVnd: order.priceVndSnapshot,
                });
              }
            }}
            size="large"
          />
        ) : null}

        {order.orderStatus === 'WAITING_PAYMENT' ||
        order.orderStatus === 'PAYMENT_ACCEPTED' ? (
          <AppButton
            fullWidth
            label="Xem trạng thái thanh toán"
            onPress={() => {
              if (onOpenPayment) onOpenPayment(order.id);
              else navigation.navigate('Payment', { orderId: order.id });
            }}
            size="large"
          />
        ) : null}

        {relatedLicenseId ? (
          <AppButton
            fullWidth
            icon="license"
            label="Xem bản quyền liên quan"
            onPress={() => {
              if (onOpenLicense) onOpenLicense(relatedLicenseId);
              else navigation.navigate('LicenseDetail', { licenseId: relatedLicenseId });
            }}
            variant="secondary"
          />
        ) : null}

        <AppButton
          disabled={supportPending}
          fullWidth
          icon="support"
          label="Cần hỗ trợ về đơn này"
          loading={supportPending}
          onPress={() => void handleRequestSupport()}
          variant="secondary"
        />

        {supportError ? (
          <InlineNotice
            message="Không thể mở hội thoại hỗ trợ. Vui lòng thử lại."
            tone="error"
          />
        ) : null}

        {canCancelOrder(order) ? (
          <AppButton
            disabled={cancelling}
            fullWidth
            label="Hủy đơn hàng"
            onPress={() => {
              clearCancelError();
              setConfirmCancelOpen(true);
            }}
            variant="tertiary"
          />
        ) : null}
      </View>

      <ConfirmDialog
        body={`Bạn muốn hủy đơn ${order.orderNumber}? Yêu cầu thanh toán đang chờ sẽ ngừng hiệu lực.`}
        cancelLabel="Giữ đơn"
        confirmLabel="Hủy đơn"
        danger
        errorText={cancelError}
        onCancel={() => setConfirmCancelOpen(false)}
        onConfirm={() => {
          void cancel().then((updated) => {
            if (updated) setConfirmCancelOpen(false);
          });
        }}
        pending={cancelling}
        title="Xác nhận hủy đơn hàng"
        visible={confirmCancelOpen}
        warningText="Nếu đã chuyển tiền, hãy giữ đơn và liên hệ hỗ trợ để kiểm tra giao dịch."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  headerCol: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 160,
  },
  copyOrderRow: {
    alignItems: 'flex-start',
  },
  actions: {
    gap: spacing.sm,
  },
});
