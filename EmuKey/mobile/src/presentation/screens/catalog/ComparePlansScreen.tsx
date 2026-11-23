import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import {
  useCatalogProducts,
  useComparePlans,
} from '../../../application/catalog/useCatalog';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatPlanDisplayName, formatVnd } from '../../formatters';
import { colors, radius, sizes, spacing, typography } from '../../theme/tokens';

const DIMENSION_ORDER = [
  'priceVnd',
  'maxActiveDevices',
  'durationMonths',
  'billingCycle',
  'entitlements',
];

export interface ComparePlansScreenProps {
  readonly initialIds: readonly string[];
  readonly onBack: () => void;
  readonly onSelectPlanForPurchase: (productId: string, planId: string) => void;
}

function formatDimensionValue(key: string, value: unknown): string {
  if (key === 'priceVnd' && typeof value === 'number') return formatVnd(value);
  if (key === 'durationMonths' && typeof value === 'number') return `${value} tháng`;
  if (key === 'maxActiveDevices' && typeof value === 'number') return `${value} thiết bị`;
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(
        ([name, item]) =>
          `${name}: ${typeof item === 'boolean' ? (item ? 'Có' : 'Không') : String(item)}`,
      )
      .join(', ');
    return entries || 'Không có';
  }
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '—';
}

