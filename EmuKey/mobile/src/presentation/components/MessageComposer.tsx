import { StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, sizes, spacing, typography } from '../theme/tokens';
import { AppButton } from './ui/AppButton';
import { AppText } from './ui/AppText';
import { InlineNotice } from './ui/InlineNotice';

export interface MessageComposerProps {
  readonly draft: string;
  readonly onChangeDraft: (text: string) => void;
  readonly maxLength: number;
  readonly placeholder?: string;
  readonly accessibilityLabel?: string;
  readonly primaryLabel: string;
  readonly onPrimaryPress: () => void;
  readonly primaryDisabled?: boolean;
  readonly pending?: boolean;
  readonly secondaryLabel?: string;
  readonly onSecondaryPress?: () => void;
  readonly secondaryDisabled?: boolean;
  readonly readOnly?: boolean;
  readonly readOnlyMessage?: string;
  readonly onFollowUpPress?: () => void;
  readonly followUpLabel?: string;
  readonly includeBottomInset?: boolean;
}

export function MessageComposer({
  draft,
  onChangeDraft,
  maxLength,
  placeholder = 'Nhập câu hỏi hoặc tin nhắn...',
  accessibilityLabel = 'Tin nhắn hỗ trợ',
  primaryLabel,
  onPrimaryPress,
  primaryDisabled = false,
  pending = false,
  secondaryLabel,
  onSecondaryPress,
  secondaryDisabled = false,
  readOnly = false,
  readOnlyMessage = 'Hội thoại đã đóng.',
  onFollowUpPress,
  followUpLabel = 'Tạo yêu cầu tiếp theo',
  includeBottomInset = true,
}: MessageComposerProps) {
  const insets = useSafeAreaInsets();
  const paddingBottom = spacing.sm + (includeBottomInset ? insets.bottom : 0);
  const nearLimit = draft.length >= Math.floor(maxLength * 0.85);

  if (readOnly) {
    return (
      <View style={[styles.container, { paddingBottom }]}>
        <InlineNotice message={readOnlyMessage} tone="neutral" />
        {onFollowUpPress ? (
          <AppButton label={followUpLabel} onPress={onFollowUpPress} variant="primary" />
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom }]}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        editable={!pending}
        maxLength={maxLength}
        multiline
        onChangeText={onChangeDraft}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={draft}
      />
      <View style={styles.footerRow}>
        {nearLimit ? (
          <AppText
            tone={draft.length >= maxLength ? 'error' : 'muted'}
            variant="tabLabel"
          >
            {draft.length}/{maxLength} ký tự
          </AppText>
        ) : (
          <View />
        )}
        <View style={styles.actions}>
          {secondaryLabel && onSecondaryPress ? (
            <AppButton
              disabled={secondaryDisabled || pending}
              label={secondaryLabel}
              onPress={onSecondaryPress}
              variant="secondary"
            />
          ) : null}
          <AppButton
            disabled={primaryDisabled || pending}
            icon="send"
            label={primaryLabel}
            loading={pending}
            onPress={onPrimaryPress}
            variant="primary"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: sizes.borderWidth,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.canvas,
    borderColor: colors.control,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    color: colors.text,
    maxHeight: 120,
    minHeight: sizes.controlHeight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlignVertical: 'top',
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
