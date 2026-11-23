import { Pressable, StyleSheet, View } from 'react-native';

import type { MobileOrderTerms } from '../../infrastructure/api/client';
import { colors, radius, sizes, spacing } from '../theme/tokens';
import { AppButton } from './ui/AppButton';
import { AppIcon } from './ui/AppIcon';
import { AppText } from './ui/AppText';
import { InlineNotice } from './ui/InlineNotice';
import { SurfaceCard } from './ui/SurfaceCard';

export interface TermsAcceptanceProps {
  readonly title?: string;
  readonly terms: MobileOrderTerms | null;
  readonly state: 'idle' | 'loading' | 'ready' | 'error';
  readonly accepted: boolean;
  readonly disabled?: boolean;
  readonly onChangeAccepted: (accepted: boolean) => void;
  readonly onRetry: () => void;
}

export function TermsAcceptance({
  title = 'Điều khoản dịch vụ',
  terms,
  state,
  accepted,
  disabled = false,
  onChangeAccepted,
  onRetry,
}: TermsAcceptanceProps) {
  if (state === 'error') {
    return (
      <SurfaceCard>
        <AppText accessibilityRole="header" variant="cardTitle">
          {title}
        </AppText>
        <InlineNotice
          actionLabel="Tải lại điều khoản"
          message="Chưa tải được điều khoản dịch vụ."
          onAction={onRetry}
          tone="error"
        />
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard>
      <AppText accessibilityRole="header" variant="cardTitle">
        {title}
      </AppText>
      {state === 'loading' || !terms ? (
        <AppText tone="secondary" variant="body">
          Đang tải điều khoản...
        </AppText>
      ) : (
        <>
          <AppText selectable variant="body">
            {terms.content}
          </AppText>
          <View style={styles.versionBox}>
            <AppText tone="muted" variant="secondarySemibold">
              Thông tin phiên bản
            </AppText>
            <AppText tone="secondary" variant="secondary">
              Phiên bản: {terms.version}
            </AppText>
            <AppText selectable tone="muted" variant="mono">
              Hash: {terms.hash}
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Tôi đã đọc và đồng ý với điều khoản dịch vụ"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted, disabled }}
            disabled={disabled}
            onPress={() => onChangeAccepted(!accepted)}
            style={({ pressed }) => [
              styles.checkboxRow,
              accepted ? styles.checkboxSelected : null,
              disabled ? styles.checkboxDisabled : null,
              pressed && !disabled ? styles.pressed : null,
            ]}
          >
            <View
              style={[
                styles.box,
                accepted ? styles.boxChecked : null,
                disabled && !accepted ? styles.boxDisabled : null,
              ]}
            >
              {accepted ? <AppIcon name="check" size={14} tone="onPrimary" /> : null}
            </View>
            <AppText
              style={styles.checkboxLabel}
              tone={disabled ? 'disabled' : 'default'}
              variant="body"
            >
              Tôi đã đọc và đồng ý với điều khoản dịch vụ
            </AppText>
          </Pressable>
        </>
      )}
      {state === 'idle' && !terms ? (
        <AppButton label="Tải điều khoản" onPress={onRetry} variant="secondary" />
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  versionBox: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    gap: spacing.xxs,
    padding: spacing.sm,
  },
  checkboxRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.control,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: sizes.minHitTarget,
    padding: spacing.sm,
  },
  checkboxSelected: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.primary,
  },
  checkboxDisabled: {
    backgroundColor: colors.surfaceDisabled,
    borderColor: colors.disabledBorder,
  },
  pressed: {
    backgroundColor: colors.surfaceSelected,
  },
  box: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.controlBorderStrong,
    borderRadius: 4,
    borderWidth: 1.5,
    flexShrink: 0,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  boxDisabled: {
    backgroundColor: colors.surfaceDisabled,
    borderColor: colors.textDisabled,
  },
  checkboxLabel: {
    flex: 1,
  },
});
