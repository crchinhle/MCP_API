import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  useLicenseDetail,
  useLicenseDevicesList,
} from '../../../application/licenses/useLicenses';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { FormField } from '../../components/ui/FormField';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatDateTimeVi } from '../../formatters';
import { spacing } from '../../theme/tokens';

export interface DevicesScreenProps {
  readonly licenseId: string;
  readonly onBack: () => void;
}

export function DevicesScreen({ licenseId, onBack }: DevicesScreenProps) {
  const {
    license,
    loading: licenseLoading,
    error: licenseError,
    refreshError: licenseRefreshError,
    sendingAction,
    actionMessage,
    actionError,
    sendEmailAction,
    reload: reloadLicense,
  } = useLicenseDetail(licenseId);

  const isProviderManaged = license?.fulfillmentMode === 'PROVIDER_HANDOFF';
  const devicesState = useLicenseDevicesList(
    licenseId,
    Boolean(license && !isProviderManaged),
  );

  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const [revokeTarget, setRevokeTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);

  if (licenseLoading && !license) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Quản lý thiết bị" />}>
        <FeedbackState mode="loading" title="Đang tải thông tin bản quyền..." />
      </Screen>
    );
  }

  if (licenseError || !license) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Quản lý thiết bị" />}>
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reloadLicense()}
          title={licenseError ?? 'Không tìm thấy bản quyền.'}
        />
      </Screen>
    );
  }

  if (isProviderManaged) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Quản lý thiết bị" />}>
        <InlineNotice
          message={`Gói này cho phép tối đa ${license.maxActiveDevices} thiết bị và do nhà cung cấp quản lý trực tiếp trong sản phẩm của họ.`}
          title="Nhà cung cấp quản lý thiết bị"
          tone="info"
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <AppHeader
          onBack={onBack}
          title="Thiết bị liên kết"
          trailing={
            <AppButton
              icon="refresh"
              label="Làm mới"
              onPress={() => void devicesState.reload()}
              variant="tertiary"
            />
          }
        />
      }
    >
      <SurfaceCard>
        <AppText variant="cardTitle">{license.productName}</AppText>
        <AppText tone="secondary" variant="secondary">
          Đang sử dụng {license.activeDeviceCount}/{license.maxActiveDevices} thiết bị
        </AppText>
      </SurfaceCard>

      {licenseRefreshError ? (
        <InlineNotice
          actionLabel="Thử lại"
          message={licenseRefreshError}
          onAction={() => void reloadLicense()}
          tone="warning"
        />
      ) : null}

      {devicesState.error && devicesState.devices.length > 0 ? (
        <InlineNotice
          actionLabel="Thử lại"
          message={devicesState.error}
          onAction={() => void devicesState.reload()}
          tone="warning"
        />
      ) : null}

      {actionMessage ? <InlineNotice message={actionMessage} tone="success" /> : null}
      {actionError ? <InlineNotice message={actionError} tone="error" /> : null}
      {devicesState.saveError ? (
        <InlineNotice message={devicesState.saveError} tone="error" />
      ) : null}

      {devicesState.loading && devicesState.devices.length === 0 ? (
        <FeedbackState mode="loading" title="Đang tải danh sách thiết bị..." />
      ) : devicesState.error && devicesState.devices.length === 0 ? (
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void devicesState.reload()}
          title={devicesState.error}
        />
      ) : devicesState.devices.length === 0 ? (
        <FeedbackState
          description="Các thiết bị đã kích hoạt bằng mã bản quyền sẽ xuất hiện tại đây."
          icon="device"
          mode="empty"
          title="Chưa có thiết bị liên kết"
        />
      ) : (
        devicesState.devices.map((device) => {
          const currentName = deviceNames[device.id] ?? device.displayName ?? '';
          const isActive = device.status === 'ACTIVE';
          const displayLabel = device.displayName || device.deviceRef;

          return (
            <SurfaceCard key={device.id}>
              <View style={styles.deviceHeader}>
                <View style={styles.deviceTitleCol}>
                  <AppText variant="cardTitle">{displayLabel}</AppText>
                  <AppText tone="muted" variant="secondary">
                    {device.platform ?? 'Chưa rõ nền tảng'} · {device.deviceRef}
                  </AppText>
                </View>
                <StatusBadge
                  label={isActive ? 'Đang hoạt động' : 'Đã thu hồi'}
                  tone={isActive ? 'success' : 'neutral'}
                />
              </View>

              <AppText tone="secondary" variant="secondary">
                Kích hoạt: {formatDateTimeVi(device.activatedAt)}
                {device.revokedAt ? ` · Thu hồi: ${formatDateTimeVi(device.revokedAt)}` : ''}
              </AppText>

              <FormField
                editable={devicesState.savingDeviceId !== device.id}
                label={`Tên thiết bị`}
                maxLength={80}
                onChangeText={(value) =>
                  setDeviceNames((current) => ({ ...current, [device.id]: value }))
                }
                placeholder="Đặt tên gợi nhớ (tối đa 80 ký tự)"
                value={currentName}
              />

              <View style={styles.deviceActions}>
                <AppButton
                  disabled={
                    Boolean(devicesState.savingDeviceId) ||
                    currentName.trim() === (device.displayName ?? '').trim()
                  }
                  label="Lưu tên thiết bị"
                  loading={devicesState.savingDeviceId === device.id}
                  onPress={() => void devicesState.renameDevice(device.id, currentName)}
                  variant="secondary"
                />
                {isActive ? (
                  <AppButton
                    disabled={sendingAction}
                    label="Thu hồi từ xa"
                    onPress={() =>
                      setRevokeTarget({ id: device.id, label: displayLabel })
                    }
                    variant="tertiary"
                  />
                ) : null}
              </View>
            </SurfaceCard>
          );
        })
      )}

      <ConfirmDialog
        body={`Gửi email xác nhận thu hồi quyền truy cập của thiết bị "${revokeTarget?.label ?? ''}"? Sau khi xác nhận liên kết trong email, thiết bị này sẽ bị ngắt quyền sử dụng.`}
        cancelLabel="Giữ thiết bị"
        confirmLabel="Gửi email xác nhận thu hồi"
        danger
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => {
          const target = revokeTarget;
          if (!target) return;
          void sendEmailAction('REMOTE_REVOKE_DEVICE', target.id).then((ok) => {
            if (ok) setRevokeTarget(null);
          });
        }}
        pending={sendingAction}
        title="Thu hồi thiết bị qua email"
        visible={Boolean(revokeTarget)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  deviceHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  deviceTitleCol: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 160,
  },
  deviceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
