import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCustomerSession } from '../../../application/auth/useCustomerSession';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppIcon, type AppIconName } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { getInitials } from '../../formatters';
import { colors, radius, sizes, spacing } from '../../theme/tokens';

export interface AccountScreenProps {
  readonly onOpenNotifications: () => void;
  readonly onOpenLicenses: () => void;
  readonly onOpenProfile: () => void;
  readonly onOpenChangePassword: () => void;
  readonly onOpenSupport: () => void;
  readonly onOpenAssistant: () => void;
  readonly onOpenHelp: () => void;
  readonly onOpenVerify: () => void;
}

interface MenuRowProps {
  readonly icon: AppIconName;
  readonly title: string;
  readonly subtitle?: string;
  readonly onPress: () => void;
}

function MenuRow({ icon, title, subtitle, onPress }: MenuRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed ? styles.menuRowPressed : null]}
    >
      <View style={styles.menuIconBox}>
        <AppIcon name={icon} size={sizes.iconMd} tone="primary" />
      </View>
      <View style={styles.menuTextCol}>
        <AppText variant="bodySemibold">{title}</AppText>
        {subtitle ? (
          <AppText tone="muted" variant="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <AppIcon name="chevron" size={sizes.iconSm} tone="muted" />
    </Pressable>
  );
}

export function AccountScreen({
  onOpenNotifications,
  onOpenLicenses,
  onOpenProfile,
  onOpenChangePassword,
  onOpenSupport,
  onOpenAssistant,
  onOpenHelp,
  onOpenVerify,
}: AccountScreenProps) {
  const { user, signOut } = useCustomerSession();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut().catch(() => undefined);
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  return (
    <Screen
      header={
        <AppHeader
          onNotifications={onOpenNotifications}
          showBell
          title="Tài khoản"
        />
      }
    >
      <SurfaceCard>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <AppText tone="onPrimary" variant="sectionTitle">
              {getInitials(user?.displayName, user?.email)}
            </AppText>
          </View>
          <View style={styles.profileMeta}>
            <AppText accessibilityRole="header" variant="sectionTitle">
              {user?.displayName ?? 'Khách hàng'}
            </AppText>
            <AppText tone="secondary" variant="secondary">
              {user?.email ?? ''}
            </AppText>
          </View>
        </View>
      </SurfaceCard>

      <View style={styles.group}>
        <AppText tone="muted" variant="secondarySemibold">
          Bản quyền và tài khoản
        </AppText>
        <SurfaceCard style={styles.menuCard}>
          <MenuRow
            icon="license"
            onPress={onOpenLicenses}
            subtitle="Xem mã bản quyền, thiết bị và gia hạn"
            title="Bản quyền của tôi"
          />
          <View style={styles.divider} />
          <MenuRow
            icon="account"
            onPress={onOpenProfile}
            subtitle="Cập nhật tên hiển thị, điện thoại và địa chỉ"
            title="Hồ sơ cá nhân"
          />
        </SurfaceCard>
      </View>

      <View style={styles.group}>
        <AppText tone="muted" variant="secondarySemibold">
          Trợ giúp
        </AppText>
        <SurfaceCard style={styles.menuCard}>
          <MenuRow
            icon="assistant"
            onPress={onOpenAssistant}
            subtitle="Hỏi đáp sản phẩm và hướng dẫn có nguồn"
            title="Trợ lý AI EmuKey"
          />
          <View style={styles.divider} />
          <MenuRow
            icon="support"
            onPress={onOpenSupport}
            subtitle="Gửi yêu cầu và trao đổi với nhân viên hỗ trợ"
            title="Hỗ trợ khách hàng"
          />
          <View style={styles.divider} />
          <MenuRow
            icon="book"
            onPress={onOpenHelp}
            subtitle="Tài liệu cài đặt và sử dụng phần mềm"
            title="Trung tâm hướng dẫn"
          />
          <View style={styles.divider} />
          <MenuRow
            icon="search"
            onPress={onOpenVerify}
            subtitle="Tra cứu lịch sử bản quyền công khai"
            title="Xác minh bản quyền công khai"
          />
        </SurfaceCard>
      </View>

      <View style={styles.group}>
        <AppText tone="muted" variant="secondarySemibold">
          Bảo mật
        </AppText>
        <SurfaceCard style={styles.menuCard}>
          <MenuRow
            icon="lock"
            onPress={onOpenChangePassword}
            subtitle="Yêu cầu đăng nhập lại sau khi đổi mật khẩu"
            title="Đổi mật khẩu"
          />
        </SurfaceCard>
      </View>

      <AppButton
        fullWidth
        label="Đăng xuất"
        onPress={() => setConfirmLogout(true)}
        variant="secondary"
      />

      <ConfirmDialog
        body="Đăng xuất sẽ xóa thông tin phiên, giỏ hàng lưu tạm và mã bản quyền lưu trên thiết bị khỏi phiên đang mở."
        cancelLabel="Ở lại"
        confirmLabel="Đăng xuất"
        danger
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => void handleLogout()}
        pending={loggingOut}
        title="Xác nhận đăng xuất"
        visible={confirmLogout}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  profileMeta: {
    flex: 1,
    gap: spacing.xxs,
  },
  group: {
    gap: spacing.xs,
  },
  menuCard: {
    gap: 0,
    padding: 0,
  },
  menuRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  menuRowPressed: {
    backgroundColor: colors.surfaceSelected,
  },
  menuIconBox: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderRadius: radius.control,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  menuTextCol: {
    flex: 1,
    gap: 2,
  },
  divider: {
    backgroundColor: colors.border,
    height: sizes.borderWidth,
    marginHorizontal: spacing.md,
  },
});
