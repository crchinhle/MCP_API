import AntDesign from '@expo/vector-icons/AntDesign';
import type { ComponentProps } from 'react';

import { colors, sizes } from '../../theme/tokens';
import type { TextTone } from './AppText';

type AntDesignGlyph = ComponentProps<typeof AntDesign>['name'];

export type AppIconName =
  | 'home'
  | 'cart'
  | 'orders'
  | 'account'
  | 'bell'
  | 'search'
  | 'filter'
  | 'license'
  | 'device'
  | 'support'
  | 'assistant'
  | 'copy'
  | 'eye'
  | 'eyeOff'
  | 'chevron'
  | 'chevronDown'
  | 'back'
  | 'close'
  | 'check'
  | 'checkCircle'
  | 'warning'
  | 'info'
  | 'book'
  | 'document'
  | 'plus'
  | 'minus'
  | 'refresh'
  | 'export'
  | 'send'
  | 'lock'
  | 'message';

const iconGlyphMap: Record<AppIconName, AntDesignGlyph> = {
  home: 'home',
  cart: 'shopping-cart',
  orders: 'profile',
  account: 'user',
  bell: 'bell',
  search: 'search',
  filter: 'filter',
  license: 'safety-certificate',
  device: 'laptop',
  support: 'customer-service',
  assistant: 'robot',
  copy: 'copy',
  eye: 'eye',
  eyeOff: 'eye-invisible',
  chevron: 'right',
  chevronDown: 'down',
  back: 'arrow-left',
  close: 'close',
  check: 'check',
  checkCircle: 'check-circle',
  warning: 'warning',
  info: 'info-circle',
  book: 'book',
  document: 'file-text',
  plus: 'plus',
  minus: 'minus',
  refresh: 'reload',
  export: 'export',
  send: 'send',
  lock: 'lock',
  message: 'message',
};

const iconToneColors: Record<TextTone, string> = {
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

export interface AppIconProps {
  readonly name: AppIconName;
  readonly size?: number;
  readonly tone?: TextTone;
  readonly color?: string;
}

export function AppIcon({
  name,
  size = sizes.iconMd,
  tone = 'default',
  color,
}: AppIconProps) {
  return (
    <AntDesign
      accessibilityElementsHidden
      color={color ?? iconToneColors[tone]}
      importantForAccessibility="no"
      name={iconGlyphMap[name]}
      size={size}
    />
  );
}
