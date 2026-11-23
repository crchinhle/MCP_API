import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { useConversationThread } from '../../../application/assistance/useConversationThread';
import { useGuestAssistant } from '../../../application/assistance/useGuestAssistant';
import { useCustomerSession } from '../../../application/auth/useCustomerSession';
import {
  createConversation,
  listConversations,
  type MobileConversation,
  type MobileConversationMessage,
} from '../../../infrastructure/api/client';
import { MessageBubble } from '../../components/MessageBubble';
import { MessageComposer } from '../../components/MessageComposer';
import { AppHeader } from '../../components/layout/AppHeader';
import { KeyboardScreen } from '../../components/layout/KeyboardScreen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { colors, radius, sizes, spacing } from '../../theme/tokens';

const SUGGESTIONS = [
  'So sánh các gói bản quyền phổ biến của EmuKey',
  'Cách nhận và lưu mã kích hoạt an toàn sau khi thanh toán',
  'Chính sách gia hạn và giữ nguyên thiết bị đang dùng',
] as const;

export interface AiAssistantScreenProps {
  readonly productId?: string;
  readonly productName?: string;
  readonly onBack: () => void;
  readonly onOpenProduct: (productId: string, planId?: string) => void;
  readonly onOpenDocument: (documentId: string) => void;
  readonly onOpenThread?: (conversationId: string) => void;
  readonly onRequireLogin?: () => void;
}

