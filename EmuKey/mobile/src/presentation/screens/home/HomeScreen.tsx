import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useCustomerSession } from '../../../application/auth/useCustomerSession';
import {
  selectBuyerHomeMetrics,
  selectExpiringLicenses,
} from '../../../application/home/homeSelectors';
import { useSafeFocusRefresh } from '../../../application/navigation/useSafeFocusRefresh';
import {
  listLicenses,
  listOrders,
  listProducts,
  type MobileLicense,
  type MobileOrderSummary,
  type MobileProduct,
} from '../../../infrastructure/api/client';
import { OrderCard } from '../../components/OrderCard';
import { ProductCard } from '../../components/ProductCard';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppIcon, type AppIconName } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { colors, radius, sizes, spacing, typography } from '../../theme/tokens';

export interface HomeScreenProps {
  readonly onOpenNotifications: () => void;
  readonly onOpenCatalog: (initialQuery?: string) => void;
  readonly onOpenProduct: (productId: string) => void;
  readonly onOpenLicenses: (filter?: string) => void;
  readonly onOpenLicenseDetail?: (licenseId: string) => void;
  readonly onOpenOrder: (orderId: string) => void;
  readonly onOpenOrdersTab: () => void;
  readonly onOpenAssistant: () => void;
  readonly onOpenSupport: () => void;
  readonly onOpenHelp: () => void;
}

interface SectionState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

