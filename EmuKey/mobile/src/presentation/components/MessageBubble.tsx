import { StyleSheet, View } from 'react-native';

import type { MobileConversationMessage } from '../../infrastructure/api/client';
import type { CatalogSourceDto } from '../../infrastructure/api/generated';
import { formatDateTimeVi, formatVnd } from '../formatters';
import { KnowledgeCitations } from './KnowledgeCitations';
import { colors, radius, sizes, spacing } from '../theme/tokens';
import { AppButton } from './ui/AppButton';
import { AppText } from './ui/AppText';
import { InlineNotice } from './ui/InlineNotice';

export interface MessageBubbleProps {
  readonly message: MobileConversationMessage;
  readonly onOpenProduct?: (productId: string, planId?: string) => void;
  readonly onOpenDocument?: (documentId: string) => void;
  readonly onRequestSupport?: () => void;
}

function uniqueCatalogSources(sources: readonly CatalogSourceDto[]): CatalogSourceDto[] {
  const seen = new Set<string>();
  const out: CatalogSourceDto[] = [];
  for (const source of sources) {
    const key = `${source.productId}:${source.planId}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(source);
    }
  }
  return out;
}

export function MessageBubble({
  message,
  onOpenProduct,
  onOpenDocument,
  onRequestSupport,
}: MessageBubbleProps) {
  const isCustomer = message.senderType === 'CUSTOMER';
  const isAi = message.senderType === 'AI';
  const isSystem = message.senderType === 'SYSTEM';

  const senderLabel = isCustomer
    ? 'Bạn'
    : isAi
      ? 'Trợ lý AI'
      : isSystem
        ? 'Hệ thống'
        : 'Nhân viên hỗ trợ';

  const catalogItems = isAi
    ? uniqueCatalogSources([
        ...(message.recommendations ?? []),
        ...(message.catalogSources ?? []),
      ])
    : [];

  const canEscalate =
    isAi &&
    message.outcome &&
    ['SUPPORT_REQUIRED', 'NO_SOURCES', 'PROVIDER_UNAVAILABLE'].includes(message.outcome);

  if (isSystem) {
    return (
      <View style={styles.systemWrap}>
        <AppText tone="muted" variant="secondarySemibold">
          {senderLabel}
        </AppText>
        <AppText tone="secondary" variant="secondary">
          {message.content}
        </AppText>
        {message.createdAt ? (
          <AppText tone="muted" variant="tabLabel">
            {formatDateTimeVi(message.createdAt)}
          </AppText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.row, isCustomer ? styles.rowCustomer : styles.rowOther]}>
      <View style={[styles.bubble, isCustomer ? styles.bubbleCustomer : styles.bubbleOther]}>
        <View style={styles.header}>
          <AppText
            tone={isCustomer ? 'info' : 'muted'}
            variant="secondarySemibold"
          >
            {senderLabel}
          </AppText>
          {message.createdAt ? (
            <AppText tone="muted" variant="tabLabel">
              {formatDateTimeVi(message.createdAt)}
            </AppText>
          ) : null}
        </View>

        <AppText selectable variant="body">
          {message.content}
        </AppText>

        {isAi && message.grounded === false ? (
          <InlineNotice
            message="AI không đủ nguồn chính thức để khẳng định toàn bộ câu trả lời."
            tone="warning"
          />
        ) : null}

        {isAi ? (
          <KnowledgeCitations
            citations={message.citationDetails ?? []}
            onOpenDocument={onOpenDocument}
          />
        ) : null}

        {isAi && catalogItems.length > 0 ? (
          <View style={styles.recommendations}>
            <AppText tone="secondary" variant="secondarySemibold">
              Gợi ý sản phẩm / gói
            </AppText>
            {catalogItems.map((source) => (
              <View key={source.id} style={styles.recCard}>
                <AppText variant="bodySemibold">
                  {source.productName} · {source.planName}
                </AppText>
                <AppText tone="secondary" variant="secondary">
                  {formatVnd(source.priceVnd)} · {source.maxActiveDevices} thiết bị ·{' '}
                  {source.durationMonths} tháng
                </AppText>
                {onOpenProduct ? (
                  <AppButton
                    label="Xem sản phẩm"
                    onPress={() => onOpenProduct(source.productId, source.planId)}
                    variant="secondary"
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {canEscalate && onRequestSupport ? (
          <AppButton
            label="Chuyển cho nhân viên hỗ trợ"
            onPress={onRequestSupport}
            variant="secondary"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  rowCustomer: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    borderRadius: radius.card,
    borderWidth: sizes.borderWidth,
    gap: spacing.xs,
    maxWidth: '90%',
    padding: spacing.sm,
  },
  bubbleCustomer: {
    backgroundColor: colors.infoSurface,
    borderColor: colors.infoBorder,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    width: '100%',
  },
  systemWrap: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSelected,
    borderRadius: radius.control,
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  recommendations: {
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  recCard: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    gap: spacing.xs,
    padding: spacing.sm,
  },
});
