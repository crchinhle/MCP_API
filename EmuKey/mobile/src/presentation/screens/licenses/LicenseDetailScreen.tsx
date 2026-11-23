import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  activationKeyTrustLabel,
  canRetrieveActivationKey,
  finalityLabel,
  licenseKeyStatusText,
  licensePrimaryKeyActionLabel,
  licenseStatusLabel,
  licenseStatusTone,
  providerHandoffStatus,
} from '../../../application/licenses/licensePresentation';
import { useLicenseDetail } from '../../../application/licenses/useLicenses';
import { KeyValueList } from '../../components/KeyValueList';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatDateVi } from '../../formatters';
import { spacing } from '../../theme/tokens';

export interface LicenseDetailScreenProps {
  readonly licenseId: string;
  readonly onBack: () => void;
  readonly onOpenKey: (licenseId: string) => void;
  readonly onOpenDevices: (licenseId: string) => void;
  readonly onOpenRenewal: (params: {
    licenseId: string;
    originOrderId: string;
    productName: string;
  }) => void;
  readonly onOpenSupport: (licenseId: string, publicLicenseId: string) => void;
}

export function LicenseDetailScreen({
  licenseId,
  onBack,
  onOpenKey,
  onOpenDevices,
  onOpenRenewal,
  onOpenSupport,
}: LicenseDetailScreenProps) {
  const { license, loading, error, refreshError, reload } = useLicenseDetail(licenseId);
  const [copiedPublicId, setCopiedPublicId] = useState(false);
  const [techExpanded, setTechExpanded] = useState(false);

  if (loading && !license) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Chi tiết bản quyền" />}>
        <FeedbackState mode="loading" title="Đang tải thông tin bản quyền..." />
      </Screen>
    );
  }

  if (!license || error) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Chi tiết bản quyền" />}>
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reload()}
          title={error ?? 'Không tìm thấy bản quyền.'}
        />
      </Screen>
    );
  }

  const isProviderManaged = license.fulfillmentMode === 'PROVIDER_HANDOFF';
  const handoff = providerHandoffStatus(license);
  const canRenew = ['ACTIVE', 'EXPIRED', 'SUSPENDED'].includes(license.status);

  const copyPublicId = async () => {
    await Clipboard.setStringAsync(license.publicLicenseId);
    setCopiedPublicId(true);
  };

  return (
    <Screen
      header={
        <AppHeader
          onBack={onBack}
          title="Chi tiết bản quyền"
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
        <View style={styles.headerRow}>
          <View style={styles.titleCol}>
            <AppText accessibilityRole="header" variant="sectionTitle">
              {license.productName}
            </AppText>
            <AppText tone="secondary" variant="secondary">
              {license.plan.name} · v{license.plan.version}
            </AppText>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <StatusBadge
            label={licenseStatusLabel(license.status)}
            tone={licenseStatusTone(license.status)}
          />
        </View>

        <KeyValueList
          rows={[
            { label: 'Hạn sử dụng', value: formatDateVi(license.expiresAt) },
            { label: 'Tình trạng mã', value: licenseKeyStatusText(license) },
            {
              label: 'Phạm vi thiết bị',
              value: isProviderManaged
                ? `Tối đa ${license.maxActiveDevices} thiết bị · nhà cung cấp quản lý`
                : `${license.activeDeviceCount}/${license.maxActiveDevices} thiết bị`,
            },
          ]}
        />
      </SurfaceCard>

      {handoff ? (
        <InlineNotice
          message={handoff.description}
          title={handoff.label}
          tone={handoff.tone}
        />
      ) : license.status === 'ACTIVE' &&
        canRetrieveActivationKey(license) &&
        license.activationKeyAvailable === false ? (
        <InlineNotice
          message="Mã đã được nhận trước đó. Mở mục bên dưới để xem mã đã lưu hoặc khôi phục qua email."
          title="Chưa lưu mã trên máy này"
          tone="info"
        />
      ) : null}

      <View style={styles.actions}>
        <AppButton
          fullWidth
          icon="license"
          label={licensePrimaryKeyActionLabel(license)}
          onPress={() => onOpenKey(license.id)}
          size="large"
        />

        {!isProviderManaged ? (
          <AppButton
            fullWidth
            icon="device"
            label={`Quản lý thiết bị (${license.activeDeviceCount}/${license.maxActiveDevices})`}
            onPress={() => onOpenDevices(license.id)}
            variant="secondary"
          />
        ) : null}

        {canRenew ? (
          <AppButton
            fullWidth
            icon="refresh"
            label="Gia hạn bản quyền"
            onPress={() =>
              onOpenRenewal({
                licenseId: license.id,
                originOrderId: license.originOrderId,
                productName: license.productName,
              })
            }
            variant="secondary"
          />
        ) : null}

        <AppButton
          fullWidth
          icon="support"
          label="Cần hỗ trợ bản quyền này"
          onPress={() => onOpenSupport(license.id, license.publicLicenseId)}
          variant="tertiary"
        />
      </View>

      <SurfaceCard>
        <AppText variant="secondarySemibold">Thông tin chi tiết bản quyền</AppText>
        <View style={styles.publicIdBox}>
          <View style={styles.publicIdMeta}>
            <AppText tone="muted" variant="secondary">
              Mã tra cứu công khai
            </AppText>
            <AppText selectable variant="mono">
              {license.publicLicenseId}
            </AppText>
          </View>
          <AppButton
            icon="copy"
            label={copiedPublicId ? 'Đã chép' : 'Sao chép'}
            onPress={() => void copyPublicId()}
            variant="secondary"
          />
        </View>

        <KeyValueList
          rows={[
            {
              label: 'Nhà cung cấp',
              value: license.provider.organizationName || license.provider.displayName,
            },
            { label: 'Ngày bắt đầu', value: formatDateVi(license.periodStart) },
            { label: 'Ngày hết hạn', value: formatDateVi(license.expiresAt) },
          ]}
        />
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.techHeader}>
          <AppText variant="secondarySemibold">Thông tin đối chiếu kỹ thuật</AppText>
          <AppButton
            label={techExpanded ? 'Ẩn bớt' : 'Xem chi tiết'}
            onPress={() => setTechExpanded((v) => !v)}
            variant="tertiary"
          />
        </View>
        {techExpanded ? (
          <KeyValueList
            rows={[
              { label: 'Trạng thái xác thực', value: finalityLabel(license.finality) },
              { label: 'Số xác nhận', value: String(license.confirmationCount) },
              { label: 'Phiên bản mã', value: `v${license.keyVersion}` },
              {
                label: 'Độ tin cậy mã',
                value: activationKeyTrustLabel(license.activationKeyTrustStatus),
              },
              ...(license.transactionHash
                ? [{ label: 'Mã giao dịch', value: license.transactionHash, mono: true }]
                : []),
            ]}
          />
        ) : null}
      </SurfaceCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  titleCol: {
    flex: 1,
    gap: spacing.xxs,
  },
  badgeRow: {
    alignItems: 'flex-start',
  },
  publicIdBox: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  publicIdMeta: {
    flex: 1,
    gap: spacing.xxs,
  },
  actions: {
    gap: spacing.sm,
  },
  techHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
