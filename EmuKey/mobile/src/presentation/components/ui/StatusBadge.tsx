import { StyleSheet, View } from 'react-native';

import { radius, sizes, spacing, toneColors, type SemanticTone } from '../../theme/tokens';
import { AppIcon, type AppIconName } from './AppIcon';
import { AppText, type TextTone } from './AppText';

const textToneBySemantic: Record<SemanticTone, TextTone> = {
  neutral: 'secondary',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

export interface StatusBadgeProps {
  readonly label: string;
  readonly tone?: SemanticTone;
  readonly icon?: AppIconName;
}

export function StatusBadge({ label, tone = 'neutral', icon }: StatusBadgeProps) {
  const palette = toneColors[tone];
  const textTone = textToneBySemantic[tone];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}
    >
      {icon ? <AppIcon name={icon} size={14} tone={textTone} /> : null}
      <AppText singleLineSafe tone={textTone} variant="secondarySemibold">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
  },
});
