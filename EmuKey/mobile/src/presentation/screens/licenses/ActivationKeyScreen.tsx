import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  canRetrieveActivationKey,
  providerHandoffStatus,
} from '../../../application/licenses/licensePresentation';
import {
  useActivationKeyAccess,
  useLicenseDetail,
} from '../../../application/licenses/useLicenses';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { spacing } from '../../theme/tokens';

export interface ActivationKeyScreenProps {
  readonly licenseId: string;
  readonly onBack: () => void;
}

function maskActivationKey(key: string): string {
  if (key.length <= 6) return '••••••';
  return `${'•'.repeat(Math.min(16, key.length - 4))}${key.slice(-4)}`;
}

export function ActivationKeyScreen({
  licenseId,
  onBack,
}: ActivationKeyScreenProps) {
  const {
    license,
    loading,
    error,
    refreshError,
    sendingAction,
    actionMessage,
    actionError,
    reload,
    sendEmailAction,
  } = useLicenseDetail(licenseId);

  const {
    activationKey,
    revealed,
    setRevealed,
    busy,
    error: keyError,
    fetchOrLoad,
  } = useActivationKeyAccess(license);

  const [copied, setCopied] = useState(false);
  const [pendingEmailAction, setPendingEmailAction] = useState<'KEY_RECOVERY' | 'ROTATE_KEY' | null>(null);

  if (loading && !license) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Mã bản quyền" />}>
        <FeedbackState mode="loading" title="Đang tải trạng thái mã bản quyền..." />
      </Screen>
    );
  }

  if (error || !license) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Mã bản quyền" />}>
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reload()}
          title={error ?? 'Không tìm thấy bản quyền.'}
        />
      </Screen>
    );
  }

  const eligibleToRetrieve = canRetrieveActivationKey(license);
  const handoff = providerHandoffStatus(license);

  const copyKey = async () => {
    if (!activationKey) return;
    await Clipboard.setStringAsync(activationKey);
    setCopied(true);
  };

  return (
    <Screen
      header={
        <AppHeader
          onBack={onBack}
          title="Mã bản quyền"
          trailing={
            <AppButton
              icon="refresh"
              label="Làm mới"
              onPress={() => void reload()}
              variant="tertiary"
            />
          }
        />
      }
    >
      {refreshError ? (
        <InlineNotice
          actionLabel="Thử lại"
          message={refreshError}
          onAction={() => void reload()}
          tone="warning"
        />
      ) : null}

      <SurfaceCard>
        <AppText variant="cardTitle">{license.productName}</AppText>
        <AppText tone="secondary" variant="secondary">
          Mã tra cứu công khai: {license.publicLicenseId} (khác với Mã bản quyền bí mật dùng để kích hoạt)
        </AppText>
      </SurfaceCard>

      {handoff && !eligibleToRetrieve ? (
        <InlineNotice
          message={handoff.description}
          title={handoff.label}
          tone={handoff.tone}
        />
      ) : null}

      <SurfaceCard>
        <AppText accessibilityRole="header" variant="sectionTitle">
          Mã bản quyền bí mật
        </AppText>

        {activationKey ? (
          <View style={styles.keyBox}>
            <AppText
              accessibilityLabel="Mã bản quyền"
              selectable={revealed}
              variant="mono"
            >
              {revealed ? activationKey : maskActivationKey(activationKey)}
            </AppText>
            <View style={styles.keyActions}>
              <AppButton
                icon={revealed ? 'eyeOff' : 'eye'}
                label={revealed ? 'Ẩn mã' : 'Hiện mã'}
                onPress={() => setRevealed((v) => !v)}
                variant="secondary"
              />
              <AppButton
                icon="copy"
                label={copied ? 'Đã sao chép' : 'Sao chép mã'}
                onPress={() => void copyKey()}
                variant="primary"
              />
            </View>
            <InlineNotice
              message="Mã chỉ hiển thị khi bạn mở khóa; ứng dụng tự ẩn mã khi chuyển sang nền để bảo vệ bí mật."
              tone="info"
            />
          </View>
        ) : eligibleToRetrieve ? (
          <View style={styles.keyBox}>
            <AppText tone="secondary" variant="body">
              {license.activationKeyAvailable
                ? 'Mã bản quyền đã sẵn sàng. Nhấn nút bên dưới để nhận và lưu an toàn vào thiết bị này.'
                : 'Nếu bạn đã nhận mã trên thiết bị này trước đó, nhấn nút bên dưới để mở lại mã đã lưu.'}
            </AppText>
            <AppButton
              fullWidth
              icon="lock"
              label={
                license.activationKeyAvailable ? 'Nhận mã bản quyền' : 'Xem mã đã lưu'
              }
              loading={busy}
              onPress={() => void fetchOrLoad()}
              size="large"
            />
          </View>
        ) : (
          <InlineNotice
            message="Hiện chưa đủ điều kiện nhận mã bản quyền trực tiếp. Kiểm tra trạng thái xác nhận ở trên hoặc sử dụng khôi phục qua email khi bản quyền đang hoạt động."
            tone="warning"
          />
        )}

        {keyError ? <InlineNotice message={keyError} tone="error" /> : null}
      </SurfaceCard>

      {license.status === 'ACTIVE' ? (
        <SurfaceCard>
          <AppText accessibilityRole="header" variant="sectionTitle">
            Khôi phục & đổi mã qua email
          </AppText>
          <AppText tone="secondary" variant="secondary">
            Các thao tác nhạy cảm yêu cầu xác nhận qua liên kết email trên trình duyệt web và mật khẩu tài khoản. Không cần chép mã token vào ứng dụng.
          </AppText>
          {actionMessage ? <InlineNotice message={actionMessage} tone="success" /> : null}
          {actionError ? <InlineNotice message={actionError} tone="error" /> : null}
          <View style={styles.emailActions}>
            <AppButton
              disabled={sendingAction}
              fullWidth
              label="Khôi phục mã qua email"
              loading={sendingAction && pendingEmailAction === 'KEY_RECOVERY'}
              onPress={() => {
                setPendingEmailAction('KEY_RECOVERY');
                void sendEmailAction('KEY_RECOVERY').finally(() =>
                  setPendingEmailAction(null),
                );
              }}
              variant="secondary"
            />
            <AppButton
              disabled={sendingAction}
              fullWidth
              label="Đổi mã qua email"
              loading={sendingAction && pendingEmailAction === 'ROTATE_KEY'}
              onPress={() => {
                setPendingEmailAction('ROTATE_KEY');
                void sendEmailAction('ROTATE_KEY').finally(() =>
                  setPendingEmailAction(null),
                );
              }}
              variant="secondary"
            />
          </View>
        </SurfaceCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyBox: {
    gap: spacing.sm,
  },
  keyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  emailActions: {
    gap: spacing.xs,
  },
});
