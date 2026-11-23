import { StyleSheet, View } from 'react-native';

import { radius, sizes, spacing, toneColors, type SemanticTone } from '../../theme/tokens';
import { AppButton } from './AppButton';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText, type TextTone } from './AppText';

const iconByTone: Record<SemanticTone, AppIconName> = {
  neutral: 'info',
  info: 'info',
  success: 'checkCircle',
  warning: 'warning',
  error: 'warning',
};

const textToneBySemantic: Record<SemanticTone, TextTone> = {
  neutral: 'secondary',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

export interface InlineNoticeProps {
  readonly tone?: SemanticTone;
  readonly title?: string;
  readonly message: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly actionLoading?: boolean;
}

export function InlineNotice({
  tone = 'info',
  title,
  message,
  actionLabel,
  onAction,
  actionLoading = false,
}: InlineNoticeProps) {
  const palette = toneColors[tone];
  const textTone = textToneBySemantic[tone];

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={[
        styles.container,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <AppIcon name={iconByTone[tone]} size={sizes.iconSm} tone={textTone} />
        </View>
        <View style={styles.body}>
          {title ? (
            <AppText tone={textTone} variant="bodySemibold">
              {title}
            </AppText>
          ) : null}
          <AppText tone={textTone} variant="secondary">
            {message}
          </AppText>
        </View>
      </View>
      {actionLabel && onAction ? (
        <View style={styles.actionRow}>
          <AppButton
            label={actionLabel}
            loading={actionLoading}
            onPress={onAction}
            variant="secondary"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconWrap: {
    paddingTop: 2,
  },
  body: {
    flex: 1,
    gap: spacing.xxs,
  },
  actionRow: {
    alignItems: 'flex-start',
    marginTop: spacing.xxs,
  },
});
