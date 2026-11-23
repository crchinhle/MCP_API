import { useEffect, useState } from 'react';

import {
  MobileApiError,
  resendVerification,
  verifyEmail,
} from '../../../infrastructure/api/client';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

export interface EmailVerificationScreenProps {
  readonly email?: string;
  readonly token?: string;
  readonly onBackToLogin: () => void;
}

export function EmailVerificationScreen({
  email,
  token,
  onBackToLogin,
}: EmailVerificationScreenProps) {
  const [verificationState, setVerificationState] = useState<
    'idle' | 'pending' | 'verified' | 'failed'
  >(token ? 'pending' : 'idle');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setVerificationState('pending');
    void verifyEmail(token)
      .then(() => {
        if (active) setVerificationState('verified');
      })
      .catch(() => {
        if (active) setVerificationState('failed');
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    setResendMessage(null);
    try {
      await resendVerification(email);
      setResendMessage({
        tone: 'success',
        text: 'Đã gửi yêu cầu xác minh. Vui lòng kiểm tra hộp thư đến và thư rác.',
      });
    } catch (cause) {
      if (cause instanceof MobileApiError && cause.status === 429) {
        setResendMessage({
          tone: 'error',
          text: cause.retryAfterSeconds
            ? `Vui lòng chờ ${cause.retryAfterSeconds} giây trước khi gửi lại.`
            : 'Bạn yêu cầu quá nhiều lần. Vui lòng chờ một chút rồi thử lại.',
        });
      } else {
        setResendMessage({
          tone: 'error',
          text: 'Chưa gửi được email xác minh. Vui lòng thử lại.',
        });
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen
      edges={['bottom']}
      header={<AppHeader onBack={onBackToLogin} title="Xác minh email" />}
      keyboardAware
    >
      <SurfaceCard>
        {verificationState === 'pending' ? (
          <InlineNotice message="Đang xác minh email..." tone="info" />
        ) : null}
        {verificationState === 'verified' ? (
          <InlineNotice
            message="Email đã được xác minh thành công. Bạn có thể đăng nhập ngay."
            tone="success"
          />
        ) : null}
        {verificationState === 'failed' ? (
          <InlineNotice
            message="Liên kết xác minh không hợp lệ hoặc đã hết hạn."
            tone="error"
          />
        ) : null}

        {verificationState !== 'verified' ? (
          <>
            <AppText variant="cardTitle">Kiểm tra hộp thư của bạn</AppText>
            <AppText tone="secondary" variant="body">
              {email
                ? `Chúng tôi đã gửi liên kết xác minh tới ${email}. Mở liên kết trong email (kể cả mục Thư rác) để kích hoạt tài khoản.`
                : 'Vui lòng mở liên kết xác minh đã được gửi tới email đăng ký của bạn.'}
            </AppText>
            {resendMessage ? (
              <InlineNotice message={resendMessage.text} tone={resendMessage.tone} />
            ) : null}
            {email ? (
              <AppButton
                fullWidth
                label="Gửi lại email xác minh"
                loading={resending}
                onPress={() => void handleResend()}
                variant="primary"
              />
            ) : null}
          </>
        ) : null}

        <AppButton
          fullWidth
          label="Quay lại đăng nhập"
          onPress={onBackToLogin}
          variant={verificationState === 'verified' ? 'primary' : 'secondary'}
        />
      </SurfaceCard>
    </Screen>
  );
}
