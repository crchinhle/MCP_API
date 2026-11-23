import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, sizes, spacing } from '../../theme/tokens';
import { NotificationBell } from '../NotificationBell';
import { AppIcon } from '../ui/AppIcon';
import { AppText } from '../ui/AppText';

export interface AppHeaderProps {
  readonly title?: string;
  readonly brand?: boolean;
  readonly onBack?: () => void;
  readonly onNotifications?: () => void;
  readonly showBell?: boolean;
  readonly trailing?: ReactNode;
  readonly includeTopInset?: boolean;
}

export function AppHeader({
  title,
  brand = false,
  onBack,
  onNotifications,
  showBell = false,
  trailing,
  includeTopInset = true,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const paddingTop = includeTopInset ? insets.top : 0;

  return (
    <View style={[styles.wrapper, { paddingTop }]}>
      <View style={styles.bar}>
        <View style={styles.left}>
          {onBack ? (
            <Pressable
              accessibilityLabel="Quay lại"
              accessibilityRole="button"
              onPress={onBack}
              style={({ pressed }) => [styles.iconBtn, pressed ? styles.pressed : null]}
            >
              <AppIcon name="back" size={sizes.iconMd} tone="default" />
            </Pressable>
          ) : null}
          {brand ? (
            <AppText
              accessibilityRole="header"
              numberOfLines={1}
              tone="primary"
              variant="brandWordmark"
            >
              EmuKey
            </AppText>
          ) : (
            <AppText
              accessibilityRole="header"
              numberOfLines={1}
              style={styles.title}
              variant="sectionTitle"
            >
              {title ?? ''}
            </AppText>
          )}
        </View>
        <View style={styles.right}>
          {trailing}
          {showBell && onNotifications ? (
            <NotificationBell onPress={onNotifications} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: sizes.borderWidth,
  },
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  left: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  title: {
    flexShrink: 1,
  },
  right: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: sizes.minHitTarget,
    minWidth: sizes.minHitTarget,
  },
  pressed: {
    backgroundColor: colors.surfaceSelected,
  },
});
