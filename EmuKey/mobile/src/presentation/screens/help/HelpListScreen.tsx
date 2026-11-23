import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { usePublicKnowledgeList } from '../../../application/knowledge/useKnowledge';
import { FilterSheet, type FilterOption } from '../../components/FilterSheet';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { colors, radius, sizes, spacing, typography } from '../../theme/tokens';

export interface HelpListScreenProps {
  readonly initialProductId?: string;
  readonly onBack?: () => void;
  readonly onOpenDocument: (documentId: string) => void;
}

export function HelpListScreen({
  initialProductId = '',
  onBack,
  onOpenDocument,
}: HelpListScreenProps) {
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('Tất cả');
  const [selectedProductId, setSelectedProductId] = useState(initialProductId);
  const [page, setPage] = useState(1);
  const [productSheetOpen, setProductSheetOpen] = useState(false);

  const { data, loading, refreshing, error, reload, refresh } =
    usePublicKnowledgeList({
      search: submittedSearch || undefined,
      tag: selectedTag !== 'Tất cả' ? selectedTag : undefined,
      productId: selectedProductId || undefined,
      page,
      limit: 10,
    });

  const tags = useMemo(
    () => ['Tất cả', ...(data?.availableTags ?? [])],
    [data?.availableTags],
  );

  const productOptions = useMemo<FilterOption[]>(() => {
    const base: FilterOption = { value: '', label: 'Tất cả sản phẩm' };
    if (!data?.products) return [base];
    return [
      base,
      ...data.products.map((product) => ({
        value: product.id,
        label: product.name,
      })),
    ];
  }, [data?.products]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));
  const hasFilters = Boolean(
    submittedSearch || selectedTag !== 'Tất cả' || selectedProductId,
  );
  const selectedProductName = productOptions.find(
    (item) => item.value === selectedProductId,
  )?.label;
  const scopeParts = [
    selectedTag !== 'Tất cả' ? selectedTag : 'Tất cả chủ đề',
    ...(selectedProductId && selectedProductName ? [selectedProductName] : []),
    ...(submittedSearch ? [`từ khóa "${submittedSearch}"`] : []),
  ];

  const resetFilters = () => {
    setSearchInput('');
    setSubmittedSearch('');
    setSelectedTag('Tất cả');
    setSelectedProductId('');
    setPage(1);
  };

  return (
    <Screen
      header={<AppHeader onBack={onBack} title="Trung tâm hướng dẫn" />}
      padded={false}
      scroll="none"
    >
      <View style={styles.controls}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <AppIcon name="search" size={sizes.iconMd} tone="muted" />
            <TextInput
              accessibilityLabel="Tìm tài liệu hướng dẫn"
              onChangeText={(value) => {
                setSearchInput(value);
                if (!value) {
                  setSubmittedSearch('');
                  setPage(1);
                }
              }}
              onSubmitEditing={() => {
                setSubmittedSearch(searchInput.trim());
                setPage(1);
              }}
              placeholder="Tìm tài liệu hướng dẫn..."
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={styles.searchInput}
              value={searchInput}
            />
            {searchInput.length > 0 ? (
              <Pressable
                accessibilityLabel="Xóa từ khóa tìm tài liệu"
                accessibilityRole="button"
                onPress={() => {
                  setSearchInput('');
                  setSubmittedSearch('');
                  setPage(1);
                }}
                style={styles.clearBtn}
              >
                <AppIcon name="close" size={sizes.iconSm} tone="muted" />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="Lọc theo sản phẩm"
            accessibilityRole="button"
            onPress={() => setProductSheetOpen(true)}
            style={[
              styles.filterBtn,
              selectedProductId ? styles.filterBtnActive : null,
            ]}
          >
            <AppIcon
              name="filter"
              size={sizes.iconMd}
              tone={selectedProductId ? 'info' : 'secondary'}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.tagsScroll}
          horizontal
          showsHorizontalScrollIndicator
        >
          {tags.map((tag) => {
            const active = selectedTag === tag;
            return (
              <Pressable
                key={tag}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                onPress={() => {
                  setSelectedTag((curr) =>
                    curr === tag && tag !== 'Tất cả' ? 'Tất cả' : tag,
                  );
                  setPage(1);
                }}
                style={[styles.chip, active ? styles.chipActive : null]}
              >
                <AppText
                  singleLineSafe
                  tone={active ? 'info' : 'secondary'}
                  variant={active ? 'secondarySemibold' : 'secondary'}
                >
                  {tag}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.scopeRow}>
          <AppText style={styles.scopeText} tone="secondary" variant="secondary">
            Hiển thị {items.length}/{total} tài liệu · Bộ lọc: {scopeParts.join(' · ')}
          </AppText>
          {hasFilters ? (
            <AppButton
              label="Xóa lọc"
              onPress={resetFilters}
              variant="tertiary"
            />
          ) : null}
        </View>
      </View>

      {loading && !data ? (
        <FeedbackState mode="loading" title="Đang tải tài liệu hướng dẫn..." />
      ) : error && !data ? (
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
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <FeedbackState
              actionLabel={hasFilters ? 'Xóa tất cả bộ lọc' : undefined}
              description="Không tìm thấy tài liệu hướng dẫn phù hợp với bộ lọc."
              icon="book"
              mode="empty"
              onAction={hasFilters ? resetFilters : undefined}
              title="Không có tài liệu phù hợp"
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.paginationRow}>
                <AppButton
                  disabled={page <= 1}
                  label="Trang trước"
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                  variant="secondary"
                />
                <AppText tone="secondary" variant="secondarySemibold">
                  Trang {page}/{totalPages}
                </AppText>
                <AppButton
                  disabled={page >= totalPages}
                  label="Trang sau"
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  variant="secondary"
                />
              </View>
            ) : null
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
            <SurfaceCard onPress={() => onOpenDocument(item.id)}>
              <AppText tone="primary" variant="secondarySemibold">
                {item.productName}
                {item.planName ? ` · ${item.planName}` : ''}
              </AppText>
              <AppText variant="cardTitle">{item.title}</AppText>
              {item.summary ? (
                <AppText numberOfLines={2} tone="secondary" variant="secondary">
                  {item.summary}
                </AppText>
              ) : null}
              {item.tags.length > 0 ? (
                <View style={styles.tagsRow}>
                  {item.tags.map((t) => (
                    <StatusBadge key={t} label={t} tone="neutral" />
                  ))}
                </View>
              ) : null}
            </SurfaceCard>
          )}
        />
      )}

      <FilterSheet
        onClose={() => setProductSheetOpen(false)}
        onReset={() => {
          setSelectedProductId('');
          setPage(1);
        }}
        onSelect={(val) => {
          setSelectedProductId(val);
          setPage(1);
        }}
        options={productOptions}
        selectedValue={selectedProductId}
        title="Lọc theo sản phẩm"
        visible={productSheetOpen}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: sizes.borderWidth,
    gap: spacing.xs,
    padding: spacing.md,
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
  tagsScroll: {
    gap: spacing.xs,
    paddingVertical: 6,
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
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  paginationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
});
