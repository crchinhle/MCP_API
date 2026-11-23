import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, sizes, spacing } from '../../theme/tokens';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText, type TextTone } from './AppText';

export type AppButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';

export interface AppButtonProps {
  readonly label: string;
  readonly onPress?: () => void;
  readonly variant?: AppButtonVariant;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly icon?: AppIconName;
  readonly size?: 'regular' | 'large';
  readonly fullWidth?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  size = 'regular',
  fullWidth = false,
  style,
  accessibilityLabel,
  testID,
}: AppButtonProps) {
  const isLocked = disabled || loading;
  const isVisuallyDisabled = disabled && !loading;

  const textTone: TextTone = isVisuallyDisabled
    ? 'disabled'
    : variant === 'primary' || variant === 'danger'
      ? 'onPrimary'
      : variant === 'tertiary'
        ? 'link'
        : 'default';

  const spinnerColor =
    variant === 'primary' || variant === 'danger'
      ? colors.onPrimary
      : variant === 'tertiary'
        ? colors.link
        : colors.primary;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isLocked }}
      disabled={isLocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'large' ? styles.large : styles.regular,
        fullWidth ? styles.fullWidth : null,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'tertiary' && styles.tertiary,
        variant === 'danger' && styles.danger,
        pressed && !isLocked && variant === 'primary' && styles.primaryPressed,
        pressed && !isLocked && variant === 'secondary' && styles.secondaryPressed,
        pressed && !isLocked && variant === 'tertiary' && styles.tertiaryPressed,
        pressed && !isLocked && variant === 'danger' && styles.dangerPressed,
        isVisuallyDisabled &&
          (variant === 'tertiary' ? styles.tertiaryDisabled : styles.surfaceDisabled),
        style,
      ]}
      testID={testID}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={spinnerColor} size="small" />
        ) : icon ? (
          <AppIcon name={icon} size={sizes.iconSm} tone={textTone} />
        ) : null}
        <AppText style={styles.label} tone={textTone} variant="bodySemibold">
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radius.control,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  regular: {
    minHeight: sizes.controlHeight,
  },
  large: {
    minHeight: sizes.bottomCtaHeight,
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.control,
    borderWidth: sizes.borderWidth,
  },
  secondaryPressed: {
    backgroundColor: colors.surfaceSelected,
  },
  tertiary: {
    backgroundColor: 'transparent',
  },
  tertiaryPressed: {
    backgroundColor: colors.infoSurface,
  },
  danger: {
    backgroundColor: colors.errorText,
  },
  dangerPressed: {
    backgroundColor: colors.dangerPressed,
  },
  surfaceDisabled: {
    backgroundColor: colors.surfaceDisabled,
    borderColor: colors.disabledBorder,
    borderWidth: sizes.borderWidth,
  },
  tertiaryDisabled: {
    backgroundColor: 'transparent',
  },
});
