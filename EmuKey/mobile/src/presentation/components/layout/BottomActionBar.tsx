import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, sizes, spacing } from '../../theme/tokens';
import { AppText } from '../ui/AppText';

export interface BottomActionBarProps {
  readonly summaryLabel?: string;
  readonly summaryValue?: string;
  readonly primary: ReactNode;
  readonly secondary?: ReactNode;
  readonly includeBottomInset?: boolean;
}

export function BottomActionBar({
  summaryLabel,
  summaryValue,
  primary,
  secondary,
  includeBottomInset = true,
}: BottomActionBarProps) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const stacked = Boolean(secondary) && (width < 360 || fontScale >= 1.5);
  const paddingBottom = spacing.sm + (includeBottomInset ? insets.bottom : 0);

  return (
    <View style={[styles.container, { paddingBottom }]}>
      {summaryLabel || summaryValue ? (
        <View style={styles.summaryRow}>
          {summaryLabel ? (
            <AppText
              style={styles.summaryLabel}
              tone="secondary"
              variant="secondary"
            >
              {summaryLabel}
            </AppText>
          ) : null}
          {summaryValue ? (
            <AppText style={styles.summaryValue} variant="priceCard">
              {summaryValue}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.actionsRow, stacked ? styles.actionsStacked : null]}>
        {secondary ? (
          <View style={stacked ? styles.fullSlot : styles.secondarySlot}>{secondary}</View>
        ) : null}
        <View style={stacked ? styles.fullSlot : styles.primarySlot}>{primary}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: sizes.borderWidth,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  summaryRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  summaryLabel: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 140,
  },
  summaryValue: {
    flexShrink: 0,
  },
  actionsRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionsStacked: {
    flexDirection: 'column-reverse',
  },
  fullSlot: {
    width: '100%',
  },
  secondarySlot: {
    flex: 1,
  },
  primarySlot: {
    flex: 1.55,
  },
});
