import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePublicKnowledgeDetail } from '../../../application/knowledge/useKnowledge';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppIcon } from '../../components/ui/AppIcon';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatDateVi } from '../../formatters';
import { colors, radius, sizes, spacing } from '../../theme/tokens';

export interface HelpDetailScreenProps {
  readonly documentId: string;
  readonly onBack: () => void;
  readonly onOpenDocument: (documentId: string) => void;
  readonly onOpenProduct: (productId: string) => void;
  readonly onOpenSupport: (productId: string, productName: string) => void;
}

function renderParagraph(paragraph: string, key: string) {
  const trimmed = paragraph.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
    const items = trimmed
      .split('\n')
      .map((line) => line.replace(/^[-*]\s+/, '').trim())
      .filter(Boolean);
    return (
      <View key={key} style={styles.bulletList}>
        {items.map((item, idx) => (
          <AppText key={`${key}-${idx}`} style={styles.listItem} variant="body">
            • {item}
          </AppText>
        ))}
      </View>
    );
  }

  if (/^\d+\.\s+/.test(trimmed)) {
    const items = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return (
      <View key={key} style={styles.bulletList}>
        {items.map((item, idx) => (
          <AppText key={`${key}-${idx}`} style={styles.listItem} variant="body">
            {item}
          </AppText>
        ))}
      </View>
    );
  }

  return (
    <AppText key={key} selectable variant="body">
      {trimmed}
    </AppText>
  );
}

