import { DefaultTheme, type Theme } from '@react-navigation/native';

import { colors } from './tokens';

export const mobileNavigationTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.canvas,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.errorText,
  },
};
