import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {
  orderStatusLabel,
  type OrderPrimaryAction,
} from '../../../application/orders/orderPresentation';
import { useSafeFocusRefresh } from '../../../application/navigation/useSafeFocusRefresh';
import { useOrders } from '../../../application/orders/useOrders';
import { providerHandoffLabel } from '../../../application/licenses/licensePresentation';
import type { MobileOrderSummary } from '../../../infrastructure/api/client';
import { exportOrdersCsv } from '../../../infrastructure/order-export';
import { FilterSheet, type FilterOption } from '../../components/FilterSheet';
import { OrderCard } from '../../components/OrderCard';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { colors, radius, sizes, spacing, typography } from '../../theme/tokens';

type OrderStatusFilter =
  | 'ALL'
  | 'WAITING_SERVICE_TERMS_ACCEPTANCE'
  | 'WAITING_PAYMENT'
  | 'PAYMENT_ACCEPTED'
  | 'CANCELLED'
  | 'EXPIRED';

const QUICK_TABS: { key: OrderStatusFilter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'WAITING_SERVICE_TERMS_ACCEPTANCE', label: 'Chờ điều khoản' },
  { key: 'WAITING_PAYMENT', label: 'Chờ thanh toán' },
  { key: 'PAYMENT_ACCEPTED', label: 'Đã thanh toán' },
];

const EXTRA_STATUS_OPTIONS: FilterOption[] = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'WAITING_SERVICE_TERMS_ACCEPTANCE', label: orderStatusLabel('WAITING_SERVICE_TERMS_ACCEPTANCE') },
  { value: 'WAITING_PAYMENT', label: orderStatusLabel('WAITING_PAYMENT') },
  { value: 'PAYMENT_ACCEPTED', label: orderStatusLabel('PAYMENT_ACCEPTED') },
  { value: 'CANCELLED', label: orderStatusLabel('CANCELLED') },
  { value: 'EXPIRED', label: orderStatusLabel('EXPIRED') },
];

const VALID_STATUS_FILTERS = new Set<string>(EXTRA_STATUS_OPTIONS.map((o) => o.value));

export interface OrdersScreenProps {
  readonly onOpenNotifications: () => void;
  readonly onOpenOrderDetail: (orderId: string) => void;
  readonly onOpenTerms: (orderId: string) => void;
  readonly onOpenPayment: (orderId: string) => void;
  readonly onOpenPaymentHistory?: () => void;
  readonly onBrowseCatalog?: () => void;
}