export function HelpDetailScreen({
  documentId,
  onBack,
  onOpenDocument,
  onOpenProduct,
  onOpenSupport,
}: HelpDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { document, loading, error, reload } = usePublicKnowledgeDetail(documentId);
  const [tocOpen, setTocOpen] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const contentTopRef = useRef(0);
  const chunkOffsetsRef = useRef<Record<string, number>>({});

  const jumpToHeading = (chunkId: string) => {
    setTocOpen(false);
    const relativeY = chunkOffsetsRef.current[chunkId];
    if (typeof relativeY === 'number') {
      scrollRef.current?.scrollTo({
        y: Math.max(0, contentTopRef.current + relativeY - spacing.md),
        animated: true,
      });
    }
  };

  if (loading && !document) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Hướng dẫn" />}>
        <FeedbackState mode="loading" title="Đang tải nội dung bài viết..." />
      </Screen>
    );
  }

  if (error || !document) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Hướng dẫn" />}>
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reload()}
          title={error ?? 'Không tìm thấy tài liệu hướng dẫn.'}
        />
      </Screen>
    );
  }

  const headings = document.chunks
    .filter((chunk) => Boolean(chunk.heading))
    .map((chunk) => ({ id: chunk.id, title: chunk.heading! }));

  return (
    <Screen
      scrollRef={scrollRef}
      header={
        <AppHeader
          onBack={onBack}
          title={document.title}
          trailing={
            headings.length > 1 ? (
              <AppButton
                label="Mục lục"
                onPress={() => setTocOpen(true)}
                variant="tertiary"
              />
            ) : undefined
          }
        />
      }
    >
      <SurfaceCard>
        <View style={styles.badges}>
          <StatusBadge label={document.productName} tone="info" />
          {document.planName ? (
            <StatusBadge label={document.planName} tone="neutral" />
          ) : null}
        </View>
        <AppText accessibilityRole="header" variant="detailHeadline">
          {document.title}
        </AppText>
        <AppText tone="muted" variant="secondary">
          Cập nhật: {formatDateVi(document.updatedAt)}
        </AppText>
        {document.summary ? (
          <AppText tone="secondary" variant="body">
            {document.summary}
          </AppText>
        ) : null}
        {document.tags.length > 0 ? (
          <View style={styles.badges}>
            {document.tags.map((tag) => (
              <StatusBadge key={tag} label={tag} tone="neutral" />
            ))}
          </View>
        ) : null}
      </SurfaceCard>

      <View
        onLayout={(event) => {
          contentTopRef.current = event.nativeEvent.layout.y;
        }}
      >
        <SurfaceCard>
          {document.chunks.length > 0 ? (
            document.chunks.map((chunk, chunkIdx) => (
              <View
                key={chunk.id || String(chunkIdx)}
                onLayout={(event) => {
                  if (chunk.id) {
                    chunkOffsetsRef.current[chunk.id] = event.nativeEvent.layout.y;
                  }
                }}
                style={[styles.chunkSection, chunkIdx > 0 ? styles.chunkDivider : null]}
              >
              {chunk.heading ? (
                <AppText accessibilityRole="header" variant="sectionTitle">
                  {chunk.heading}
                </AppText>
              ) : null}
              {chunk.content
                .split('\n\n')
                .map((paragraph, pIdx) =>
                  renderParagraph(paragraph, `${chunk.id}-${pIdx}`),
                )}
            </View>
          ))
        ) : (
          <AppText selectable variant="body">
            {document.content}
          </AppText>
        )}
        </SurfaceCard>
      </View>

      <SurfaceCard>
        <AppText variant="cardTitle">Sản phẩm & hỗ trợ liên quan</AppText>
        <AppButton
          fullWidth
          label={`Xem sản phẩm ${document.productName}`}
          onPress={() => onOpenProduct(document.productId)}
          variant="secondary"
        />
        <AppButton
          fullWidth
          icon="support"
          label="Cần hỗ trợ thêm?"
          onPress={() => onOpenSupport(document.productId, document.productName)}
          variant="primary"
        />
      </SurfaceCard>

      {document.relatedDocuments.length > 0 ? (
        <View style={styles.relatedSection}>
          <AppText accessibilityRole="header" variant="sectionTitle">
            Bài viết cùng chủ đề
          </AppText>
          {document.relatedDocuments.map((rel) => (
            <SurfaceCard key={rel.id} onPress={() => onOpenDocument(rel.id)}>
              <AppText variant="bodySemibold">{rel.title}</AppText>
              <AppText tone="muted" variant="secondary">
                {rel.productName}
              </AppText>
            </SurfaceCard>
          ))}
        </View>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setTocOpen(false)}
        transparent
        visible={tocOpen}
      >
        <Pressable
          accessibilityRole="none"
          onPress={() => setTocOpen(false)}
          style={styles.backdrop}
        >
          <Pressable
            onPress={() => undefined}
            style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}
          >
            <View style={styles.sheetHeader}>
              <AppText accessibilityRole="header" variant="sectionTitle">
                Mục lục bài viết
              </AppText>
              <Pressable
                accessibilityLabel="Đóng mục lục"
                accessibilityRole="button"
                onPress={() => setTocOpen(false)}
                style={styles.closeBtn}
              >
                <AppIcon name="close" size={sizes.iconMd} tone="secondary" />
              </Pressable>
            </View>
            <ScrollView>
              {headings.map((heading, idx) => (
                <Pressable
                  key={heading.id}
                  accessibilityRole="button"
                  onPress={() => jumpToHeading(heading.id)}
                  style={styles.tocItem}
                >
                  <AppText variant="body">
                    {idx + 1}. {heading.title}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
            <AppButton
              label="Đóng"
              onPress={() => setTocOpen(false)}
              variant="secondary"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chunkSection: {
    gap: spacing.xs,
  },
  chunkDivider: {
    borderTopColor: colors.border,
    borderTopWidth: sizes.borderWidth,
    paddingTop: spacing.sm,
  },
  bulletList: {
    gap: spacing.xxs,
  },
  listItem: {
    paddingLeft: spacing.xs,
  },
  relatedSection: {
    gap: spacing.sm,
  },
  backdrop: {
    backgroundColor: colors.overlayBackdrop,
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    gap: spacing.md,
    maxHeight: '70%',
    padding: spacing.md,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizes.minHitTarget,
    minWidth: sizes.minHitTarget,
  },
  tocItem: {
    borderBottomColor: colors.border,
    borderBottomWidth: sizes.borderWidth,
    justifyContent: 'center',
    minHeight: sizes.minHitTarget,
    paddingVertical: spacing.sm,
  },
});
