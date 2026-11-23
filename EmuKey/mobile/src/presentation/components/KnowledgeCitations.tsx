import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getKnowledgeChunk } from '../../infrastructure/api/client';
import type { CitationDetailDto } from '../../infrastructure/api/generated';
import { colors, radius, sizes, spacing } from '../theme/tokens';
import { AppButton } from './ui/AppButton';
import { AppIcon } from './ui/AppIcon';
import { AppText } from './ui/AppText';
import { InlineNotice } from './ui/InlineNotice';

export interface KnowledgeCitationsProps {
  readonly citations: readonly CitationDetailDto[];
  readonly onOpenDocument?: (documentId: string) => void;
}

export function KnowledgeCitations({
  citations,
  onOpenDocument,
}: KnowledgeCitationsProps) {
  const insets = useSafeAreaInsets();
  const [opened, setOpened] = useState<{
    id: string;
    title: string;
    version: number;
    documentId: string;
    content: string;
  } | null>(null);
  const [error, setError] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!citations.length) {
    return (
      <AppText tone="muted" variant="secondary">
        Câu trả lời này chưa lưu nguồn xác thực.
      </AppText>
    );
  }

  const openChunk = async (source: CitationDetailDto) => {
    if (pendingId) return;
    setPendingId(source.chunkId);
    setError(false);
    setOpened(null);
    try {
      const value = await getKnowledgeChunk(source.documentId, source.chunkId);
      setOpened({
        id: source.chunkId,
        title: source.documentTitle,
        version: source.documentVersion,
        documentId: source.documentId,
        content: value.content,
      });
    } catch {
      setOpened(null);
      setError(true);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <View style={styles.container}>
      {citations.map((source) => (
        <View key={source.chunkId} style={styles.item}>
          <AppText variant="secondarySemibold">
            {source.documentTitle} · phiên bản {source.documentVersion}
          </AppText>
          <AppText tone="secondary" variant="secondary">
            {source.excerpt}
          </AppText>
          <View style={styles.actions}>
            <AppButton
              disabled={Boolean(pendingId)}
              icon="document"
              label={`Mở nguồn ${source.documentTitle}`}
              loading={pendingId === source.chunkId}
              onPress={() => void openChunk(source)}
              variant="secondary"
            />
            {onOpenDocument ? (
              <AppButton
                label="Xem toàn bộ tài liệu"
                onPress={() => onOpenDocument(source.documentId)}
                variant="tertiary"
              />
            ) : null}
          </View>
        </View>
      ))}
      {error ? (
        <InlineNotice
          message="Nguồn không còn khả dụng hoặc quyền đọc đã thay đổi."
          tone="error"
        />
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setOpened(null)}
        transparent
        visible={Boolean(opened)}
      >
        <Pressable
          accessibilityRole="none"
          onPress={() => setOpened(null)}
          style={styles.backdrop}
        >
          <Pressable
            onPress={() => undefined}
            style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleCol}>
                <AppText accessibilityRole="header" variant="sectionTitle">
                  {opened?.title}
                </AppText>
                <AppText tone="muted" variant="secondary">
                  Phiên bản {opened?.version}
                </AppText>
              </View>
              <Pressable
                accessibilityLabel="Đóng nguồn"
                accessibilityRole="button"
                onPress={() => setOpened(null)}
                style={styles.closeBtn}
              >
                <AppIcon name="close" size={sizes.iconMd} tone="secondary" />
              </Pressable>
            </View>
            <ScrollView style={styles.sheetScroll}>
              <AppText selectable variant="body">
                {opened?.content ?? ''}
              </AppText>
            </ScrollView>
            <AppButton label="Đóng nguồn" onPress={() => setOpened(null)} variant="secondary" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  item: {
    backgroundColor: colors.surfaceSelected,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  actions: {
    alignItems: 'flex-start',
    gap: spacing.xs,
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
    maxHeight: '80%',
    padding: spacing.md,
  },
  sheetHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  sheetTitleCol: {
    flex: 1,
    gap: spacing.xxs,
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizes.minHitTarget,
    minWidth: sizes.minHitTarget,
  },
  sheetScroll: {
    flexGrow: 0,
  },
});
