import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, sizes, spacing } from '../../theme/tokens';
import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { InlineNotice } from './InlineNotice';

export interface ConfirmDialogProps {
  readonly visible: boolean;
  readonly title: string;
  readonly body: string;
  readonly warningText?: string;
  readonly errorText?: string | null;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly pending?: boolean;
  readonly danger?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  body,
  warningText,
  errorText,
  confirmLabel,
  cancelLabel = 'Giữ lại',
  pending = false,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onCancel();
      }}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityRole="none"
        onPress={() => {
          if (!pending) onCancel();
        }}
        style={styles.backdrop}
      >
        <Pressable onPress={() => undefined} style={styles.dialog}>
          <AppText accessibilityRole="header" variant="sectionTitle">
            {title}
          </AppText>
          <AppText tone="secondary" variant="body">
            {body}
          </AppText>
          {warningText ? <InlineNotice message={warningText} tone="warning" /> : null}
          {errorText ? <InlineNotice message={errorText} tone="error" /> : null}
          <View style={styles.actions}>
            <AppButton
              disabled={pending}
              label={cancelLabel}
              onPress={onCancel}
              style={styles.actionButton}
              variant="secondary"
            />
            <AppButton
              label={confirmLabel}
              loading={pending}
              onPress={onConfirm}
              style={styles.actionButton}
              variant={danger ? 'danger' : 'primary'}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: colors.overlayBackdrop,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: sizes.borderWidth,
    gap: spacing.md,
    maxWidth: 440,
    padding: spacing.lg,
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  actionButton: {
    flex: 1,
  },
});