export function ComparePlansScreen({
  initialIds = [],
  onBack,
  onSelectPlanForPurchase,
}: ComparePlansScreenProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    [...new Set(initialIds.filter(Boolean))].slice(0, 4),
  );
  const [selectorOpen, setSelectorOpen] = useState(selectedIds.length < 2);
  const [choiceSearch, setChoiceSearch] = useState('');
  const catalog = useCatalogProducts();
  const { comparison, loading, error, reload } = useComparePlans(selectedIds);

  const planById = useMemo(() => {
    const map = new Map<
      string,
      { id: string; productId: string; productName: string; planName: string; priceVnd: number }
    >();
    for (const product of catalog.products) {
      for (const plan of product.plans) {
        map.set(plan.id, {
          id: plan.id,
          productId: product.id,
          productName: product.name,
          planName: plan.name,
          priceVnd: plan.priceVnd,
        });
      }
    }
    return map;
  }, [catalog.products]);

  const groupedProducts = useMemo(() => {
    const needle = choiceSearch.trim().toLocaleLowerCase('vi-VN');
    return catalog.products
      .filter((product) => product.plans.length > 0)
      .map((product) => {
        const productMatches = product.name.toLocaleLowerCase('vi-VN').includes(needle);
        const plans =
          !needle || productMatches
            ? product.plans
            : product.plans.filter((plan) =>
                plan.name.toLocaleLowerCase('vi-VN').includes(needle),
              );
        return { product, plans };
      })
      .filter((entry) => entry.plans.length > 0);
  }, [catalog.products, choiceSearch]);

  const sortedDimensions = useMemo(() => {
    if (!comparison) return [];
    return [...comparison.dimensions].sort((a, b) => {
      const idxA = DIMENSION_ORDER.indexOf(a.key);
      const idxB = DIMENSION_ORDER.indexOf(b.key);
      const rankA = idxA === -1 ? 999 : idxA;
      const rankB = idxB === -1 ? 999 : idxB;
      return rankA - rankB;
    });
  }, [comparison]);

  const toggleId = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 4
          ? [...current, id]
          : current,
    );
  };

  return (
    <Screen header={<AppHeader onBack={onBack} title="So sánh gói" />}>
      <SurfaceCard>
        <View style={styles.selectorHeader}>
          <View style={styles.selectorTitle}>
            <AppText variant="cardTitle">Đã chọn {selectedIds.length}/4 gói</AppText>
            <AppText tone="secondary" variant="secondary">
              Chọn từ 2 đến 4 gói để đối chiếu quyền lợi và giá
            </AppText>
          </View>
          <AppButton
            label={selectorOpen ? 'Thu gọn' : 'Chỉnh lựa chọn'}
            onPress={() => setSelectorOpen((v) => !v)}
            variant="secondary"
          />
        </View>

        {selectedIds.length > 0 ? (
          <View style={styles.selectedChips}>
            {selectedIds.map((id) => {
              const found = planById.get(id);
              const label = found
                ? `${found.productName} · ${found.planName}`
                : id;
              return (
                <Pressable
                  key={id}
                  accessibilityLabel={`Bỏ chọn ${label}`}
                  accessibilityRole="button"
                  onPress={() => toggleId(id)}
                  style={styles.selectedChip}
                >
                  <AppText numberOfLines={1} style={styles.selectedChipText} tone="info" variant="secondarySemibold">
                    {label}
                  </AppText>
                  <AppIcon name="close" size={14} tone="info" />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {selectedIds.length >= 4 ? (
          <InlineNotice
            message="Đã đạt giới hạn tối đa 4 gói. Bỏ bớt một gói nếu muốn chọn gói khác."
            tone="info"
          />
        ) : null}

        {selectorOpen ? (
          catalog.loading && catalog.products.length === 0 ? (
            <FeedbackState mode="loading" title="Đang tải danh sách gói..." />
          ) : catalog.error && catalog.products.length === 0 ? (
            <InlineNotice
              actionLabel="Thử lại"
              message={catalog.error}
              onAction={() => void catalog.reload()}
              tone="error"
            />
          ) : catalog.products.length === 0 ? (
            <InlineNotice message="Hiện chưa có gói nào để chọn so sánh." tone="info" />
          ) : (
            <View style={styles.choicesList}>
              <TextInput
                accessibilityLabel="Tìm sản phẩm hoặc gói để so sánh"
                onChangeText={setChoiceSearch}
                placeholder="Tìm theo tên sản phẩm hoặc gói..."
                placeholderTextColor={colors.muted}
                style={styles.choiceSearchInput}
                value={choiceSearch}
              />
              {groupedProducts.length === 0 ? (
                <AppText tone="muted" variant="secondary">
                  Không có gói nào phù hợp với từ khóa "{choiceSearch.trim()}".
                </AppText>
              ) : (
                groupedProducts.map(({ product, plans }) => (
                  <View key={product.id} style={styles.productGroup}>
                    <AppText tone="muted" variant="secondarySemibold">
                      {product.name}
                    </AppText>
                    {plans.map((plan) => {
                      const checked = selectedIds.includes(plan.id);
                      const disabled = !checked && selectedIds.length >= 4;
                      return (
                        <Pressable
                          key={plan.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked, disabled }}
                          disabled={disabled}
                          onPress={() => toggleId(plan.id)}
                          style={[
                            styles.choiceRow,
                            checked ? styles.choiceSelected : null,
                            disabled ? styles.choiceDisabled : null,
                          ]}
                        >
                          <AppIcon
                            name={checked ? 'checkCircle' : 'plus'}
                            size={sizes.iconSm}
                            tone={checked ? 'info' : 'muted'}
                          />
                          <AppText style={styles.choiceText} variant="secondarySemibold">
                            {formatPlanDisplayName(plan.name)}
                          </AppText>
                          <AppText tone="primary" variant="secondarySemibold">
                            {formatVnd(plan.priceVnd)}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                ))
              )}
            </View>
          )
        ) : null}
      </SurfaceCard>

      {selectedIds.length < 2 ? (
        catalog.error && catalog.products.length === 0 ? (
          <FeedbackState
            actionLabel="Thử lại"
            mode="error"
            onAction={() => void catalog.reload()}
            title={catalog.error}
          />
        ) : !catalog.loading ? (
          <FeedbackState
            description="Hãy chọn ít nhất 2 gói ở trên để bắt đầu so sánh."
            mode="empty"
            title="Chưa đủ gói để so sánh"
          />
        ) : null
      ) : loading ? (
        <FeedbackState mode="loading" title="Đang so sánh các gói..." />
      ) : error ? (
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reload()}
          title={error}
        />
      ) : comparison ? (
        <View style={styles.results}>
          {sortedDimensions.map((dimension) => (
            <SurfaceCard key={dimension.key}>
              <AppText variant="cardTitle">{dimension.label}</AppText>
              {comparison.plans.map((plan) => (
                <View key={plan.id} style={styles.compareRow}>
                  <View style={styles.planLabelCol}>
                    <AppText variant="secondarySemibold">
                      {plan.productName} · {plan.name} (v{plan.version})
                    </AppText>
                  </View>
                  <AppText style={styles.valueText} variant="bodySemibold">
                    {formatDimensionValue(dimension.key, dimension.values[plan.id])}
                  </AppText>
                </View>
              ))}
            </SurfaceCard>
          ))}

          <View style={styles.ctaList}>
            {comparison.plans.map((plan) => (
              <SurfaceCard key={plan.id}>
                <AppText variant="cardTitle">
                  {plan.productName} · {plan.name}
                </AppText>
                <AppButton
                  fullWidth
                  label={`Chọn gói ${plan.name}`}
                  onPress={() => onSelectPlanForPurchase(plan.productId, plan.id)}
                />
              </SurfaceCard>
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  selectorTitle: {
    flex: 1,
    gap: spacing.xxs,
  },
  choicesList: {
    gap: spacing.sm,
  },
  selectedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  selectedChip: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    flexDirection: 'row',
    gap: spacing.xxs,
    maxWidth: '100%',
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  selectedChipText: {
    flexShrink: 1,
  },
  choiceSearchInput: {
    ...typography.body,
    backgroundColor: colors.canvas,
    borderColor: colors.control,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    color: colors.text,
    minHeight: sizes.minHitTarget,
    paddingHorizontal: spacing.sm,
  },
  productGroup: {
    gap: spacing.xs,
  },
  choiceRow: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: sizes.minHitTarget,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  choiceSelected: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.primary,
  },
  choiceDisabled: {
    backgroundColor: colors.surfaceDisabled,
    borderColor: colors.disabledBorder,
  },
  choiceText: {
    flex: 1,
  },
  results: {
    gap: spacing.sm,
  },
  compareRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: sizes.borderWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  planLabelCol: {
    flex: 1,
  },
  valueText: {
    flexShrink: 1,
    textAlign: 'right',
  },
  ctaList: {
    gap: spacing.sm,
  },
});
