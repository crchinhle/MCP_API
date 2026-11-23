import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MobileApiError, register } from '../../../infrastructure/api/client';
import type { RegisterDto } from '../../../infrastructure/api/generated';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { FormField } from '../../components/ui/FormField';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { colors, radius, sizes, spacing } from '../../theme/tokens';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/;

const CUSTOMER_TYPES: { value: RegisterDto['customerType']; label: string }[] = [
  { value: 'INDIVIDUAL', label: 'Cá nhân' },
  { value: 'STUDENT', label: 'Học sinh / sinh viên' },
  { value: 'BUSINESS', label: 'Doanh nghiệp' },
];

export interface RegisterScreenProps {
  readonly onBack: () => void;
  readonly onRegistered: (email: string) => void;
}

export function RegisterScreen({ onBack, onRegistered }: RegisterScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [customerType, setCustomerType] =
    useState<RegisterDto['customerType']>('INDIVIDUAL');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError =
    (nameTouched || displayName.length > 0) && !displayName.trim()
      ? 'Vui lòng nhập họ và tên.'
      : null;
  const emailTrimmed = email.trim();
  const emailError =
    (emailTouched || email.length > 0) && !emailTrimmed
      ? 'Vui lòng nhập địa chỉ email.'
      : (emailTouched || email.length > 0) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)
        ? 'Email chưa đúng định dạng.'
        : null;
  const passwordError =
    password.length > 0 && (password.length < 8 || !PASSWORD_PATTERN.test(password))
      ? 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.'
      : null;
  const confirmError =
    confirmPassword.length > 0 && confirmPassword !== password
      ? 'Mật khẩu xác nhận không khớp.'
      : null;

  const canSubmit =
    Boolean(displayName.trim()) &&
    Boolean(emailTrimmed) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed) &&
    password.length >= 8 &&
    PASSWORD_PATTERN.test(password) &&
    confirmPassword === password &&
    !pending;

  const submit = async () => {
    setNameTouched(true);
    setEmailTouched(true);
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      await register({
        customerType,
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
      onRegistered(email.trim());
    } catch (cause) {
      if (cause instanceof MobileApiError && cause.status === 429) {
        setError('Bạn gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau.');
      } else {
        setError('Không thể tạo tài khoản. Email có thể đã được sử dụng hoặc chưa hợp lệ.');
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen
      edges={['bottom']}
      header={<AppHeader onBack={onBack} title="Đăng ký tài khoản" />}
      keyboardAware
    >
      <InlineNotice
        message="Tạo tài khoản khách hàng EmuKey để mua và quản lý bản quyền."
        tone="info"
      />

      <SurfaceCard>
        <FormField
          editable={!pending}
          errorText={nameError}
          label="Họ và tên"
          maxLength={255}
          onBlur={() => setNameTouched(true)}
          onChangeText={(next) => {
            setNameTouched(true);
            setDisplayName(next);
          }}
          placeholder="Nguyễn Văn A"
          required
          value={displayName}
        />

        <View style={styles.group}>
          <AppText tone="secondary" variant="secondarySemibold">
            Loại khách hàng *
          </AppText>
          <View style={styles.typeChips}>
            {CUSTOMER_TYPES.map((option) => {
              const selected = customerType === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  disabled={pending}
                  onPress={() => setCustomerType(option.value)}
                  style={[styles.chip, selected ? styles.chipSelected : null]}
                >
                  <AppText
                    tone={selected ? 'info' : 'secondary'}
                    variant={selected ? 'secondarySemibold' : 'secondary'}
                  >
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <FormField
          autoCapitalize="none"
          autoComplete="email"
          editable={!pending}
          errorText={emailError}
          keyboardType="email-address"
          label="Email"
          onBlur={() => setEmailTouched(true)}
          onChangeText={(next) => {
            setEmailTouched(true);
            setEmail(next);
          }}
          placeholder="ban@example.com"
          required
          value={email}
        />

        <FormField
          autoCapitalize="none"
          editable={!pending}
          errorText={passwordError}
          helperText="Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt."
          label="Mật khẩu"
          onChangeText={setPassword}
          passwordToggle
          required
          secureTextEntry
          value={password}
        />

        <FormField
          autoCapitalize="none"
          editable={!pending}
          errorText={confirmError}
          label="Xác nhận mật khẩu"
          onChangeText={setConfirmPassword}
          passwordToggle
          required
          secureTextEntry
          value={confirmPassword}
        />

        {error ? <InlineNotice message={error} tone="error" /> : null}

        <AppButton
          disabled={!canSubmit}
          fullWidth
          label="Tạo tài khoản"
          loading={pending}
          onPress={() => void submit()}
          size="large"
        />
      </SurfaceCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.xs,
  },
  typeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.control,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    justifyContent: 'center',
    minHeight: sizes.minHitTarget,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.primary,
  },
});
