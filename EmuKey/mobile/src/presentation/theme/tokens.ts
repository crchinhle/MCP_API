export const colors = {
  canvas: '#f7f9fb',
  surface: '#ffffff',
  surfaceSelected: '#f1f5f9',
  subtle: '#f1f5f9',
  surfaceDisabled: '#f1f5f9',
  text: '#1c1c1a',
  textSecondary: '#4a4844',
  muted: '#5e5b54',
  textDisabled: '#94a3b8',
  border: '#e2e8f0',
  disabledBorder: '#e2e8f0',
  control: '#cbd5e1',
  controlBorderStrong: '#5e5b54',
  primary: '#1a4dc7',
  primaryPressed: '#163fa4',
  link: '#163fa4',
  onPrimary: '#ffffff',
  focusHalo: 'rgba(26, 77, 199, 0.14)',
  overlayBackdrop: 'rgba(28, 28, 26, 0.45)',
  skeleton: '#e2e8f0',
  infoSurface: '#eef4ff',
  infoBorder: '#cbd5e1',
  infoText: '#163fa4',
  successSurface: '#e7f4ec',
  successBorder: '#a9d9bc',
  successText: '#1f6f46',
  warningSurface: '#fbf0d6',
  warningBorder: '#e8c468',
  warningText: '#7a5200',
  errorSurface: '#fbeaea',
  errorBorder: '#e7acac',
  errorText: '#9b2226',
  dangerPressed: '#7f1b1e',
  neutralSurface: '#edebe5',
  neutralBorder: '#b0ada6',
  neutralText: '#4a4844',
} as const;

export type SemanticTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export const toneColors: Record<
  SemanticTone,
  { background: string; border: string; text: string }
> = {
  neutral: {
    background: colors.neutralSurface,
    border: colors.neutralBorder,
    text: colors.neutralText,
  },
  info: {
    background: colors.infoSurface,
    border: colors.infoBorder,
    text: colors.infoText,
  },
  success: {
    background: colors.successSurface,
    border: colors.successBorder,
    text: colors.successText,
  },
  warning: {
    background: colors.warningSurface,
    border: colors.warningBorder,
    text: colors.warningText,
  },
  error: {
    background: colors.errorSurface,
    border: colors.errorBorder,
    text: colors.errorText,
  },
};

export const fontFamilies = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
  brand: 'GreatVibes_400Regular',
  mono: 'monospace',
} as const;

export const typography = {
  brandWordmark: {
    fontFamily: fontFamilies.brand,
    fontSize: 30,
    lineHeight: 38,
  },
  pageTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 24,
    lineHeight: 32,
  },
  detailHeadline: {
    fontFamily: fontFamilies.semibold,
    fontSize: 22,
    lineHeight: 30,
  },
  sectionTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 20,
    lineHeight: 28,
  },
  cardTitle: {
    fontFamily: fontFamilies.semibold,
    fontSize: 18,
    lineHeight: 26,
  },
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  bodySemibold: {
    fontFamily: fontFamilies.semibold,
    fontSize: 16,
    lineHeight: 24,
  },
  secondary: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  secondarySemibold: {
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  tabLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  priceDetail: {
    fontFamily: fontFamilies.semibold,
    fontSize: 24,
    lineHeight: 32,
  },
  priceCard: {
    fontFamily: fontFamilies.semibold,
    fontSize: 18,
    lineHeight: 26,
  },
  mono: {
    fontFamily: fontFamilies.mono,
    fontSize: 14,
    lineHeight: 20,
  },
} as const;

export type TextVariant = keyof typeof typography;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radius = {
  control: 8,
  card: 12,
  sheet: 20,
  pill: 9999,
} as const;

export const sizes = {
  minHitTarget: 48,
  controlHeight: 48,
  bottomCtaHeight: 52,
  tabBarContentHeight: 64,
  iconSm: 18,
  iconMd: 20,
  iconLg: 24,
  borderWidth: 1,
} as const;
