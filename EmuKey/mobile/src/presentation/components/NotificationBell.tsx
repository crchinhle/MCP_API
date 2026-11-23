import { Pressable, StyleSheet, View } from 'react-native';

import { useNotifications } from '../../application/notifications/notificationContext';
import { formatUnreadBadge } from '../formatters';
import { colors, radius, sizes, spacing } from '../theme/tokens';
import { AppIcon } from './ui/AppIcon';
import { AppText } from './ui/AppText';

export interface NotificationBellProps {
  readonly onPress: () => void;
  readonly visible?: boolean;
}

export function NotificationBell({ onPress, visible = true }: NotificationBellProps) {
  const { unreadCount } = useNotifications();
  if (!visible) return null;

  const badgeText = formatUnreadBadge(unreadCount);
  const accessibilityLabel =
    unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
      testID="header-notification-bell"
    >
      <AppIcon name="bell" size={sizes.iconLg} tone="default" />
      {badgeText ? (
        <View style={styles.badge} testID="header-notification-badge">
          <AppText style={styles.badgeText} tone="onPrimary" variant="tabLabel">
            {badgeText}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: sizes.minHitTarget,
    minWidth: sizes.minHitTarget,
    paddingHorizontal: spacing.xs,
  },
  pressed: {
    backgroundColor: colors.surfaceSelected,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.errorText,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    position: 'absolute',
    right: 4,
    top: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
});
