import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import {
  finalityLabel,
  licenseStatusLabel,
  publicVerificationError,
  verificationEventStatusLabel,
} from '../../../application/licenses/licensePresentation';
import {
  verifyPublicLicense,
  type MobileLicenseVerification,
} from '../../../infrastructure/api/client';
import { KeyValueList } from '../../components/KeyValueList';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import { FormField } from '../../components/ui/FormField';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatDateTimeVi, formatDateVi } from '../../formatters';
import { colors, radius, sizes, spacing } from '../../theme/tokens';

export interface VerifyLicenseScreenProps {
  readonly onBack?: () => void;
}

export function VerifyLicenseScreen({ onBack }: VerifyLicenseScreenProps = {}) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<MobileLicenseVerification | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const requestGenRef = useRef(0);

  const handleChangeCode = (next: string) => {
    requestGenRef.current += 1;
    setCode(next);
    setResult(null);
    setError(null);
    setExpandedEventId(null);
  };

  const verify = async () => {
    const trimmed = code.trim();
    if (!trimmed || pending) return;
    const gen = ++requestGenRef.current;
    setPending(true);
    setError(null);
    try {
      const response = await verifyPublicLicense(trimmed);
      if (gen !== requestGenRef.current) return;
      setResult(response);
    } catch (cause) {
      if (gen !== requestGenRef.current) return;
      setResult(null);
      setError(publicVerificationError(cause).message);
    } finally {
      if (gen === requestGenRef.current) setPending(false);
    }
  };

  const openExplorer = (url: string | null | undefined) => {
    if (!url || !url.startsWith('https://')) return;
    void Linking.openURL(url).catch(() => undefined);
  };

  const isNotFound = result?.state === 'NOT_FOUND';
  const isConfirmed = result?.state === 'CHAIN_CONFIRMED';

  return (
    <Screen
      header={
        onBack ? <AppHeader onBack={onBack} title="Xác minh Blockchain" /> : undefined
      }
      keyboardAware
    >
      <SurfaceCard>
        {!onBack ? (
          <AppText accessibilityRole="header" variant="pageTitle">
            Xác minh Blockchain
          </AppText>
        ) : null}
        <AppText tone="secondary" variant="body">
          Chỉ dùng mã bản quyền công khai (không nhập mã kích hoạt bí mật). Kết quả không chứa danh tính người mua.
        </AppText>
        <FormField
          autoCapitalize="characters"
          editable={!pending}
          label="Mã bản quyền công khai"
          onChangeText={handleChangeCode}
          placeholder="EMU-..."
          value={code}
        />
        <AppButton
          disabled={!code.trim()}
          fullWidth
          icon="search"
          label="Xác minh"
          loading={pending}
          onPress={() => void verify()}
          size="large"
        />
      </SurfaceCard>

      {error ? <InlineNotice message={error} tone="error" /> : null}

      {isNotFound ? (
        <InlineNotice
          message="Không tìm thấy bản quyền phù hợp với mã công khai này."
          title="Không tìm thấy"
          tone="warning"
        />
      ) : null}

      {result && !isNotFound ? (
        <>
          <SurfaceCard>
            <View style={styles.resultHeader}>
              <View style={styles.titleCol}>
                <AppText variant="cardTitle">
                  {result.productName ?? result.licenseId ?? 'Bản quyền'}
                </AppText>
                {result.plan?.name ? (
                  <AppText tone="secondary" variant="secondary">
                    {result.plan.name} (v{result.plan.version})
                  </AppText>
                ) : null}
              </View>
              <StatusBadge
                label={isConfirmed ? 'Đã xác thực' : finalityLabel(result.state)}
                tone={isConfirmed ? 'success' : 'warning'}
              />
            </View>

            <KeyValueList
              rows={[
                { label: 'Mã công khai', value: result.licenseId ?? '—', mono: true },
                { label: 'Trạng thái chuỗi', value: finalityLabel(result.state) },
                ...(result.status
                  ? [{ label: 'Trạng thái bản quyền', value: licenseStatusLabel(result.status) }]
                  : []),
                ...(result.finality
                  ? [{ label: 'Trạng thái xác thực', value: finalityLabel(result.finality) }]
                  : []),
                ...(result.periodStart
                  ? [{ label: 'Ngày kích hoạt', value: formatDateVi(result.periodStart) }]
                  : []),
                ...(result.expiresAt
                  ? [{ label: 'Ngày hết hạn', value: formatDateVi(result.expiresAt) }]
                  : []),
                ...(result.provider?.displayName
                  ? [
                      {
                        label: 'Nhà cung cấp',
                        value:
                          result.provider.organizationName ||
                          result.provider.displayName,
                      },
                    ]
                  : []),
              ]}
            />

            {result.explorerUrl && result.explorerUrl.startsWith('https://') ? (
              <AppButton
                label="Mở trình duyệt Blockchain"
                onPress={() => openExplorer(result.explorerUrl)}
                variant="secondary"
              />
            ) : null}
          </SurfaceCard>

          {result.history && result.history.length > 0 ? (
            <SurfaceCard>
              <AppText accessibilityRole="header" variant="sectionTitle">
                Lịch sử sự kiện Blockchain ({result.history.length})
              </AppText>
              {result.history.map((event) => {
                const expanded = expandedEventId === event.id;
                return (
                  <Pressable
                    key={event.id}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() =>
                      setExpandedEventId((curr) => (curr === event.id ? null : event.id))
                    }
                    style={styles.eventBox}
                  >
                    <View style={styles.eventHeader}>
                      <AppText style={styles.eventTitle} variant="bodySemibold">
                        {event.title}
                      </AppText>
                      <AppIcon
                        name={expanded ? 'chevronDown' : 'chevron'}
                        size={16}
                        tone="muted"
                      />
                    </View>
                    <AppText tone="muted" variant="tabLabel">
                      {formatDateTimeVi(event.occurredAt)} · {verificationEventStatusLabel(event.status)}
                    </AppText>
                    <AppText tone="secondary" variant="secondary">
                      {event.description}
                    </AppText>
                    {expanded && event.changes?.length ? (
                      <View style={styles.changesList}>
                        {event.changes.map((change) => (
                          <AppText key={change.field} tone="muted" variant="secondary">
                            • {change.label}:{' '}
                            {change.previousValue ? `${change.previousValue} → ` : ''}
                            {change.currentValue ?? '—'}
                          </AppText>
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </SurfaceCard>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  resultHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  titleCol: {
    flex: 1,
    gap: spacing.xxs,
  },
  eventBox: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    gap: spacing.xxs,
    padding: spacing.sm,
  },
  eventHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventTitle: {
    flex: 1,
  },
  changesList: {
    gap: spacing.xxs,
    marginTop: spacing.xs,
  },
});
