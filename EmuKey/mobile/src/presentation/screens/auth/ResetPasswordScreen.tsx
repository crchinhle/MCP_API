import { useState } from 'react';

import { resetPassword } from '../../../infrastructure/api/client';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { FormField } from '../../components/ui/FormField';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/;

export interface ResetPasswordScreenProps {
  readonly token?: string;
  readonly onBackToLogin: () => void;
  readonly onRequestNewLink: () => void;
}

export function ResetPasswordScreen({
  token = '',
  onBackToLogin,
  onRequestNewLink,
}: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingToken = !token.trim();
  const passwordError =
    password.length > 0 &&
    (password.length < 12 ||
      password.length > 128 ||
      !STRONG_PASSWORD_PATTERN.test(password))
      ? 'Mật khẩu mới cần 12–128 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.'
      : null;
  const confirmError =
    confirmPassword.length > 0 && confirmPassword !== password
      ? 'Mật khẩu xác nhận không khớp.'
      : null;

  const canSubmit =
    !missingToken &&
    password.length >= 12 &&
    password.length <= 128 &&
    STRONG_PASSWORD_PATTERN.test(password) &&
    confirmPassword === password &&
    !pending;

  const submit = async () => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch {
      setError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen
      edges={['bottom']}
      header={<AppHeader onBack={onBackToLogin} title="Đặt lại mật khẩu" />}
      keyboardAware
    >
      <SurfaceCard>
        {done ? (
          <>
            <InlineNotice
              message="Đã đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới."
              tone="success"
            />
            <AppButton
              fullWidth
              label="Đăng nhập"
              onPress={onBackToLogin}
              size="large"
            />
          </>
        ) : missingToken ? (
          <>
            <InlineNotice
              message="Liên kết đặt lại mật khẩu thiếu mã xác thực hoặc đã hết hạn."
              tone="error"
            />
            <AppButton
              fullWidth
              label="Yêu cầu liên kết mới"
              onPress={onRequestNewLink}
              variant="primary"
            />
          </>
        ) : (
          <>
            <FormField
              autoCapitalize="none"
              editable={!pending}
              errorText={passwordError}
              helperText="Ít nhất 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt."
              label="Mật khẩu mới"
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
              label="Xác nhận mật khẩu mới"
              onChangeText={setConfirmPassword}
              passwordToggle
              required
              secureTextEntry
              value={confirmPassword}
            />
            {error ? (
              <InlineNotice
                actionLabel="Yêu cầu liên kết mới"
                message={error}
                onAction={onRequestNewLink}
                tone="error"
              />
            ) : null}
            <AppButton
              disabled={!canSubmit}
              fullWidth
              label="Đặt lại mật khẩu"
              loading={pending}
              onPress={() => void submit()}
              size="large"
            />
          </>
        )}
      </SurfaceCard>
    </Screen>
  );
}
