import { Pressable, StyleSheet, View } from 'react-native';

import type { PublicCatalogPlanDto } from '../../infrastructure/api/generated';
import { formatPlanDisplayName, formatVnd } from '../formatters';
import { colors, radius, sizes, spacing } from '../theme/tokens';
import { AppIcon } from './ui/AppIcon';
import { AppText } from './ui/AppText';
import { SurfaceCard } from './ui/SurfaceCard';

export interface PlanOptionCardProps {
  readonly plan: PublicCatalogPlanDto;
  readonly selected: boolean;
  readonly onSelect: (planId: string) => void;
  readonly compared?: boolean;
  readonly compareDisabled?: boolean;
  readonly onToggleCompare?: (planId: string) => void;
}

export function PlanOptionCard({
  plan,
  selected,
  onSelect,
  compared = false,
  compareDisabled = false,
  onToggleCompare,
}: PlanOptionCardProps) {
  return (
    <SurfaceCard
      accessibilityLabel={`${formatPlanDisplayName(plan.name)}, ${formatVnd(plan.priceVnd)}, tối đa ${plan.maxActiveDevices} thiết bị, ${plan.durationMonths} tháng`}
      onPress={() => onSelect(plan.id)}
      selected={selected}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <AppText variant="cardTitle">{plan.name}</AppText>
          <AppText tone="secondary" variant="secondary">
            {plan.maxActiveDevices} thiết bị · {plan.durationMonths} tháng
          </AppText>
        </View>
        <AppText tone="primary" variant="priceCard">
          {formatVnd(plan.priceVnd)}
        </AppText>
      </View>

      {onToggleCompare ? (
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityLabel={`${plan.name} - So sánh`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: compared, disabled: compareDisabled && !compared }}
            disabled={compareDisabled && !compared}
            onPress={() => onToggleCompare(plan.id)}
            style={({ pressed }) => [
              styles.compareChip,
              compared ? styles.compareChipSelected : null,
              compareDisabled && !compared ? styles.compareDisabled : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <AppIcon
              name={compared ? 'check' : 'plus'}
              size={14}
              tone={compared ? 'info' : 'secondary'}
            />
            <AppText tone={compared ? 'info' : 'secondary'} variant="secondarySemibold">
              {compared ? 'Đã chọn so sánh' : 'So sánh'}
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  titleCol: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 160,
  },
  actionsRow: {
    alignItems: 'flex-start',
    marginTop: spacing.xxs,
  },
  compareChip: {
    alignItems: 'center',
    borderColor: colors.control,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    flexDirection: 'row',
    gap: spacing.xxs,
    minHeight: sizes.minHitTarget,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  compareChipSelected: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.primary,
  },
  compareDisabled: {
    backgroundColor: colors.surfaceDisabled,
    borderColor: colors.disabledBorder,
  },
  pressed: {
    backgroundColor: colors.surfaceSelected,
  },
});