export function AiAssistantScreen({
  productId,
  productName,
  onBack,
  onOpenProduct,
  onOpenDocument,
  onOpenThread,
  onRequireLogin,
}: AiAssistantScreenProps) {
  const { isAuthenticated } = useCustomerSession();
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [pendingDraft, setPendingDraft] = useState('');
  const [creatingError, setCreatingError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [recentAiConversation, setRecentAiConversation] = useState<MobileConversation | null>(null);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);

  const guest = useGuestAssistant();
  const thread = useConversationThread(isAuthenticated ? conversationId : undefined);
  const listRef = useRef<FlatList<MobileConversationMessage>>(null);
  const nearBottomRef = useRef(true);
  const justSentRef = useRef(false);
  const prevCountRef = useRef(0);

  useEffect(() => {
    // Reset local thread reference on logout/login boundary.
    setConversationId(undefined);
    setPendingDraft('');
    setCreatingError(null);
    setRecentAiConversation(null);
    setHasUnreadBelow(false);
    nearBottomRef.current = true;
    justSentRef.current = false;
    prevCountRef.current = 0;
    guest.reset();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || conversationId || typeof listConversations !== 'function') {
      return;
    }
    let cancelled = false;
    void Promise.resolve(listConversations())
      .then((items) => {
        if (cancelled) return;
        const activeAi = productId
          ? items.find(
              (item) =>
                item.status === 'AI_ACTIVE' &&
                item.contextType === 'PRODUCT' &&
                item.contextId === productId,
            )
          : items.find((item) => item.status === 'AI_ACTIVE');
        setRecentAiConversation(activeAi ?? null);
      })
      .catch(() => {
        if (!cancelled) setRecentAiConversation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, isAuthenticated, productId]);

  const activeMessages = isAuthenticated ? thread.messages : guest.messages;

  useEffect(() => {
    if (
      activeMessages.length > prevCountRef.current &&
      !nearBottomRef.current &&
      !justSentRef.current
    ) {
      setHasUnreadBelow(true);
    }
    prevCountRef.current = activeMessages.length;
  }, [activeMessages.length]);
  const activeDraft = isAuthenticated
    ? conversationId
      ? thread.draft
      : pendingDraft
    : guest.draft;
  const setActiveDraft = isAuthenticated
    ? conversationId
      ? thread.setDraft
      : setPendingDraft
    : guest.setDraft;
  const activePending = isAuthenticated
    ? creating || thread.sending || thread.escalating
    : guest.pending;
  const activeError = creatingError ?? (isAuthenticated ? thread.error : guest.error);

  const sendAuthenticatedQuestion = async (questionText?: string) => {
    const trimmed = (questionText ?? activeDraft).trim();
    if (!trimmed || trimmed.length > 4000 || activePending) return;

    if (!conversationId) {
      setCreating(true);
      setCreatingError(null);
      try {
        const created = await createConversation({
          mode: 'AI',
          contextType: productId ? 'PRODUCT' : 'GENERAL',
          ...(productId ? { contextId: productId } : {}),
          title: productName ? `Hỏi về ${productName}` : 'Hỏi trợ lý AI',
        });
        setPendingDraft('');
        setConversationId(created.id);
        // Wait for next render or ask directly? We can ask directly on created.id via thread?
        // Wait: thread hook hasn't received created.id yet in this closure; ask using thread after mount
        // OR call askConversationAi directly? Better: store pendingQuestion in ref or pass straight!
        setPendingInitialQuestion(trimmed);
        return;
      } catch {
        setCreatingError('Không thể bắt đầu phiên trợ lý AI. Vui lòng thử lại.');
      } finally {
        setCreating(false);
      }
      return;
    }

    if (thread.conversation && thread.conversation.status !== 'AI_ACTIVE') {
      if (onOpenThread) onOpenThread(thread.conversation.id);
      return;
    }

    await thread.askAi(trimmed);
  };

  const [pendingInitialQuestion, setPendingInitialQuestion] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (
      isAuthenticated &&
      conversationId &&
      thread.conversation?.id === conversationId &&
      pendingInitialQuestion &&
      !thread.sending
    ) {
      const q = pendingInitialQuestion;
      setPendingInitialQuestion(null);
      void thread.askAi(q).then((ok) => {
        if (ok) thread.setDraft('');
      });
    }
  }, [
    conversationId,
    isAuthenticated,
    pendingInitialQuestion,
    thread,
  ]);

  const handleSend = () => {
    nearBottomRef.current = true;
    justSentRef.current = true;
    setHasUnreadBelow(false);
    if (isAuthenticated) {
      void sendAuthenticatedQuestion();
    } else {
      void guest.ask();
    }
  };

  const handleEscalate = async () => {
    if (!isAuthenticated) {
      onRequireLogin?.();
      return;
    }
    if (!conversationId) return;
    const ok = await thread.escalateToSupport();
    if (ok && onOpenThread) {
      onOpenThread(conversationId);
    }
  };

  const handedOff =
    isAuthenticated &&
    thread.conversation &&
    thread.conversation.status !== 'AI_ACTIVE';

  return (
    <KeyboardScreen
      edges={[]}
      header={
        <AppHeader
          onBack={onBack}
          title="Trợ lý AI EmuKey"
          trailing={
            activeMessages.length > 0 ? (
              <AppButton
                disabled={activePending}
                label="Mới"
                onPress={() => {
                  setConversationId(undefined);
                  setPendingInitialQuestion(null);
                  setCreatingError(null);
                  setHasUnreadBelow(false);
                  nearBottomRef.current = true;
                  justSentRef.current = false;
                  prevCountRef.current = 0;
                  guest.reset();
                }}
                variant="tertiary"
              />
            ) : undefined
          }
        />
      }
    >
      {isAuthenticated && thread.syncWarning ? (
        <View style={styles.syncBannerWrap}>
          <InlineNotice
            actionLabel="Thử lại"
            message={thread.syncWarning}
            onAction={() => void thread.reload()}
            tone="warning"
          />
        </View>
      ) : null}

      <View style={styles.listWrapper}>
        <FlatList
          ref={listRef}
          contentContainerStyle={styles.listContent}
          data={activeMessages}
          keyExtractor={(item) => `${item.id}:${item.senderType}`}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              {recentAiConversation && isAuthenticated ? (
                <InlineNotice
                  actionLabel="Tiếp tục hội thoại"
                  message={`Bạn có một phiên trợ lý AI trước đó: "${recentAiConversation.title || 'Hỏi trợ lý AI'}".`}
                  onAction={() => {
                    nearBottomRef.current = true;
                    setConversationId(recentAiConversation.id);
                  }}
                  title="Phiên trước đó"
                  tone="info"
                />
              ) : null}

              <SurfaceCard>
                <AppText accessibilityRole="header" variant="sectionTitle">
                  Tôi có thể giúp gì cho bạn?
                </AppText>
                <AppText tone="secondary" variant="body">
                  Hỏi về sản phẩm, so sánh gói hoặc hướng dẫn sử dụng từ nguồn tri thức chính thức. Trợ lý không tự tạo đơn hay quyết định thanh toán.
                </AppText>
                {productName ? (
                  <InlineNotice
                    message={`Đang hỏi trong ngữ cảnh sản phẩm: ${productName}`}
                    tone="info"
                  />
                ) : null}
              </SurfaceCard>

            <View style={styles.suggestions}>
              <AppText tone="muted" variant="secondarySemibold">
                Gợi ý câu hỏi
              </AppText>
              {SUGGESTIONS.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  onPress={() => setActiveDraft(item)}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    pressed ? styles.suggestionPressed : null,
                  ]}
                >
                  <AppText tone="info" variant="secondary">
                    {item}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={
          <View style={styles.listFooter}>
            {activePending ? (
              <InlineNotice message="Đang trả lời..." tone="info" />
            ) : null}
            {activeError ? (
              <InlineNotice
                actionLabel={
                  isAuthenticated && conversationId ? 'Chuyển cho nhân viên' : undefined
                }
                message={activeError}
                onAction={
                  isAuthenticated && conversationId
                    ? () => void handleEscalate()
                    : undefined
                }
                tone="error"
              />
            ) : null}
            {handedOff && thread.conversation && onOpenThread ? (
              <InlineNotice
                actionLabel="Mở hội thoại hỗ trợ"
                message="Hội thoại này đã được chuyển sang nhân viên hỗ trợ."
                onAction={() => onOpenThread(thread.conversation!.id)}
                tone="info"
              />
            ) : null}
          </View>
        }
        onContentSizeChange={() => {
          if ((nearBottomRef.current || justSentRef.current) && activeMessages.length > 0) {
            listRef.current?.scrollToEnd({ animated: justSentRef.current });
            justSentRef.current = false;
            setHasUnreadBelow(false);
          }
        }}
        onScroll={(event) => {
          const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
          const isNear =
            contentSize.height - (layoutMeasurement.height + contentOffset.y) < 80;
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
              isAuthenticated
                ? () => void handleEscalate()
                : onRequireLogin
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

      <MessageComposer
        accessibilityLabel="Câu hỏi cho trợ lý AI"
        draft={activeDraft}
        includeBottomInset
        maxLength={4000}
        onChangeDraft={setActiveDraft}
        onFollowUpPress={
          handedOff && thread.conversation && onOpenThread
            ? () => onOpenThread(thread.conversation!.id)
            : undefined
        }
        followUpLabel="Mở hội thoại hỗ trợ"
        onPrimaryPress={handleSend}
        pending={activePending}
        placeholder="Nhập câu hỏi của bạn (tối đa 4.000 ký tự)..."
        primaryDisabled={!activeDraft.trim() || activeDraft.trim().length > 4000}
        primaryLabel="Hỏi AI"
        readOnly={Boolean(handedOff)}
        readOnlyMessage="Hội thoại đã chuyển sang nhân viên hỗ trợ."
      />
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  emptyWrap: {
    gap: spacing.md,
  },
  suggestions: {
    gap: spacing.xs,
  },
  suggestionChip: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.infoBorder,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    minHeight: sizes.minHitTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  suggestionPressed: {
    backgroundColor: colors.surfaceSelected,
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
  listFooter: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
});
