import { useEffect, useState } from 'react';

import { useUnsavedChangesGuard } from '../../../application/navigation/useUnsavedChangesGuard';
import {
  getProfile,
  updateProfile,
  type MobileSession,
} from '../../../infrastructure/api/client';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { FormField } from '../../components/ui/FormField';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

export interface ProfileScreenProps {
  readonly isFocused?: boolean;
  readonly onProfileUpdated: (user: MobileSession['user']) => void;
  readonly onBack?: () => void;
}

export function ProfileScreen({
  isFocused,
  onProfileUpdated,
  onBack,
}: ProfileScreenProps) {
  const [profile, setProfile] = useState<MobileSession['user'] | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const value = await getProfile();
      setProfile(value);
      setDisplayName(value.displayName);
      setPhone(value.phone ?? '');
      setAddress(value.address ?? '');
    } catch {
      setNotice({ tone: 'error', message: 'Không thể tải hồ sơ.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const dirty = profile
    ? displayName.trim() !== profile.displayName.trim() ||
      phone.trim() !== (profile.phone ?? '').trim() ||
      address.trim() !== (profile.address ?? '').trim()
    : false;

  const displayNameError =
    (displayNameTouched || displayName.length > 0) && !displayName.trim()
      ? 'Tên hiển thị không được để trống.'
      : null;

  const { cancelDiscard, confirmDiscard } = useUnsavedChangesGuard({
    enabled: Boolean(onBack && dirty),
    isFocused,
    onBack,
    onRequestDiscard: () => setConfirmDiscardOpen(true),
    onBlurReset: () => setConfirmDiscardOpen(false),
  });

  const handleBackPress = () => {
    if (!onBack) return;
    if (dirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    onBack();
  };

  const save = async () => {
    setDisplayNameTouched(true);
    if (!displayName.trim() || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const trimmedPhone = phone.trim();
      const trimmedAddress = address.trim();
      const updated = await updateProfile({
        displayName: displayName.trim(),
        ...(trimmedPhone || profile?.phone ? { phone: trimmedPhone } : {}),
        ...(trimmedAddress || profile?.address ? { address: trimmedAddress } : {}),
      });
      setProfile(updated);
      setDisplayName(updated.displayName);
      setPhone(updated.phone ?? '');
      setAddress(updated.address ?? '');
      setDisplayNameTouched(false);
      onProfileUpdated(updated);
      setNotice({ tone: 'success', message: 'Đã cập nhật hồ sơ.' });
    } catch {
      setNotice({ tone: 'error', message: 'Không thể cập nhật hồ sơ.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={
        onBack ? <AppHeader onBack={handleBackPress} title="Hồ sơ cá nhân" /> : undefined
      }
      keyboardAware
    >
      {loading && !profile && !notice ? (
        <FeedbackState mode="loading" title="Đang tải hồ sơ tài khoản..." />
      ) : !profile && notice?.tone === 'error' ? (
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void load()}
          title={notice.message}
        />
      ) : (
        <SurfaceCard>
          {!onBack ? (
            <AppText accessibilityRole="header" variant="sectionTitle">
              Hồ sơ tài khoản
            </AppText>
          ) : null}

          <FormField
            editable={false}
            helperText="Email được bảo vệ bởi hệ thống xác thực và không thể thay đổi."
            label="Email"
            value={profile?.email ?? 'Đang tải thông tin tài khoản...'}
          />

          <FormField
            editable={!saving}
            errorText={displayNameError}
            label="Tên hiển thị"
            maxLength={255}
            onBlur={() => setDisplayNameTouched(true)}
            onChangeText={(next) => {
              setDisplayNameTouched(true);
              setDisplayName(next);
            }}
            required
            value={displayName}
          />

          <FormField
            editable={!saving}
            keyboardType="phone-pad"
            label="Số điện thoại"
            maxLength={30}
            onChangeText={setPhone}
            placeholder="Nhập số điện thoại (không bắt buộc)"
            value={phone}
          />

          <FormField
            editable={!saving}
            label="Địa chỉ"
            maxLength={500}
            multiline
            onChangeText={setAddress}
            placeholder="Nhập địa chỉ liên hệ (không bắt buộc)"
            value={address}
          />

          {notice ? (
            <InlineNotice message={notice.message} tone={notice.tone} />
          ) : null}

          <AppButton
            disabled={!displayName.trim() || !dirty || saving}
            fullWidth
            label="Lưu thay đổi"
            loading={saving}
            onPress={() => void save()}
            size="large"
          />
        </SurfaceCard>
      )}

      <ConfirmDialog
        body="Bạn có thay đổi chưa lưu trong hồ sơ cá nhân. Rời màn hình sẽ bỏ các thay đổi này."
        cancelLabel="Tiếp tục chỉnh sửa"
        confirmLabel="Bỏ thay đổi"
        danger
        onCancel={() => {
          setConfirmDiscardOpen(false);
          cancelDiscard();
        }}
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          confirmDiscard();
        }}
        pending={saving}
        title="Bỏ thay đổi chưa lưu?"
        visible={confirmDiscardOpen}
      />
    </Screen>
  );
}
