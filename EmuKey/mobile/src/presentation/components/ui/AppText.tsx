import { useState } from 'react';
import {
  Platform,
  Text,
  type LayoutChangeEvent,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { colors, typography, type TextVariant } from '../../theme/tokens';

export type TextTone =
  | 'default'
  | 'secondary'
  | 'muted'
  | 'disabled'
  | 'primary'
  | 'link'
  | 'onPrimary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

const toneColorMap: Record<TextTone, string> = {
  default: colors.text,
  secondary: colors.textSecondary,
  muted: colors.muted,
  disabled: colors.textDisabled,
  primary: colors.primary,
  link: colors.link,
  onPrimary: colors.onPrimary,
  info: colors.infoText,
  success: colors.successText,
  warning: colors.warningText,
  error: colors.errorText,
};

export interface AppTextProps extends TextProps {
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
  /**
   * Prevents Android Fabric StaticLayout subpixel rounding / API 35 bounds
   * checks from wrapping short single-line pills (e.g. "Đã hủy", "Đang hoạt động")
   * onto a clipped second line while still allowing legitimately wide strings to wrap.
   */
  readonly singleLineSafe?: boolean;
}

export function AppText({
  variant = 'body',
  tone = 'default',
  singleLineSafe = false,
  onLayout,
  style,
  children,
  ...rest
}: AppTextProps) {
  const [safeWidthState, setSafeWidthState] = useState<{
    readonly key: string;
    readonly width: number;
  } | null>(null);
  const labelKey = `${variant}:${typeof children === 'string' || typeof children === 'number' ? String(children) : ''}`;
  const appliedMinWidth =
    singleLineSafe && Platform.OS === 'android' && safeWidthState?.key === labelKey
      ? safeWidthState.width
      : undefined;

  const handleLayout = (event: LayoutChangeEvent) => {
    onLayout?.(event);
    if (!singleLineSafe || Platform.OS !== 'android') {
      return;
    }
    const measuredWidth = event.nativeEvent.layout.width;
    if (measuredWidth > 0 && measuredWidth < 240 && safeWidthState?.key !== labelKey) {
      setSafeWidthState({
        key: labelKey,
        width: Math.ceil(measuredWidth) + 4,
      });
    }
  };

  const baseStyle: TextStyle = {
    ...typography[variant],
    color: toneColorMap[tone],
  };

  return (
    <Text
      {...rest}
      key={singleLineSafe ? (appliedMinWidth ? `w-${appliedMinWidth}` : 'natural') : undefined}
      onLayout={singleLineSafe || onLayout ? handleLayout : undefined}
      style={[
        baseStyle,
        appliedMinWidth ? { width: appliedMinWidth, textAlign: 'center' } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
