import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import {
  paymentClassificationLabel,
  paymentClassificationTone,
  paymentReviewLabel,
} from '../../../application/orders/orderPresentation';
import { usePaymentHistory } from '../../../application/orders/usePaymentHistory';
import type { PaymentHistoryDto } from '../../../infrastructure/api/generated';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatDateTimeVi, formatVnd } from '../../formatters';
import { colors, spacing } from '../../theme/tokens';

export interface PaymentHistoryScreenProps {
  readonly onBack: () => void;
  readonly onOpenOrderDetail: (orderId: string) => void;
}

function PaymentHistoryCard({
  item,
  onOpenOrderDetail,
}: {
  readonly item: PaymentHistoryDto;
  readonly onOpenOrderDetail: (orderId: string) => void;
}) {
  const reviewLabel = paymentReviewLabel(item.reviewStatus);
  const orderLabel = item.orderNumber ?? 'Chưa gắn đơn';
  const productLabel = item.productNameSnapshot ?? 'Chưa xác định';
  const orderTypeLabel =
    item.orderType === 'RENEWAL'
      ? 'Gia hạn'
      : item.orderType === 'NEW_PURCHASE'
        ? 'Mua mới'
        : null;

  return (
    <SurfaceCard
      onPress={item.orderId ? () => onOpenOrderDetail(item.orderId!) : undefined}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <AppText variant="cardTitle">{productLabel}</AppText>
          {item.planNameSnapshot ? (
            <AppText tone="secondary" variant="secondary">
              {item.planNameSnapshot}
              {orderTypeLabel ? ` · ${orderTypeLabel}` : ''}
            </AppText>
          ) : orderTypeLabel ? (
            <AppText tone="secondary" variant="secondary">
              {orderTypeLabel}
            </AppText>
          ) : null}
        </View>
        <StatusBadge
          label={paymentClassificationLabel(item.classification)}
          tone={paymentClassificationTone(item.classification)}
        />
      </View>

      <View style={styles.metaBlock}>
        <AppText tone="secondary" variant="secondary">
          Mã đơn: {orderLabel}
        </AppText>
        <AppText tone="secondary" variant="secondary">
          Thời điểm: {formatDateTimeVi(item.providerOccurredAt)}
        </AppText>
        {item.providerTransactionReference ? (
          <AppText tone="secondary" variant="secondary">
            Mã tham chiếu: {item.providerTransactionReference}
          </AppText>
        ) : null}
        {reviewLabel ? (
          <AppText tone="muted" variant="secondary">
            Kiểm tra: {reviewLabel}
          </AppText>
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <AppText variant="priceCard">{formatVnd(item.amountVnd)}</AppText>
        {item.orderId ? (
          <AppButton
            label="Xem đơn hàng"
            onPress={() => onOpenOrderDetail(item.orderId!)}
            variant="secondary"
          />
        ) : null}
      </View>
    </SurfaceCard>
  );
}

export function PaymentHistoryScreen({
  onBack,
  onOpenOrderDetail,
}: PaymentHistoryScreenProps) {
  const { items, loading, refreshing, error, refreshError, reload, refresh } =
    usePaymentHistory();

  return (
    <Screen
      header={<AppHeader onBack={onBack} title="Lịch sử thanh toán" />}
      padded={false}
      scroll="none"
    >
      {loading && items.length === 0 ? (
        <FeedbackState mode="loading" title="Đang tải lịch sử thanh toán..." />
      ) : error && items.length === 0 ? (
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reload()}
          title={error}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.transactionId}
          ListHeaderComponent={
            refreshError && items.length > 0 ? (
              <InlineNotice
                actionLabel="Thử lại"
                actionLoading={refreshing}
                message={refreshError}
                onAction={() => void refresh()}
                tone="warning"
              />
            ) : null
          }
          ListEmptyComponent={
            <FeedbackState
              description="Các giao dịch thanh toán đã ghi nhận sẽ hiển thị tại đây."
              mode="empty"
              title="Chưa có giao dịch thanh toán"
            />
          }
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={() => void refresh()}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <PaymentHistoryCard
              item={item}
              onOpenOrderDetail={onOpenOrderDetail}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xxs,
  },
  metaBlock: {
    gap: spacing.xxs,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
});
