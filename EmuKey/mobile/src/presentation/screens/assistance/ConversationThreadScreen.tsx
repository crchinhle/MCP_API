import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import type { MobileConversationMessage } from '../../../infrastructure/api/client';
import { useConversationThread } from '../../../application/assistance/useConversationThread';
import {
  conversationContextLabels,
  conversationStatusLabels,
} from '../../../application/assistance/useSupportRequests';
import { MessageBubble } from '../../components/MessageBubble';
import { MessageComposer } from '../../components/MessageComposer';
import { AppHeader } from '../../components/layout/AppHeader';
import { KeyboardScreen } from '../../components/layout/KeyboardScreen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { colors, radius, sizes, spacing } from '../../theme/tokens';

export interface ConversationThreadScreenProps {
  readonly conversationId: string;
  readonly onBack: () => void;
  readonly onOpenProduct: (productId: string, planId?: string) => void;
  readonly onOpenDocument: (documentId: string) => void;
  readonly onCreateFollowUp: () => void;
}

export function ConversationThreadScreen({
  conversationId,
  onBack,
  onOpenProduct,
  onOpenDocument,
  onCreateFollowUp,
}: ConversationThreadScreenProps) {
  const {
    conversation,
    messages,
    draft,
    setDraft,
    loading,
    sending,
    closing,
    escalating,
    error,
    syncWarning,
    reload,
    sendMessage,
    askAi,
    escalateToSupport,
    closeThread,
  } = useConversationThread(conversationId);

  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
  const nearBottomRef = useRef(true);
  const justSentRef = useRef(false);
  const prevCountRef = useRef(0);
  const listRef = useRef<FlatList<MobileConversationMessage>>(null);

  useEffect(() => {
    if (messages.length > prevCountRef.current && !nearBottomRef.current && !justSentRef.current) {
      setHasUnreadBelow(true);
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  const isClosed = conversation?.status === 'CLOSED';
  const isAiActive = conversation?.status === 'AI_ACTIVE';
  const maxLength = isAiActive ? 4000 : 8000;

  const title =
    conversation && typeof conversation.title === 'string' && conversation.title.trim()
      ? conversation.title
      : 'Hội thoại hỗ trợ';

  return (
    <KeyboardScreen
      edges={[]}
      header={
        <AppHeader
          onBack={onBack}
          title={title}
          trailing={
            conversation && !isClosed ? (
              <AppButton
                disabled={closing}
                label="Đã giải quyết"
                onPress={() => setConfirmCloseOpen(true)}
                variant="tertiary"
              />
            ) : undefined
          }
        />
      }
    >
      {conversation ? (
        <View style={styles.metaBar}>
          <StatusBadge
            label={conversationStatusLabels[conversation.status] ?? conversation.status}
            tone={
              isClosed
                ? 'neutral'
                : conversation.status === 'SUPPORT_ACTIVE'
                  ? 'success'
                  : 'info'
            }
          />
          <AppText tone="muted" variant="secondary">
            {conversationContextLabels[conversation.contextType] ?? conversation.contextType}
          </AppText>
        </View>
      ) : null}

      {syncWarning && conversation ? (
        <View style={styles.syncBannerWrap}>
          <InlineNotice
            actionLabel="Thử lại"
            message={syncWarning}
            onAction={() => void reload()}
            tone="warning"
          />
        </View>
      ) : null}

      {loading && !conversation ? (
        <FeedbackState mode="loading" title="Đang tải hội thoại..." />
      ) : error && !conversation ? (
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reload()}
          title={error}
        />
      ) : (
        <View style={styles.listWrapper}>
          <FlatList
            ref={listRef}
            testID="thread-message-list"
            contentContainerStyle={styles.listContent}
            data={messages}
            keyExtractor={(item) => `${item.id}:${item.senderType}`}
            ListEmptyComponent={
              <FeedbackState
                description="Gửi câu hỏi hoặc mô tả vấn đề ở khung bên dưới."
                icon="message"
                mode="empty"
                title="Chưa có tin nhắn trong hội thoại này"
              />
            }
            ListFooterComponent={
              <View style={styles.footerNotices}>
                {sending ? <InlineNotice message="Đang gửi..." tone="info" /> : null}
                {error ? <InlineNotice message={error} tone="error" /> : null}
              </View>
            }
            onContentSizeChange={() => {
              if ((nearBottomRef.current || justSentRef.current) && messages.length > 0) {
                listRef.current?.scrollToEnd({ animated: justSentRef.current });
                justSentRef.current = false;
                setHasUnreadBelow(false);
              }
            }}
            onScroll={(event) => {
              const { layoutMeasurement, contentOffset, contentSize } =
                event.nativeEvent;
              const isNear =
                contentSize.height - (layoutMeasurement.height + contentOffset.y) <
                80;
              nearBottomRef.current = isNear;
              if (isNear) {
                setHasUnreadBelow(false);
              }
            }}
            scrollEventThrottle={100}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                onOpenDocument={onOpenDocument}
                onOpenProduct={onOpenProduct}
                onRequestSupport={
                  isAiActive ? () => void escalateToSupport() : undefined
                }
              />
            )}
          />
          {hasUnreadBelow ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                nearBottomRef.current = true;
                setHasUnreadBelow(false);
                listRef.current?.scrollToEnd({ animated: true });
              }}
              style={styles.jumpPill}
            >
              <AppText tone="info" variant="secondarySemibold">
                Tin nhắn mới ↓
              </AppText>
            </Pressable>
          ) : null}
        </View>
      )}

      {conversation ? (
        <MessageComposer
          draft={draft}
          followUpLabel="Tạo yêu cầu tiếp theo"
          includeBottomInset
          maxLength={maxLength}
          onChangeDraft={setDraft}
          onFollowUpPress={onCreateFollowUp}
          onPrimaryPress={() => {
            nearBottomRef.current = true;
            justSentRef.current = true;
            setHasUnreadBelow(false);
            if (isAiActive) void askAi();
            else void sendMessage();
          }}
          onSecondaryPress={
            isAiActive ? () => void escalateToSupport() : undefined
          }
          pending={sending || escalating}
          placeholder={
            isAiActive
              ? 'Hỏi AI hoặc chuyển nhân viên (tối đa 4.000 ký tự)...'
              : 'Nhập tin nhắn gửi nhân viên hỗ trợ...'
          }
          primaryDisabled={!draft.trim() || draft.trim().length > maxLength}
          primaryLabel={isAiActive ? 'Hỏi AI có nguồn' : 'Gửi tin nhắn'}
          readOnly={isClosed}
          readOnlyMessage="Hội thoại đã hoàn tất. Không thể gửi thêm tin nhắn ở trạng thái này."
          secondaryDisabled={escalating}
          secondaryLabel={isAiActive ? 'Chuyển nhân viên' : undefined}
        />
      ) : null}

      <ConfirmDialog
        body="Đánh dấu hội thoại này là đã giải quyết? Sau khi đóng, bạn không thể gửi thêm tin nhắn trong luồng này."
        cancelLabel="Tiếp tục trao đổi"
        confirmLabel="Đóng hội thoại"
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={() => {
          void closeThread().then((ok) => {
            if (ok) setConfirmCloseOpen(false);
          });
        }}
        pending={closing}
        title="Xác nhận đã giải quyết"
        visible={confirmCloseOpen}
      />
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  metaBar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: sizes.borderWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  syncBannerWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  jumpPill: {
    alignSelf: 'center',
    backgroundColor: colors.infoSurface,
    borderColor: colors.infoBorder,
    borderRadius: radius.pill,
    borderWidth: sizes.borderWidth,
    bottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: 'absolute',
  },
  listContent: {
    flexGrow: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  footerNotices: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
});