export function OrdersScreen({
  onOpenNotifications,
  onOpenOrderDetail,
  onOpenTerms,
  onOpenPayment,
  onOpenPaymentHistory,
  onBrowseCatalog,
}: OrdersScreenProps) {
  const { orders, licenses, loading, refreshing, error, refreshError, reload, refresh } = useOrders();
  useSafeFocusRefresh(() => {
    void refresh();
  });
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [exportState, setExportState] = useState<{
    pending: boolean;
    notice: { tone: 'success' | 'error'; message: string } | null;
  }>({ pending: false, notice: null });

  const activeFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (statusFilter !== 'ALL') {
      const quickMatch = QUICK_TABS.find((t) => t.key === statusFilter)?.label;
      parts.push(quickMatch ?? orderStatusLabel(statusFilter));
    }
    if (query.trim()) {
      parts.push(`"${query.trim()}"`);
    }
    return parts.join(' · ');
  }, [query, statusFilter]);

  const hasActiveFilter = Boolean(query.trim() || statusFilter !== 'ALL');
  const isExtraStatus =
    statusFilter !== 'ALL' && !QUICK_TABS.some((tab) => tab.key === statusFilter);

  const filteredOrders = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi-VN');
    return orders.filter((order) => {
      if (statusFilter !== 'ALL' && order.orderStatus !== statusFilter) {
        return false;
      }
      if (!needle) return true;
      return `${order.orderNumber} ${order.productNameSnapshot} ${order.planNameSnapshot}`
        .toLocaleLowerCase('vi-VN')
        .includes(needle);
    });
  }, [orders, query, statusFilter]);

  const handlePrimaryAction = (
    order: MobileOrderSummary,
    action: OrderPrimaryAction,
  ) => {
    if (action.kind === 'terms') {
      onOpenTerms(order.id);
      return;
    }
    if (action.kind === 'payment') {
      onOpenPayment(order.id);
      return;
    }
    onOpenOrderDetail(order.id);
  };

  const handleExport = async () => {
    if (!filteredOrders.length || exportState.pending) return;
    setExportState({ pending: true, notice: null });
    try {
      await exportOrdersCsv(filteredOrders);
      setExportState({ pending: false, notice: null });
    } catch {
      setExportState({
        pending: false,
        notice: {
          tone: 'error',
          message: 'Không thể xuất file CSV lúc này. Bộ lọc hiện tại vẫn được giữ.',
        },
      });
    }
  };

  const listHeader = (
    <View style={styles.listHeader}>
      <ScrollView
        contentContainerStyle={styles.chipsScroll}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {QUICK_TABS.map((tab) => {
          const active = statusFilter === tab.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              onPress={() => setStatusFilter(tab.key)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <AppText
                singleLineSafe
                tone={active ? 'info' : 'secondary'}
                variant={active ? 'secondarySemibold' : 'secondary'}
              >
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityLabel="Chọn trạng thái khác"
          accessibilityRole="button"
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          onPress={() => setFilterSheetOpen(true)}
          style={[styles.chip, isExtraStatus ? styles.chipActive : null]}
        >
          <AppText
            singleLineSafe
            tone={isExtraStatus ? 'info' : 'secondary'}
            variant={isExtraStatus ? 'secondarySemibold' : 'secondary'}
          >
            {isExtraStatus ? orderStatusLabel(statusFilter) : 'Khác...'}
          </AppText>
        </Pressable>
      </ScrollView>

      <View style={styles.scopeRow}>
        <AppText style={styles.scopeText} tone="secondary" variant="secondary">
          {hasActiveFilter
            ? `${filteredOrders.length}/${orders.length} đơn · ${activeFilterSummary}`
            : `${orders.length} đơn hàng`}
        </AppText>
        <View style={styles.scopeActions}>
          {hasActiveFilter ? (
            <AppButton
              label="Đặt lại"
              onPress={() => {
                setQuery('');
                setStatusFilter('ALL');
              }}
              variant="tertiary"
            />
          ) : null}
          {onOpenPaymentHistory ? (
            <AppButton
              label="Lịch sử thanh toán"
              onPress={onOpenPaymentHistory}
              variant="tertiary"
            />
          ) : null}
          <AppButton
            accessibilityLabel="Mở tùy chọn đơn hàng"
            label="Tùy chọn"
            onPress={() => setActionsMenuOpen(true)}
            variant="tertiary"
          />
        </View>
      </View>

      {refreshError && orders.length > 0 ? (
        <InlineNotice
          actionLabel="Thử lại"
          actionLoading={refreshing}
          message={refreshError}
          onAction={() => void refresh()}
          tone="warning"
        />
      ) : null}

      {exportState.notice ? (
        <InlineNotice
          message={exportState.notice.message}
          tone={exportState.notice.tone}
        />
      ) : null}
    </View>
  );

  return (
    <Screen
      header={
        <AppHeader
          onNotifications={onOpenNotifications}
          showBell
          title="Đơn hàng"
        />
      }
      padded={false}
      scroll="none"
    >
      <View style={styles.controls}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <AppIcon name="search" size={sizes.iconMd} tone="muted" />
            <TextInput
              accessibilityLabel="Tìm mã đơn, sản phẩm hoặc gói"
              onChangeText={setQuery}
              placeholder="Tìm mã đơn, sản phẩm, gói..."
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              value={query}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityLabel="Xóa từ khóa tìm đơn hàng"
                accessibilityRole="button"
                onPress={() => setQuery('')}
                style={styles.clearBtn}
              >
                <AppIcon name="close" size={sizes.iconSm} tone="muted" />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="Lọc thêm trạng thái đơn hàng"
            accessibilityRole="button"
            onPress={() => setFilterSheetOpen(true)}
            style={[
              styles.filterBtn,
              statusFilter !== 'ALL' ? styles.filterBtnActive : null,
            ]}
          >
            <AppIcon
              name="filter"
              size={sizes.iconMd}
              tone={statusFilter !== 'ALL' ? 'info' : 'secondary'}
            />
          </Pressable>
        </View>
      </View>

      {loading && orders.length === 0 ? (
        <FeedbackState mode="loading" title="Đang tải danh sách đơn hàng..." />
      ) : error && orders.length === 0 ? (
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reload()}
          title={error}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={filteredOrders}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <FeedbackState
              actionLabel={
                hasActiveFilter
                  ? 'Xóa bộ lọc'
                  : onBrowseCatalog
                    ? 'Khám phá sản phẩm'
                    : undefined
              }
              description={
                orders.length > 0
                  ? 'Không có đơn hàng nào khớp bộ lọc hiện tại.'
                  : 'Đơn hàng sẽ hiển thị sau khi bạn tạo đơn mua hoặc gia hạn.'
              }
              mode="empty"
              onAction={
                hasActiveFilter
                  ? () => {
                      setQuery('');
                      setStatusFilter('ALL');
                    }
                  : onBrowseCatalog
              }
              title={
                orders.length > 0 ? 'Không tìm thấy đơn hàng' : 'Chưa có đơn hàng'
              }
            />
          }
          refreshControl={
            <RefreshControl
              testID="orders-refresh-control"
              colors={[colors.primary]}
              onRefresh={() => void refresh()}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const linkedLicense = licenses.find(
              (lic) =>
                lic.originOrderId === item.id ||
                (item.targetLicenseId && lic.id === item.targetLicenseId),
            );
            const fulfillmentHint =
              item.orderStatus === 'PAYMENT_ACCEPTED' && linkedLicense
                ? linkedLicense.fulfillmentMode === 'PROVIDER_HANDOFF'
                  ? providerHandoffLabel(linkedLicense)
                  : linkedLicense.status === 'ACTIVE'
                    ? 'Bản quyền sẵn sàng'
                    : 'Đang phát hành bản quyền'
                : null;
            return (
              <OrderCard
                fulfillmentHint={fulfillmentHint}
                onOpenDetail={onOpenOrderDetail}
                onPrimaryAction={handlePrimaryAction}
                order={item}
              />
            );
          }}
        />
      )}

      <FilterSheet
        onClose={() => setFilterSheetOpen(false)}
        onReset={() => setStatusFilter('ALL')}
        onSelect={(value) => {
          if (VALID_STATUS_FILTERS.has(value)) {
            setStatusFilter(value as OrderStatusFilter);
          }
        }}
        options={EXTRA_STATUS_OPTIONS}
        selectedValue={statusFilter}
        title="Lọc theo trạng thái"
        visible={filterSheetOpen}
      />

      <Modal
        animationType="fade"
        onRequestClose={() => setActionsMenuOpen(false)}
        transparent
        visible={actionsMenuOpen}
      >
        <Pressable onPress={() => setActionsMenuOpen(false)} style={styles.menuBackdrop}>
          <Pressable style={styles.menuCard}>
            <AppText accessibilityRole="header" variant="sectionTitle">
              Tùy chọn danh sách đơn hàng
            </AppText>
            <AppButton
              fullWidth
              icon="export"
              loading={exportState.pending}
              disabled={filteredOrders.length === 0 || exportState.pending}
              label={`Xuất CSV (${filteredOrders.length} đơn đang lọc)`}
              onPress={() => {
                setActionsMenuOpen(false);
                void handleExport();
              }}
              variant="secondary"
            />
            <AppButton
              fullWidth
              icon="filter"
              label="Chọn bộ lọc trạng thái đầy đủ"
              onPress={() => {
                setActionsMenuOpen(false);
                setFilterSheetOpen(true);
              }}
              variant="secondary"
            />
            <AppButton
              fullWidth
              label="Đóng"
              onPress={() => setActionsMenuOpen(false)}
              variant="tertiary"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: sizes.borderWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  listHeader: {
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderColor: colors.control,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    minHeight: sizes.minHitTarget,
  },
  clearBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizes.minHitTarget,
    minWidth: sizes.minHitTarget,
  },
  filterBtn: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderColor: colors.control,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    justifyContent: 'center',
    minHeight: sizes.minHitTarget,
    minWidth: sizes.minHitTarget,
  },
  filterBtnActive: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.primary,
  },
  chipsScroll: {
    gap: spacing.xs,
    paddingVertical: 6,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.control,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  chipActive: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.primary,
  },
  listContent: {
    flexGrow: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  scopeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  scopeText: {
    flex: 1,
    minWidth: 160,
  },
  scopeActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  menuBackdrop: {
    backgroundColor: colors.overlayBackdrop,
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: sizes.borderWidth,
    gap: spacing.sm,
    padding: spacing.md,
  },
});
