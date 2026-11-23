import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useLicensesList } from '../../../application/licenses/useLicenses';
import { useSafeFocusRefresh } from '../../../application/navigation/useSafeFocusRefresh';
import { FilterSheet, type FilterOption } from '../../components/FilterSheet';
import { LicenseCard } from '../../components/LicenseCard';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { colors, radius, sizes, spacing, typography } from '../../theme/tokens';

const FILTER_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'ACTIVE', label: 'Đang hoạt động' },
  { key: 'expiring', label: 'Sắp hết hạn' },
  { key: 'PENDING_ONCHAIN', label: 'Đang cấp' },
  { key: 'EXPIRED', label: 'Đã hết hạn' },
  { key: 'SUSPENDED', label: 'Tạm ngưng' },
  { key: 'REVOKED', label: 'Đã thu hồi' },
];

const FILTER_OPTIONS: FilterOption[] = FILTER_TABS.map((tab) => ({
  value: tab.key,
  label: tab.label,
}));

export interface LicensesScreenProps {
  readonly initialFilter?: string;
  readonly targetLicenseId?: string;
  readonly onBack?: () => void;
  readonly onOpenLicenseDetail: (licenseId: string) => void;
  readonly onBrowseCatalog?: () => void;
}

export function LicensesScreen({
  initialFilter = 'all',
  targetLicenseId,
  onBack,
  onOpenLicenseDetail,
  onBrowseCatalog,
}: LicensesScreenProps) {
  const { licenses, loading, refreshing, error, refreshError, reload, refresh } = useLicensesList();
  useSafeFocusRefresh(() => {
    void refresh();
  });
  const handledTargetRef = useRef<string | undefined>(undefined);
  const prevInitialFilterRef = useRef(initialFilter);
  const [filter, setFilter] = useState(initialFilter);
  const [query, setQuery] = useState('');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  useEffect(() => {
    if (prevInitialFilterRef.current !== initialFilter) {
      prevInitialFilterRef.current = initialFilter;
      setFilter(initialFilter);
    }
  }, [initialFilter]);

  const activeFilterLabel = useMemo(() => {
    const base = FILTER_TABS.find((t) => t.key === filter)?.label ?? 'Tất cả';
    return query.trim() ? `${base} · từ khóa "${query.trim()}"` : base;
  }, [filter, query]);

  const hasActiveFilter = Boolean(query.trim() || filter !== 'all');

  useEffect(() => {
    if (!targetLicenseId || loading || error) return;
    if (handledTargetRef.current === targetLicenseId) return;
    if (licenses.some((item) => item.id === targetLicenseId)) {
      handledTargetRef.current = targetLicenseId;
      onOpenLicenseDetail(targetLicenseId);
    }
  }, [error, licenses, loading, onOpenLicenseDetail, targetLicenseId]);

  const missingTarget = Boolean(
    !loading &&
      !error &&
      targetLicenseId &&
      !licenses.some((item) => item.id === targetLicenseId),
  );

  const visibleLicenses = useMemo(() => {
    const nowMs = Date.now();
    const in30DaysMs = nowMs + 30 * 24 * 60 * 60 * 1000;
    const needle = query.trim().toLocaleLowerCase('vi-VN');

    return licenses.filter((license) => {
      if (targetLicenseId && license.id !== targetLicenseId) return false;

      if (filter === 'ACTIVE') {
        if (license.status !== 'ACTIVE') return false;
        const expiresAt = Date.parse(license.expiresAt);
        if (Number.isFinite(expiresAt) && expiresAt <= nowMs) return false;
      } else if (filter === 'expiring') {
        if (license.status !== 'ACTIVE') return false;
        const expiresAt = Date.parse(license.expiresAt);
        if (!Number.isFinite(expiresAt) || expiresAt <= nowMs || expiresAt > in30DaysMs) {
          return false;
        }
      } else if (filter !== 'all') {
        if (license.status !== filter) return false;
      }

      if (!needle) return true;
      return `${license.productName} ${license.plan.name} ${license.publicLicenseId} ${license.activationKeyLast4 ?? ''}`
        .toLocaleLowerCase('vi-VN')
        .includes(needle);
    });
  }, [filter, licenses, query, targetLicenseId]);

  return (
    <Screen
      header={<AppHeader onBack={onBack} title="Bản quyền của tôi" />}
      padded={false}
      scroll="none"
    >
      <View style={styles.controls}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <AppIcon name="search" size={sizes.iconMd} tone="muted" />
            <TextInput
              accessibilityLabel="Tìm sản phẩm, gói, mã tra cứu hoặc 4 ký tự cuối"
              onChangeText={setQuery}
              placeholder="Tìm sản phẩm, mã EMU-... hoặc 4 ký tự cuối"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              value={query}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityLabel="Xóa từ khóa tìm bản quyền"
                accessibilityRole="button"
                onPress={() => setQuery('')}
                style={styles.clearBtn}
              >
                <AppIcon name="close" size={sizes.iconSm} tone="muted" />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="Chọn bộ lọc trạng thái bản quyền"
            accessibilityRole="button"
            onPress={() => setFilterSheetOpen(true)}
            style={[
              styles.filterBtn,
              filter !== 'all' ? styles.filterBtnActive : null,
            ]}
          >
            <AppIcon
              name="filter"
              size={sizes.iconMd}
              tone={filter !== 'all' ? 'info' : 'secondary'}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.chipsScroll}
          horizontal
          showsHorizontalScrollIndicator
        >
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                onPress={() => setFilter(tab.key)}
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
        </ScrollView>

        <View style={styles.scopeRow}>
          <AppText style={styles.scopeText} tone="secondary" variant="secondary">
            Hiển thị {visibleLicenses.length}/{licenses.length} bản quyền · Bộ lọc: {activeFilterLabel}
          </AppText>
          {hasActiveFilter ? (
            <AppButton
              label="Xóa lọc"
              onPress={() => {
                setQuery('');
                setFilter('all');
              }}
              variant="tertiary"
            />
          ) : null}
        </View>

        {missingTarget ? (
          <InlineNotice
            message="Không tìm thấy bản quyền hoặc bạn không có quyền truy cập."
            tone="warning"
          />
        ) : null}

        {refreshError && licenses.length > 0 ? (
          <InlineNotice
            actionLabel="Thử lại"
            message={refreshError}
            onAction={() => void refresh()}
            tone="warning"
          />
        ) : null}
      </View>

      {loading && licenses.length === 0 ? (
        <FeedbackState mode="loading" title="Đang tải danh sách bản quyền..." />
      ) : error && licenses.length === 0 ? (
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reload()}
          title={error}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={visibleLicenses}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <FeedbackState
              actionLabel={
                query || filter !== 'all'
                  ? 'Xóa bộ lọc'
                  : onBrowseCatalog
                    ? 'Khám phá sản phẩm'
                    : undefined
              }
              description={
                licenses.length > 0
                  ? 'Không có bản quyền phù hợp với bộ lọc hiện tại.'
                  : 'Bản quyền sẽ xuất hiện sau khi đơn hàng được thanh toán và xác nhận.'
              }
              icon="license"
              mode="empty"
              onAction={
                query || filter !== 'all'
                  ? () => {
                      setQuery('');
                      setFilter('all');
                    }
                  : onBrowseCatalog
              }
              title={
                licenses.length > 0 ? 'Không tìm thấy bản quyền phù hợp' : 'Chưa có bản quyền nào'
              }
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
            <LicenseCard license={item} onOpen={onOpenLicenseDetail} />
          )}
        />
      )}

      <FilterSheet
        onClose={() => setFilterSheetOpen(false)}
        onReset={() => setFilter('all')}
        onSelect={setFilter}
        options={FILTER_OPTIONS}
        selectedValue={filter}
        title="Lọc bản quyền theo trạng thái"
        visible={filterSheetOpen}
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
});