export function HomeScreen({
  onOpenNotifications,
  onOpenCatalog,
  onOpenProduct,
  onOpenLicenses,
  onOpenLicenseDetail,
  onOpenOrder,
  onOpenOrdersTab,
  onOpenAssistant,
  onOpenSupport,
  onOpenHelp,
}: HomeScreenProps) {
  const { isAuthenticated } = useCustomerSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [licensesState, setLicensesState] = useState<SectionState<MobileLicense[]>>({
    data: [],
    loading: isAuthenticated,
    error: null,
  });
  const [ordersState, setOrdersState] = useState<SectionState<MobileOrderSummary[]>>({
    data: [],
    loading: isAuthenticated,
    error: null,
  });
  const [productsState, setProductsState] = useState<SectionState<MobileProduct[]>>({
    data: [],
    loading: true,
    error: null,
  });

  const loadLicenses = useCallback(async (silent = false) => {
    if (!isAuthenticated) {
      setLicensesState({ data: [], loading: false, error: null });
      return;
    }
    setLicensesState((prev) => ({
      ...prev,
      loading: silent ? prev.loading : true,
      error: silent ? prev.error : null,
    }));
    try {
      const items = await listLicenses();
      setLicensesState({ data: items, loading: false, error: null });
    } catch {
      setLicensesState((prev) => ({
        ...prev,
        loading: false,
        error: 'Không thể tải bản quyền.',
      }));
    }
  }, [isAuthenticated]);

  const loadOrders = useCallback(async (silent = false) => {
    if (!isAuthenticated) {
      setOrdersState({ data: [], loading: false, error: null });
      return;
    }
    setOrdersState((prev) => ({
      ...prev,
      loading: silent ? prev.loading : true,
      error: silent ? prev.error : null,
    }));
    try {
      const items = await listOrders();
      setOrdersState({ data: items, loading: false, error: null });
    } catch {
      setOrdersState((prev) => ({
        ...prev,
        loading: false,
        error: 'Không thể tải đơn hàng.',
      }));
    }
  }, [isAuthenticated]);

  const loadProducts = useCallback(async (silent = false) => {
    setProductsState((prev) => ({
      ...prev,
      loading: silent ? prev.loading : true,
      error: silent ? prev.error : null,
    }));
    try {
      const items = await listProducts();
      setProductsState({ data: items, loading: false, error: null });
    } catch {
      setProductsState((prev) => ({
        ...prev,
        loading: false,
        error: 'Không thể tải danh mục sản phẩm.',
      }));
    }
  }, []);

  useEffect(() => {
    void loadLicenses();
    void loadOrders();
    void loadProducts();
  }, [loadLicenses, loadOrders, loadProducts]);

  useSafeFocusRefresh(() => {
    void loadLicenses(true);
    void loadOrders(true);
    void loadProducts(true);
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadLicenses(), loadOrders(), loadProducts()]);
    setRefreshing(false);
  };

  // Match the Web Home A-Z preview; do not imply popularity without data.
  const featuredProducts = [...productsState.data]
    .sort((left, right) => left.name.localeCompare(right.name, 'vi') || left.slug.localeCompare(right.slug))
    .slice(0, 6);

  const now = new Date();
  const metrics = selectBuyerHomeMetrics(ordersState.data, licensesState.data, now);
  const expiring = selectExpiringLicenses(licensesState.data, now);
  const pendingOrders = ordersState.data.filter((order) =>
    ['WAITING_SERVICE_TERMS_ACCEPTANCE', 'WAITING_PAYMENT'].includes(order.orderStatus),
  );
  const recentOrders = ordersState.data.slice(0, 2);
  const recentLicense =
    licensesState.data.find((item) => item.status === 'ACTIVE') ?? licensesState.data[0];

  const priorityAction = pendingOrders[0]
    ? {
        title: 'Việc cần xử lý',
        message: `Đơn hàng "${pendingOrders[0].productNameSnapshot}" đang chờ hoàn tất thanh toán hoặc xác nhận điều khoản.`,
        actionLabel: 'Tiếp tục đơn hàng',
        onAction: () => onOpenOrder(pendingOrders[0].id),
        tone: 'info' as const,
      }
    : expiring.length > 0
      ? {
          title: 'Việc cần xử lý',
          message: `Bạn có ${expiring.length} bản quyền sắp hết hạn trong 30 ngày tới.`,
          actionLabel: 'Kiểm tra & gia hạn',
          onAction: () => onOpenLicenses('expiring'),
          tone: 'warning' as const,
        }
      : null;

  const shortcuts: {
    key: string;
    label: string;
    icon: AppIconName;
    onPress: () => void;
  }[] = [
    {
      key: 'licenses',
      label: 'Bản quyền',
      icon: 'license',
      onPress: () => onOpenLicenses(),
    },
    {
      key: 'assistant',
      label: 'Trợ lý AI',
      icon: 'assistant',
      onPress: onOpenAssistant,
    },
    {
      key: 'support',
      label: 'Hỗ trợ',
      icon: 'support',
      onPress: onOpenSupport,
    },
    {
      key: 'help',
      label: 'Hướng dẫn',
      icon: 'book',
      onPress: onOpenHelp,
    },
  ];

  return (
    <Screen
      header={
        <AppHeader
          brand
          onNotifications={onOpenNotifications}
          showBell={isAuthenticated}
        />
      }
      onRefresh={() => void onRefresh()}
      refreshing={refreshing}
    >
      <View style={styles.searchBar}>
        <AppIcon name="search" size={sizes.iconMd} tone="muted" />
        <TextInput
          accessibilityLabel="Tìm sản phẩm hoặc gói"
          onChangeText={setSearchQuery}
          onSubmitEditing={() => onOpenCatalog(searchQuery.trim() || undefined)}
          placeholder="Tìm phần mềm hoặc gói bản quyền..."
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={styles.searchInput}
          value={searchQuery}
        />
        <AppButton
          label="Tìm"
          onPress={() => onOpenCatalog(searchQuery.trim() || undefined)}
          variant="secondary"
        />
      </View>

      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="sectionTitle">
          Sản phẩm đang phát hành
        </AppText>
        <View style={styles.sectionHeader}>
          <AppText tone="muted" variant="secondary">
            {productsState.data.length > 0
              ? `${productsState.data.length} sản phẩm · A–Z`
              : 'Danh mục A–Z'}
          </AppText>
          <AppButton
            accessibilityLabel="Xem tất cả sản phẩm"
            label="Xem tất cả"
            onPress={() => onOpenCatalog()}
            variant="tertiary"
          />
        </View>

        {productsState.error ? (
          <InlineNotice
            actionLabel="Thử lại"
            message={productsState.error}
            onAction={() => void loadProducts()}
            tone="error"
          />
        ) : productsState.loading ? (
          <AppText tone="secondary" variant="secondary">
            Đang tải danh mục sản phẩm...
          </AppText>
        ) : productsState.data.length === 0 ? (
          <InlineNotice
            message="Chưa có sản phẩm được công bố."
            tone="neutral"
          />
        ) : (
          featuredProducts.map((product) => (
            <ProductCard
              key={product.id}
              onOpen={onOpenProduct}
              product={product}
              variant="featured"
            />
          ))
        )}
      </View>

      {isAuthenticated && priorityAction ? (
        <InlineNotice
          actionLabel={priorityAction.actionLabel}
          message={priorityAction.message}
          onAction={priorityAction.onAction}
          title={priorityAction.title}
          tone={priorityAction.tone}
        />
      ) : null}

      {isAuthenticated ? (
        <SurfaceCard>
          <View style={styles.sectionHeader}>
            <AppText accessibilityRole="header" variant="sectionTitle">
              Bản quyền của tôi
            </AppText>
            <AppButton
              label="Xem tất cả"
              onPress={() => onOpenLicenses()}
              variant="tertiary"
            />
          </View>

          {licensesState.error ? (
            <InlineNotice
              actionLabel="Thử lại"
              message={licensesState.error}
              onAction={() => void loadLicenses()}
              tone="error"
            />
          ) : licensesState.loading ? (
            <AppText tone="secondary" variant="secondary">
              Đang tải tóm tắt bản quyền...
            </AppText>
          ) : licensesState.data.length === 0 ? (
            <View style={styles.emptyBox}>
              <AppText tone="secondary" variant="body">
                Bản quyền sẽ xuất hiện tại đây sau khi đơn hàng được thanh toán và xác nhận.
              </AppText>
              <AppButton
                label="Khám phá sản phẩm"
                onPress={() => onOpenCatalog()}
                variant="primary"
              />
            </View>
          ) : (
            <>
              <View style={styles.metricsRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenLicenses('ACTIVE')}
                  style={styles.metricTile}
                >
                  <AppText tone="primary" variant="pageTitle">
                    {metrics.activeLicenses}
                  </AppText>
                  <AppText tone="secondary" variant="secondary">
                    Đang hoạt động
                  </AppText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenLicenses('expiring')}
                  style={styles.metricTile}
                >
                  <AppText
                    tone={metrics.licensesExpiringWithin30Days > 0 ? 'warning' : 'default'}
                    variant="pageTitle"
                  >
                    {metrics.licensesExpiringWithin30Days}
                  </AppText>
                  <AppText tone="secondary" variant="secondary">
                    Sắp hết hạn
                  </AppText>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenLicenses()}
                  style={styles.metricTile}
                >
                  <AppText
                    tone={metrics.activeDevices === null ? 'info' : 'default'}
                    variant={metrics.activeDevices === null ? 'bodySemibold' : 'cardTitle'}
                  >
                    {metrics.activeDevices === null ? 'Theo gói' : String(metrics.activeDevices)}
                  </AppText>
                  <AppText tone="secondary" variant="secondary">
                    {metrics.activeDevices === null
                      ? 'Bên bán quản lý thiết bị'
                      : 'Thiết bị đang dùng'}
                  </AppText>
                </Pressable>
              </View>
              {recentLicense ? (
                <AppButton
                  fullWidth
                  icon="license"
                  label={`Mở nhanh: ${recentLicense.productName}`}
                  onPress={() => {
                    if (onOpenLicenseDetail) {
                      onOpenLicenseDetail(recentLicense.id);
                    } else {
                      onOpenLicenses(recentLicense.status === 'ACTIVE' ? 'ACTIVE' : undefined);
                    }
                  }}
                  variant="secondary"
                />
              ) : null}
            </>
          )}
        </SurfaceCard>
      ) : null}

      {isAuthenticated && (recentOrders.length > 0 || ordersState.error) ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText accessibilityRole="header" variant="sectionTitle">
              Đơn hàng gần đây
            </AppText>
            <AppButton
              label="Tất cả đơn"
              onPress={onOpenOrdersTab}
              variant="tertiary"
            />
          </View>
          {ordersState.error ? (
            <InlineNotice
              actionLabel="Thử lại"
              message={ordersState.error}
              onAction={() => void loadOrders()}
              tone="error"
            />
          ) : (
            recentOrders.map((order) => (
              <OrderCard
                key={order.id}
                onOpenDetail={onOpenOrder}
                onPrimaryAction={(target) => onOpenOrder(target.id)}
                order={order}
              />
            ))
          )}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="sectionTitle">
          Trợ giúp nhanh
        </AppText>
        <View style={styles.shortcutGrid}>
          {shortcuts.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.shortcutTile,
                pressed ? styles.shortcutPressed : null,
              ]}
            >
              <View style={styles.shortcutIconBox}>
                <AppIcon name={item.icon} size={sizes.iconMd} tone="primary" />
              </View>
              <AppText variant="bodySemibold">{item.label}</AppText>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.control,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  searchInput: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    minWidth: 0,
    minHeight: sizes.minHitTarget,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  emptyBox: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metricTile: {
    backgroundColor: colors.subtle,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    flexBasis: '30%',
    flexGrow: 1,
    gap: spacing.xxs,
    minWidth: 92,
    padding: spacing.xs,
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  shortcutTile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: sizes.borderWidth,
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 80,
    padding: spacing.md,
  },
  shortcutPressed: {
    backgroundColor: colors.surfaceSelected,
  },
  shortcutIconBox: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderRadius: radius.control,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
