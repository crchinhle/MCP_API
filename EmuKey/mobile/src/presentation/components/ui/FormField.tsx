import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, radius, sizes, spacing, typography } from '../../theme/tokens';
import { AppIcon } from './AppIcon';
import { AppText } from './AppText';

export interface FormFieldProps extends TextInputProps {
  readonly label: string;
  readonly helperText?: string;
  readonly errorText?: string | null;
  readonly passwordToggle?: boolean;
  readonly required?: boolean;
}

export function FormField({
  label,
  helperText,
  errorText,
  passwordToggle = false,
  required = false,
  secureTextEntry,
  style,
  editable = true,
  accessibilityLabel,
  multiline,
  onBlur,
  onFocus,
  ...rest
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isSecret = Boolean(secureTextEntry);
  const effectiveSecure = isSecret && !revealed;

  return (
    <View style={styles.field}>
      <AppText tone="secondary" variant="secondarySemibold">
        {label}
        {required ? ' *' : ''}
      </AppText>
      <View
        style={[
          styles.inputWrap,
          focused ? styles.inputFocused : null,
          errorText ? styles.inputError : null,
          editable === false ? styles.inputDisabled : null,
        ]}
      >
        <TextInput
          cursorColor={colors.primary}
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
          {...rest}
          accessibilityLabel={accessibilityLabel ?? label}
          editable={editable}
          multiline={multiline}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          secureTextEntry={effectiveSecure}
          style={[
            styles.input,
            editable === false ? styles.inputTextDisabled : null,
            multiline ? styles.multiline : null,
            style,
          ]}
        />
        {isSecret && passwordToggle ? (
          <Pressable
            accessibilityLabel={revealed ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
            accessibilityRole="button"
            onPress={() => setRevealed((current) => !current)}
            style={styles.toggleButton}
          >
            <AppIcon name={revealed ? 'eyeOff' : 'eye'} size={sizes.iconMd} tone="muted" />
          </Pressable>
        ) : null}
      </View>
      {errorText ? (
        <AppText accessibilityRole="alert" tone="error" variant="secondary">
          {errorText}
        </AppText>
      ) : helperText ? (
        <AppText tone="muted" variant="secondary">
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.control,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    flexDirection: 'row',
    minHeight: sizes.controlHeight,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: colors.errorText,
  },
  inputDisabled: {
    backgroundColor: colors.surfaceDisabled,
    borderColor: colors.disabledBorder,
  },
  inputTextDisabled: {
    color: colors.muted,
  },
  input: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    minHeight: sizes.controlHeight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  toggleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizes.minHitTarget,
    minWidth: sizes.minHitTarget,
  },
});
