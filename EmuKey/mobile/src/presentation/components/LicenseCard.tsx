import { StyleSheet, View } from 'react-native';

import {
  licenseKeyStatusText,
  licenseStatusLabel,
  licenseStatusTone,
  providerHandoffStatus,
} from '../../application/licenses/licensePresentation';
import type { MobileLicense } from '../../infrastructure/api/client';
import { formatDateVi } from '../formatters';
import { spacing } from '../theme/tokens';
import { AppIcon } from './ui/AppIcon';
import { AppText } from './ui/AppText';
import { StatusBadge } from './ui/StatusBadge';
import { SurfaceCard } from './ui/SurfaceCard';

export interface LicenseCardProps {
  readonly license: MobileLicense;
  readonly onOpen: (licenseId: string) => void;
}

export function LicenseCard({ license, onOpen }: LicenseCardProps) {
  const handoff = providerHandoffStatus(license);
  const badgeLabel = handoff ? handoff.label : licenseStatusLabel(license.status);
  const badgeTone = handoff ? handoff.tone : licenseStatusTone(license.status);
  const deviceScope =
    license.fulfillmentMode === 'PROVIDER_HANDOFF'
      ? `Tối đa ${license.maxActiveDevices} thiết bị · nhà cung cấp quản lý`
      : `${license.activeDeviceCount}/${license.maxActiveDevices} thiết bị`;

  return (
    <SurfaceCard onPress={() => onOpen(license.id)}>
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <AppText variant="cardTitle">{license.productName}</AppText>
          <AppText tone="secondary" variant="secondary">
            {license.plan.name}
          </AppText>
        </View>
        <AppIcon name="chevron" size={16} tone="muted" />
      </View>

      <View style={styles.badgeRow}>
        <StatusBadge label={badgeLabel} tone={badgeTone} />
      </View>

      <View style={styles.metaList}>
        <AppText variant="secondarySemibold">
          Hết hạn: {formatDateVi(license.expiresAt)}
        </AppText>
        <AppText tone="secondary" variant="secondary">
          Mã: {licenseKeyStatusText(license)} · {deviceScope}
        </AppText>
        <AppText ellipsizeMode="middle" numberOfLines={1} tone="muted" variant="secondary">
          {license.publicLicenseId}
        </AppText>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    alignItems: 'center',
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
  metaList: {
    gap: spacing.xxs,
  },
});
