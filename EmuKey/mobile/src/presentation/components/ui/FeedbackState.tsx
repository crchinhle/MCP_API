import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '../../theme/tokens';
import { AppButton } from './AppButton';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText } from './AppText';

export interface FeedbackStateProps {
  readonly mode: 'loading' | 'empty' | 'error';
  readonly title: string;
  readonly description?: string;
  readonly icon?: AppIconName;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly actionLoading?: boolean;
}

export function FeedbackState({
  mode,
  title,
  description,
  icon,
  actionLabel,
  onAction,
  actionLoading = false,
}: FeedbackStateProps) {
  const resolvedIcon: AppIconName = icon ?? (mode === 'error' ? 'warning' : 'info');

  return (
    <View
      accessibilityRole={mode === 'error' ? 'alert' : undefined}
      style={styles.container}
    >
      {mode === 'loading' ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : (
        <View style={[styles.iconCircle, mode === 'error' ? styles.errorCircle : null]}>
          <AppIcon
            name={resolvedIcon}
            size={28}
            tone={mode === 'error' ? 'error' : 'primary'}
          />
        </View>
      )}
      <AppText style={styles.centerText} variant="cardTitle">
        {title}
      </AppText>
      {description ? (
        <AppText style={styles.centerText} tone="secondary" variant="secondary">
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.actionWrap}>
          <AppButton
            label={actionLabel}
            loading={actionLoading}
            onPress={onAction}
            variant={mode === 'error' ? 'primary' : 'secondary'}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  errorCircle: {
    backgroundColor: colors.errorSurface,
  },
  centerText: {
    textAlign: 'center',
  },
  actionWrap: {
    marginTop: spacing.xs,
  },
});
