import { useState } from 'react';

import { useCustomerSession } from '../../../application/auth/useCustomerSession';
import { changePassword, MobileApiError } from '../../../infrastructure/api/client';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { FormField } from '../../components/ui/FormField';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/;

export interface ChangePasswordScreenProps {
  readonly onBack: () => void;
}

export function ChangePasswordScreen({ onBack }: ChangePasswordScreenProps) {
  const { signOut } = useCustomerSession();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const newPasswordError =
    newPassword.length > 0 &&
    (newPassword.length < 12 ||
      newPassword.length > 128 ||
      !STRONG_PASSWORD_PATTERN.test(newPassword))
      ? 'Mật khẩu mới cần 12–128 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.'
      : null;

  const confirmError =
    confirmPassword.length > 0 && confirmPassword !== newPassword
      ? 'Mật khẩu xác nhận không khớp.'
      : null;

  const canSubmit =
    Boolean(currentPassword) &&
    newPassword.length >= 12 &&
    newPassword.length <= 128 &&
    STRONG_PASSWORD_PATTERN.test(newPassword) &&
    confirmPassword === newPassword &&
    !pending &&
    !done;

  const submit = async () => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      await changePassword({
        currentPassword,
        password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setDone(true);
      await signOut().catch(() => undefined);
    } catch (cause) {
      if (cause instanceof MobileApiError && cause.status === 401) {
        setError('Mật khẩu hiện tại không đúng.');
      } else {
        setError('Không thể đổi mật khẩu. Vui lòng kiểm tra thông tin và thử lại.');
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen header={<AppHeader onBack={onBack} title="Đổi mật khẩu" />} keyboardAware>
      <InlineNotice
        message="Sau khi đổi mật khẩu thành công, phiên hiện tại sẽ tự đăng xuất để bảo vệ tài khoản. Bạn cần đăng nhập lại bằng mật khẩu mới."
        tone="info"
      />

      <SurfaceCard>
        {done ? (
          <InlineNotice
            message="Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại."
            tone="success"
          />
        ) : (
          <>
            <FormField
              autoCapitalize="none"
              editable={!pending}
              label="Mật khẩu hiện tại"
              onChangeText={setCurrentPassword}
              passwordToggle
              required
              secureTextEntry
              value={currentPassword}
            />
            <FormField
              autoCapitalize="none"
              editable={!pending}
              errorText={newPasswordError}
              helperText="12–128 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt."
              label="Mật khẩu mới"
              onChangeText={setNewPassword}
              passwordToggle
              required
              secureTextEntry
              value={newPassword}
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

            {error ? <InlineNotice message={error} tone="error" /> : null}

            <AppButton
              disabled={!canSubmit}
              fullWidth
              label="Đổi mật khẩu"
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
