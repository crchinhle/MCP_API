import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, sizes, spacing } from '../../theme/tokens';

export interface SurfaceCardProps {
  readonly children: ReactNode;
  readonly onPress?: () => void;
  readonly selected?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly accessibilityState?: { selected?: boolean; disabled?: boolean };
  readonly testID?: string;
}

export function SurfaceCard({
  children,
  onPress,
  selected = false,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  testID,
}: SurfaceCardProps) {
  const cardStyle = [
    styles.card,
    selected ? styles.selected : null,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ selected, ...accessibilityState }}
        onPress={onPress}
        style={({ pressed }) => [
          ...cardStyle,
          pressed ? styles.pressed : null,
        ]}
        testID={testID}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: sizes.borderWidth,
    gap: spacing.sm,
    padding: spacing.md,
  },
  selected: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  pressed: {
    backgroundColor: colors.surfaceSelected,
  },
});
