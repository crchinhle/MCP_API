import { StyleSheet, View } from 'react-native';

import { colors, sizes, spacing } from '../theme/tokens';
import { AppText } from './ui/AppText';

export interface KeyValueRow {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}

export interface KeyValueListProps {
  readonly rows: readonly KeyValueRow[];
}

export function KeyValueList({ rows }: KeyValueListProps) {
  if (!rows.length) return null;

  return (
    <View style={styles.container}>
      {rows.map((row, index) => (
        <View
          key={`${row.label}-${index}`}
          style={[styles.row, index > 0 ? styles.rowDivider : null]}
        >
          <AppText tone="muted" variant="secondary">
            {row.label}
          </AppText>
          <AppText
            selectable
            variant={row.mono ? 'mono' : 'bodySemibold'}
          >
            {row.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  row: {
    gap: spacing.xxs,
    paddingVertical: spacing.xxs,
  },
  rowDivider: {
    borderTopColor: colors.border,
    borderTopWidth: sizes.borderWidth,
    paddingTop: spacing.xs,
  },
});
