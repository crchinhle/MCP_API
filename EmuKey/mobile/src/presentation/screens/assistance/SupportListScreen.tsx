import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import {
  conversationContextLabels,
  conversationStatusLabels,
  useSupportRequests,
} from '../../../application/assistance/useSupportRequests';
import { useSafeFocusRefresh } from '../../../application/navigation/useSafeFocusRefresh';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { colors, spacing, type SemanticTone } from '../../theme/tokens';

function statusTone(status: string): SemanticTone {
  if (status === 'CLOSED') return 'neutral';
  if (status === 'SUPPORT_ACTIVE') return 'success';
  if (status === 'WAITING_SUPPORT') return 'warning';
  return 'info';
}

export interface SupportListScreenProps {
  readonly onBack?: () => void;
  readonly onCreateRequest: () => void;
  readonly onOpenThread: (conversationId: string) => void;
}

export function SupportListScreen({
  onBack,
  onCreateRequest,
  onOpenThread,
}: SupportListScreenProps) {
  const { conversations, loading, refreshing, error, reload, refresh } =
    useSupportRequests();
  useSafeFocusRefresh(() => {
    void refresh();
  });

  return (
    <Screen
      header={
        <AppHeader
          onBack={onBack}
          title="Hỗ trợ khách hàng"
          trailing={
            <AppButton
              icon="plus"
              label="Tạo mới"
              onPress={onCreateRequest}
              variant="secondary"
            />
          }
        />
      }
      padded={false}
      scroll="none"
    >
      {loading && conversations.length === 0 ? (
        <FeedbackState mode="loading" title="Đang tải hội thoại hỗ trợ..." />
      ) : error && conversations.length === 0 ? (
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reload()}
          title={error}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={conversations}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <FeedbackState
              actionLabel="Tạo yêu cầu hỗ trợ"
              description="Tạo yêu cầu mới để trao đổi với nhân viên hỗ trợ hoặc trợ lý AI."
              icon="support"
              mode="empty"
              onAction={onCreateRequest}
              title="Bạn chưa có hội thoại hỗ trợ"
            />
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
            <SurfaceCard onPress={() => onOpenThread(item.id)}>
              <AppText variant="cardTitle">
                {typeof item.title === 'string' && item.title.trim()
                  ? item.title
                  : 'Hội thoại hỗ trợ'}
              </AppText>
              <AppText tone="secondary" variant="secondary">
                Chủ đề: {conversationContextLabels[item.contextType] ?? item.contextType}
              </AppText>
              <StatusBadge
                label={conversationStatusLabels[item.status] ?? item.status}
                tone={statusTone(item.status)}
              />
            </SurfaceCard>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
});
