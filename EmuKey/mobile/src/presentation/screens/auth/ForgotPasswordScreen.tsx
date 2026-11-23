import { useState } from 'react';

import { forgotPassword } from '../../../infrastructure/api/client';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { FormField } from '../../components/ui/FormField';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

export interface ForgotPasswordScreenProps {
  readonly onBack: () => void;
}

export function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (pending || !email.trim()) return;
    setPending(true);
    setError(null);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch {
      setError('Không thể gửi yêu cầu. Vui lòng thử lại sau.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen
      edges={['bottom']}
      header={<AppHeader onBack={onBack} title="Quên mật khẩu" />}
      keyboardAware
    >
      <SurfaceCard>
        <AppText tone="secondary" variant="body">
          Nhập email tài khoản. Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi qua email.
        </AppText>
        <FormField
          autoCapitalize="none"
          autoComplete="email"
          editable={!pending}
          keyboardType="email-address"
          label="Email"
          onChangeText={(next) => {
            setEmail(next);
            if (sent) setSent(false);
            if (error) setError(null);
          }}
          placeholder="ban@example.com"
          value={email}
        />
        {error ? <InlineNotice message={error} tone="error" /> : null}
        {sent ? (
          <InlineNotice
            message="Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu đã được gửi."
            tone="success"
          />
        ) : null}
        <AppButton
          disabled={!email.trim()}
          fullWidth
          label="Gửi hướng dẫn"
          loading={pending}
          onPress={() => void submit()}
          size="large"
        />
        <AppButton
          disabled={pending}
          fullWidth
          label="Quay lại đăng nhập"
          onPress={onBack}
          variant="secondary"
        />
      </SurfaceCard>
    </Screen>
  );
}
