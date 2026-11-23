import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { useNotifications } from '../../../application/notifications/notificationContext';
import type { MobileNotification } from '../../../infrastructure/api/client';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatDateTimeVi } from '../../formatters';
import { colors, spacing } from '../../theme/tokens';

export interface NotificationsScreenProps {
  readonly onBack?: () => void;
  readonly onOpenTarget: (target: MobileNotification['target']) => void;
}

export function NotificationsScreen({
  onBack,
  onOpenTarget,
}: NotificationsScreenProps) {
  const {
    items,
    nextCursor,
    loading,
    refreshing,
    loadingMore,
    error,
    loadMoreError,
    readError,
    refresh,
    loadMore,
    markRead,
  } = useNotifications();

  const handlePressItem = (item: MobileNotification) => {
    onOpenTarget(item.target);
    if (!item.isRead) {
      void markRead(item.id);
    }
  };

  return (
    <Screen
      header={<AppHeader onBack={onBack} title="Thông báo" />}
      padded={false}
      scroll="none"
    >
      {readError || (error && items.length > 0) ? (
        <View style={styles.noticeWrap}>
          {error && items.length > 0 ? (
            <InlineNotice
              actionLabel="Thử lại"
              actionLoading={refreshing}
              message={error}
              onAction={() => void refresh()}
              tone="warning"
            />
          ) : null}
          {readError ? <InlineNotice message={readError} tone="error" /> : null}
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <FeedbackState mode="loading" title="Đang tải thông báo..." />
      ) : error && items.length === 0 ? (
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void refresh()}
          title={error}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.id}
          testID="notifications-list"
          ListEmptyComponent={
            <FeedbackState
              description="Các cập nhật về đơn hàng, bản quyền và hỗ trợ sẽ hiển thị tại đây."
              icon="bell"
              mode="empty"
              title="Chưa có thông báo."
            />
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {loadMoreError && items.length > 0 ? (
                <InlineNotice
                  actionLabel="Thử lại"
                  actionLoading={loadingMore}
                  message={loadMoreError}
                  onAction={() => void loadMore()}
                  tone="error"
                />
              ) : null}
              {nextCursor ? (
                <AppButton
                  label={loadingMore ? 'Đang tải...' : 'Tải thêm thông báo'}
                  loading={loadingMore}
                  onPress={() => void loadMore()}
                  variant="secondary"
                />
              ) : null}
            </View>
          }
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              onRefresh={() => void refresh()}
              refreshing={refreshing}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <SurfaceCard
              accessibilityLabel={`${item.title}. ${item.isRead ? 'Đã đọc' : 'Chưa đọc'}`}
              onPress={() => handlePressItem(item)}
              selected={!item.isRead}
            >
              <View style={styles.cardHeader}>
                <AppText style={styles.title} variant="cardTitle">
                  {item.title}
                </AppText>
                {!item.isRead ? (
                  <StatusBadge label="Chưa đọc" tone="info" />
                ) : null}
              </View>
              <AppText tone="secondary" variant="body">
                {item.content}
              </AppText>
              {item.createdAt ? (
                <AppText tone="muted" variant="tabLabel">
                  {formatDateTimeVi(item.createdAt)}
                </AppText>
              ) : null}
            </SurfaceCard>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  noticeWrap: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  listContent: {
    flexGrow: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
  },
  footer: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
});
