import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { useCart } from '../../../application/cart/cartContext';
import { useCatalogProducts } from '../../../application/catalog/useCatalog';
import type { CartDraft } from '../../../infrastructure/cart-storage';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatPlanDisplayName, formatVnd } from '../../formatters';
import { spacing } from '../../theme/tokens';

export interface CartScreenProps {
  readonly onOpenNotifications: () => void;
  readonly onBrowseCatalog: () => void;
  readonly onEditDraft: (draft: CartDraft) => void;
  readonly onCheckoutDraft: (draft: CartDraft, customized?: boolean) => void;
  readonly onResumeOrder: (orderId: string) => void;
}

export function CartScreen({
  onOpenNotifications,
  onBrowseCatalog,
  onEditDraft,
  onCheckoutDraft,
  onResumeOrder,
}: CartScreenProps) {
  const { items, loaded, storageError, removeDraft, clearCart, retryStorage } = useCart();
  const catalog = useCatalogProducts();
  const [confirmClear, setConfirmClear] = useState(false);

  const planLookup = useMemo(() => {
    const map = new Map<
      string,
      {
        priceVnd: number;
        productName: string;
        planName: string;
        maxActiveDevices: number;
        durationMonths: number;
      }
    >();
    for (const product of catalog.products) {
      for (const plan of product.plans) {
        map.set(plan.id, {
          priceVnd: plan.priceVnd,
          productName: product.name,
          planName: plan.name,
          maxActiveDevices: plan.maxActiveDevices,
          durationMonths: plan.durationMonths,
        });
      }
    }
    return map;
  }, [catalog.products]);

  const catalogReady = !catalog.loading && !catalog.error;

  return (
    <Screen
      header={
        <AppHeader
          onNotifications={onOpenNotifications}
          showBell
          title="Giỏ hàng"
          trailing={
            items.length > 0 ? (
              <AppButton
                label="Xóa hết"
                onPress={() => setConfirmClear(true)}
                variant="tertiary"
              />
            ) : undefined
          }
        />
      }
      padded={false}
      scroll="none"
    >
      <View style={styles.noticeWrap}>
        <InlineNotice
          message="Lưu lựa chọn trên thiết bị theo tài khoản hiện tại và tự xóa khi đăng xuất. Thanh toán từng gói."
          tone="info"
        />
        {storageError ? (
          <InlineNotice
            actionLabel="Thử lại"
            message={storageError}
            onAction={() => void retryStorage()}
            tone="error"
          />
        ) : null}
      </View>

      {!loaded ? (
        <FeedbackState mode="loading" title="Đang tải giỏ hàng..." />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <FeedbackState
              actionLabel="Khám phá sản phẩm"
              description="Lưu các cấu hình gói bạn muốn mua để so sánh và thanh toán từng gói."
              icon="cart"
              mode="empty"
              onAction={onBrowseCatalog}
              title="Chưa có gói được lưu"
            />
          }
          renderItem={({ item }) => {
            const livePlan = planLookup.get(item.planId);
            const unavailable = catalogReady && !livePlan;
            const isCustomized = Boolean(
              livePlan &&
                (item.deviceQuantity !== livePlan.maxActiveDevices ||
                  item.durationMonths !== livePlan.durationMonths),
            );
            const priceChanged = Boolean(livePlan && livePlan.priceVnd !== item.referencePriceVnd);

            return (
              <SurfaceCard>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleCol}>
                    <AppText variant="cardTitle">{item.productName}</AppText>
                    <AppText tone="secondary" variant="secondary">
                      {formatPlanDisplayName(item.planName)} · {item.deviceQuantity} thiết bị · {item.durationMonths} tháng
                    </AppText>
                  </View>
                  {item.orderId ? (
                    <StatusBadge label="Đã tạo đơn" tone="info" />
                  ) : unavailable ? (
                    <StatusBadge label="Không khả dụng" tone="error" />
                  ) : null}
                </View>

                <View style={styles.priceBlock}>
                  <AppText tone={isCustomized ? 'secondary' : 'primary'} variant={isCustomized ? 'secondarySemibold' : 'priceCard'}>
                    {isCustomized ? 'Giá gói gốc (tham khảo): ' : 'Giá tham khảo: '}
                    {formatVnd(livePlan?.priceVnd ?? item.referencePriceVnd)}
                  </AppText>
                  {isCustomized ? (
                    <AppText tone="muted" variant="secondary">
                      Tổng thanh toán theo {item.deviceQuantity} thiết bị · {item.durationMonths} tháng sẽ được xác nhận khi tạo đơn.
                    </AppText>
                  ) : null}
                </View>

                {unavailable ? (
                  <InlineNotice
                    message="Gói không còn khả dụng. Hãy chọn lại gói khác hoặc xóa khỏi giỏ."
                    tone="warning"
                  />
                ) : priceChanged && livePlan ? (
                  <InlineNotice
                    message={`Giá danh mục mới nhất là ${formatVnd(livePlan.priceVnd)}. Giá chính thức được xác nhận khi tạo đơn.`}
                    tone="info"
                  />
                ) : null}

                <View style={styles.actions}>
                  {item.orderId ? (
                    <AppButton
                      label="Đơn đã tạo — tiếp tục"
                      onPress={() => onResumeOrder(item.orderId!)}
                      variant="primary"
                    />
                  ) : (
                    <AppButton
                      disabled={unavailable}
                      label="Tiếp tục"
                      onPress={() => {
                        const isCustomized = Boolean(
                          livePlan &&
                            (item.deviceQuantity !== livePlan.maxActiveDevices ||
                              item.durationMonths !== livePlan.durationMonths),
                        );
                        onCheckoutDraft(item, isCustomized);
                      }}
                      variant="primary"
                    />
                  )}
                  {!item.orderId ? (
                    <AppButton
                      label="Sửa"
                      onPress={() => onEditDraft(item)}
                      variant="secondary"
                    />
                  ) : null}
                  <AppButton
                    label="Xóa"
                    onPress={() => void removeDraft(item.id)}
                    variant="tertiary"
                  />
                </View>
              </SurfaceCard>
            );
          }}
        />
      )}

      <ConfirmDialog
        body="Xóa toàn bộ lựa chọn đã lưu trong giỏ hàng trên thiết bị? Các đơn hàng đã tạo trên hệ thống không bị hủy."
        cancelLabel="Giữ lại"
        confirmLabel="Xóa giỏ hàng"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          void clearCart();
        }}
        title="Xóa danh sách đã lưu?"
        visible={confirmClear}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  noticeWrap: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  listContent: {
    flexGrow: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  cardTitleCol: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 160,
  },
  priceBlock: {
    gap: spacing.xxs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
