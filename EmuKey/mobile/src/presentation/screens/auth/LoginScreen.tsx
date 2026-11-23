import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { login, MobileApiError, type MobileSession } from '../../../infrastructure/api/client';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { FormField } from '../../components/ui/FormField';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { spacing } from '../../theme/tokens';

export interface LoginScreenProps {
  readonly onAuthenticated: (session: MobileSession) => void;
  readonly onForgotPassword?: () => void;
  readonly onRegister?: () => void;
  readonly onBrowseCatalog?: () => void;
  readonly onVerify: () => void;
  readonly onHelp?: () => void;
  readonly onGuestAi?: () => void;
  readonly hasPendingPurchase?: boolean;
  readonly externalError?: string | null;
  readonly onDismissExternalError?: () => void;
}

function describeLoginError(cause: unknown): string {
  if (cause instanceof MobileApiError) {
    if (cause.status === 403 || cause.code === 'CUSTOMER_ACCOUNT_REQUIRED') {
      return 'Ứng dụng này dành cho tài khoản khách hàng.';
    }
    if (cause.code === 'EMAIL_NOT_VERIFIED') {
      return 'Email chưa được xác minh. Hãy kiểm tra hộp thư hoặc yêu cầu gửi lại email xác minh.';
    }
    if (cause.code === 'ACCOUNT_LOCKED') {
      return 'Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau.';
    }
    if (cause.status === 429) {
      return cause.retryAfterSeconds
        ? `Bạn thử quá nhiều lần. Vui lòng thử lại sau ${cause.retryAfterSeconds} giây.`
        : 'Bạn thử quá nhiều lần. Vui lòng thử lại sau ít phút.';
    }
  }
  return 'Không thể đăng nhập. Vui lòng kiểm tra tài khoản và mật khẩu.';
}

export function LoginScreen({
  onAuthenticated,
  onForgotPassword,
  onRegister,
  onBrowseCatalog,
  onVerify,
  onHelp,
  onGuestAi,
  hasPendingPurchase = false,
  externalError = null,
  onDismissExternalError,
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleError = error ?? externalError;

  const submit = async () => {
    if (pending || !email.trim() || !password) return;
    setPending(true);
    setError(null);
    onDismissExternalError?.();
    try {
      const session = await login(email, password);
      onAuthenticated(session);
    } catch (cause) {
      setError(describeLoginError(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} keyboardAware>
      <View style={styles.brandBlock}>
        <AppText accessibilityRole="header" tone="primary" variant="brandWordmark">
          EmuKey
        </AppText>
        <AppText accessibilityRole="header" variant="pageTitle">
          Chào mừng trở lại
        </AppText>
        <AppText tone="secondary" variant="secondary">
          Đăng nhập để quản lý đơn hàng và bản quyền của bạn
        </AppText>
      </View>

      {hasPendingPurchase ? (
        <InlineNotice
          message="Đăng nhập tài khoản khách hàng để tiếp tục cấu hình gói bạn vừa chọn."
          tone="info"
        />
      ) : null}

      <SurfaceCard>
        <FormField
          autoCapitalize="none"
          autoComplete="email"
          editable={!pending}
          keyboardType="email-address"
          label="Email"
          onChangeText={(next) => {
            if (externalError) onDismissExternalError?.();
            setEmail(next);
          }}
          placeholder="ban@example.com"
          returnKeyType="next"
          value={email}
        />
        <FormField
          autoCapitalize="none"
          autoComplete="password"
          editable={!pending}
          label="Mật khẩu"
          onChangeText={(next) => {
            if (externalError) onDismissExternalError?.();
            setPassword(next);
          }}
          onSubmitEditing={() => void submit()}
          passwordToggle
          placeholder="Nhập mật khẩu"
          returnKeyType="done"
          secureTextEntry
          value={password}
        />

        {visibleError ? <InlineNotice message={visibleError} tone="error" /> : null}

        <AppButton
          disabled={!email.trim() || !password}
          fullWidth
          label="Đăng nhập"
          loading={pending}
          onPress={() => void submit()}
          size="large"
        />

        <View style={styles.inlineLinks}>
          {onForgotPassword ? (
            <AppButton
              disabled={pending}
              label="Quên mật khẩu"
              onPress={onForgotPassword}
              variant="tertiary"
            />
          ) : null}
          {onRegister ? (
            <AppButton
              disabled={pending}
              label="Đăng ký tài khoản"
              onPress={onRegister}
              variant="tertiary"
            />
          ) : null}
        </View>
      </SurfaceCard>

      <View style={styles.publicActions}>
        {onBrowseCatalog ? (
          <AppButton
            disabled={pending}
            fullWidth
            icon="home"
            label="Tiếp tục xem sản phẩm"
            onPress={onBrowseCatalog}
            variant="secondary"
          />
        ) : null}
        <AppButton
          disabled={pending}
          fullWidth
          icon="license"
          label="Xác minh bản quyền công khai"
          onPress={onVerify}
          variant="secondary"
        />
        <View style={styles.publicRow}>
          {onHelp ? (
            <AppButton
              disabled={pending}
              icon="book"
              label="Hướng dẫn"
              onPress={onHelp}
              style={styles.halfBtn}
              variant="secondary"
            />
          ) : null}
          {onGuestAi ? (
            <AppButton
              disabled={pending}
              icon="assistant"
              label="Trợ lý AI"
              onPress={onGuestAi}
              style={styles.halfBtn}
              variant="secondary"
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandBlock: {
    gap: spacing.xxs,
    marginTop: spacing.xs,
  },
  inlineLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  publicActions: {
    gap: spacing.xs,
  },
  publicRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  halfBtn: {
    flex: 1,
  },
});
