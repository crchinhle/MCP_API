import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  useCatalogProducts,
  type CatalogSort,
} from '../../../application/catalog/useCatalog';
import { ProductCard } from '../../components/ProductCard';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { colors, radius, sizes, spacing, typography } from '../../theme/tokens';

export interface CatalogScreenProps {
  readonly initialQuery?: string;
  readonly onBack?: () => void;
  readonly onNotifications?: () => void;
  readonly showBell?: boolean;
  readonly onOpenProduct: (productId: string) => void;
  readonly onOpenCompare: (ids: string[]) => void;
}

export function CatalogScreen({
  initialQuery = '',
  onBack,
  onNotifications,
  showBell = false,
  onOpenProduct,
  onOpenCompare,
}: CatalogScreenProps) {
  const { width } = useWindowDimensions();
  const numColumns = width >= 600 ? 2 : 1;
  const { products, loading, refreshing, error, reload, refresh } = useCatalogProducts();
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<CatalogSort>('default');
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi-VN');
    const filtered = needle
      ? products.filter(
          (product) =>
            product.name.toLocaleLowerCase('vi-VN').includes(needle) ||
            product.summary.toLocaleLowerCase('vi-VN').includes(needle) ||
            product.plans.some((plan) => plan.name.toLocaleLowerCase('vi-VN').includes(needle)),
        )
      : products;

    if (sort === 'price-asc') {
      return [...filtered].sort((left, right) => {
        const leftMin = left.plans.length
          ? Math.min(...left.plans.map((p) => p.priceVnd))
          : Number.MAX_SAFE_INTEGER;
        const rightMin = right.plans.length
          ? Math.min(...right.plans.map((p) => p.priceVnd))
          : Number.MAX_SAFE_INTEGER;
        return leftMin - rightMin;
      });
    }
    return filtered;
  }, [products, query, sort]);

  return (
    <Screen
      footer={
        compareIds.length > 0 ? (
          <View style={styles.compareTray}>
            <AppText variant="secondarySemibold">
              Đã chọn {compareIds.length}/4 gói để so sánh
            </AppText>
            <View style={styles.trayActions}>
              <AppButton
                label="Bỏ chọn"
                onPress={() => setCompareIds([])}
                variant="tertiary"
              />
              <AppButton
                disabled={compareIds.length < 2}
                label={`So sánh (${compareIds.length})`}
                onPress={() => onOpenCompare(compareIds)}
                variant="primary"
              />
            </View>
          </View>
        ) : undefined
      }
      header={
        <AppHeader
          onBack={onBack}
          onNotifications={onNotifications}
          showBell={showBell}
          title="Sản phẩm"
        />
      }
      padded={false}
      scroll="none"
    >
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <AppIcon name="search" size={sizes.iconMd} tone="muted" />
          <TextInput
            accessibilityLabel="Tìm sản phẩm hoặc gói"
            onChangeText={setQuery}
            placeholder="Tìm sản phẩm hoặc gói..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={query}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityLabel="Xóa từ khóa tìm kiếm"
              accessibilityRole="button"
              onPress={() => setQuery('')}
              style={styles.clearBtn}
            >
              <AppIcon name="close" size={sizes.iconSm} tone="muted" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <AppText tone="secondary" variant="secondary">
            {loading ? 'Đang tải...' : `${visibleProducts.length} sản phẩm`}
          </AppText>
          <View style={styles.sortRow}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: sort === 'default' }}
              onPress={() => setSort('default')}
              style={[styles.sortChip, sort === 'default' ? styles.sortChipActive : null]}
            >
              <AppText
                tone={sort === 'default' ? 'info' : 'secondary'}
                variant="secondarySemibold"
              >
                Mặc định
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: sort === 'price-asc' }}
              onPress={() => setSort('price-asc')}
              style={[styles.sortChip, sort === 'price-asc' ? styles.sortChipActive : null]}
            >
              <AppText
                tone={sort === 'price-asc' ? 'info' : 'secondary'}
                variant="secondarySemibold"
              >
                Giá tăng dần
              </AppText>
            </Pressable>
            <AppButton
              label="So sánh gói"
              onPress={() => onOpenCompare(compareIds)}
              variant="tertiary"
            />
          </View>
        </View>
      </View>

      {loading && products.length === 0 ? (
        <FeedbackState mode="loading" title="Đang tải danh mục sản phẩm..." />
      ) : error && products.length === 0 ? (
        <FeedbackState
          actionLabel="Thử lại"
          description="Vui lòng kiểm tra kết nối và tải lại danh mục."
          mode="error"
          onAction={() => void reload()}
          title={error}
        />
      ) : (
        <FlatList
          key={numColumns}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrap : undefined}
          contentContainerStyle={styles.listContent}
          data={visibleProducts}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <FeedbackState
              actionLabel={query.trim() ? 'Xóa bộ lọc' : undefined}
              description={
                query.trim()
                  ? 'Không tìm thấy sản phẩm hoặc gói phù hợp.'
                  : 'Hiện chưa có sản phẩm nào được công bố.'
              }
              mode="empty"
              onAction={query.trim() ? () => setQuery('') : undefined}
              title={
                query.trim()
                  ? 'Không tìm thấy sản phẩm'
                  : 'Chưa có sản phẩm'
              }
            />
          }
          numColumns={numColumns}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={() => void refresh()}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <ProductCard
              compact={numColumns > 1}
              onOpen={onOpenProduct}
              product={item}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: sizes.borderWidth,
    gap: spacing.xs,
    padding: spacing.md,
  },
  searchWrap: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderColor: colors.control,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
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
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  sortRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sortChip: {
    alignItems: 'center',
    borderColor: colors.control,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.sm,
  },
  sortChipActive: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.primary,
  },
  listContent: {
    flexGrow: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  columnWrap: {
    gap: spacing.sm,
  },
  compareTray: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: sizes.borderWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  trayActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
