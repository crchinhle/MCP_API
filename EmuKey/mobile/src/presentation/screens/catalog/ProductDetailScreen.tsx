import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useCatalogProduct } from '../../../application/catalog/useCatalog';
import { usePublicKnowledgeList } from '../../../application/knowledge/useKnowledge';
import { formatEntitlementsList } from '../../../application/orders/orderPresentation';
import { PlanOptionCard } from '../../components/PlanOptionCard';
import { AppHeader } from '../../components/layout/AppHeader';
import { BottomActionBar } from '../../components/layout/BottomActionBar';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatVnd, getInitials } from '../../formatters';
import { colors, radius, sizes, spacing } from '../../theme/tokens';

export interface ProductDetailScreenProps {
  readonly productId: string;
  readonly bottomInset?: boolean;
  readonly onBack: () => void;
  readonly onOpenCompare: (ids: string[]) => void;
  readonly onBuyNow: (productId: string, planId: string) => void;
  readonly onAddToCart: (productId: string, planId: string) => void;
  readonly onOpenHelpDocument: (documentId: string) => void;
}

export function ProductDetailScreen({
  productId,
  bottomInset = true,
  onBack,
  onOpenCompare,
  onBuyNow,
  onAddToCart,
  onOpenHelpDocument,
}: ProductDetailScreenProps) {
  const { product, loading, error, reload } = useCatalogProduct(productId);
  const helpDocs = usePublicKnowledgeList({ productId, limit: 3 });
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!product) return;
    if (product.plans.length === 1 && !selectedPlanId && product.plans[0]) {
      setSelectedPlanId(product.plans[0].id);
    }
  }, [product, selectedPlanId]);

  const selectedPlan = product?.plans.find((p) => p.id === selectedPlanId) ?? null;
  const planMissingAfterRefresh = Boolean(
    selectedPlanId && product && !product.plans.some((p) => p.id === selectedPlanId),
  );

  const toggleCompare = (planId: string) => {
    setCompareIds((current) =>
      current.includes(planId)
        ? current.filter((id) => id !== planId)
        : current.length < 4
          ? [...current, planId]
          : current,
    );
  };

  if (loading && !product) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Chi tiết sản phẩm" />}>
        <FeedbackState mode="loading" title="Đang tải thông tin sản phẩm..." />
      </Screen>
    );
  }

  if (error && !product) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Chi tiết sản phẩm" />}>
        <FeedbackState
          actionLabel="Thử lại"
          mode="error"
          onAction={() => void reload()}
          title={error}
        />
      </Screen>
    );
  }

  if (!product) {
    return (
      <Screen header={<AppHeader onBack={onBack} title="Không tìm thấy" />}>
        <FeedbackState
          actionLabel="Về danh mục"
          description="Sản phẩm có thể đã ngừng công bố hoặc không tồn tại."
          mode="empty"
          onAction={onBack}
          title="Sản phẩm không còn khả dụng"
        />
      </Screen>
    );
  }

  const entitlements = formatEntitlementsList(selectedPlan?.entitlements).filter(
    (item) => item.included,
  );
  const hasPlans = product.plans.length > 0;
  const canPurchase = Boolean(selectedPlan && hasPlans);

  return (
    <Screen
      footer={
        hasPlans ? (
          <BottomActionBar
            includeBottomInset={bottomInset}
            primary={
              <AppButton
                disabled={!canPurchase}
                label="Mua ngay"
                onPress={() => {
                  if (selectedPlan) onBuyNow(product.id, selectedPlan.id);
                }}
                size="large"
                style={styles.barButton}
              />
            }
            secondary={
              <AppButton
                disabled={!canPurchase}
                label="Thêm vào giỏ"
                onPress={() => {
                  if (selectedPlan) onAddToCart(product.id, selectedPlan.id);
                }}
                size="large"
                style={styles.barButton}
                variant="secondary"
              />
            }
            summaryLabel={selectedPlan ? selectedPlan.name : 'Chọn gói để tiếp tục'}
            summaryValue={selectedPlan ? formatVnd(selectedPlan.priceVnd) : undefined}
          />
        ) : undefined
      }
      header={<AppHeader onBack={onBack} title="Chi tiết sản phẩm" />}
    >
      <SurfaceCard>
        <View style={styles.heroRow}>
          {product.imageUrl && !imageFailed ? (
            <Image
              accessibilityIgnoresInvertColors
              onError={() => setImageFailed(true)}
              resizeMode="cover"
              source={{ uri: product.imageUrl }}
              style={styles.artwork}
            />
          ) : (
            <View style={styles.artworkFallback}>
              <AppText tone="primary" variant="pageTitle">
                {getInitials(product.name)}
              </AppText>
            </View>
          )}
          <View style={styles.heroMeta}>
            <AppText accessibilityRole="header" variant="detailHeadline">
              {product.name}
            </AppText>
            {product.providerDisplayName ? (
              <AppText tone="muted" variant="secondary">
                Nhà cung cấp: {product.providerDisplayName}
              </AppText>
            ) : null}
          </View>
        </View>
        <AppText tone="secondary" variant="body">
          {product.summary}
        </AppText>
      </SurfaceCard>

      {planMissingAfterRefresh ? (
        <InlineNotice
          message="Gói bạn vừa chọn không còn khả dụng. Vui lòng chọn lại gói khác."
          tone="warning"
        />
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText accessibilityRole="header" variant="sectionTitle">
            Chọn gói bản quyền
          </AppText>
          {product.plans.length >= 2 ? (
            <AppButton
              label="So sánh gói"
              onPress={() =>
                onOpenCompare(
                  compareIds.length >= 2
                    ? compareIds
                    : product.plans.slice(0, 4).map((p) => p.id),
                )
              }
              variant="tertiary"
            />
          ) : null}
        </View>

        {!hasPlans ? (
          <FeedbackState
            actionLabel="Về danh mục"
            description="Sản phẩm này hiện chưa có gói nào được công bố."
            mode="empty"
            onAction={onBack}
            title="Chưa có gói khả dụng"
          />
        ) : (
          product.plans.map((plan) => (
            <PlanOptionCard
              key={plan.id}
              compareDisabled={compareIds.length >= 4}
              compared={compareIds.includes(plan.id)}
              onSelect={setSelectedPlanId}
              onToggleCompare={product.plans.length >= 2 ? toggleCompare : undefined}
              plan={plan}
              selected={selectedPlan?.id === plan.id}
            />
          ))
        )}
      </View>

      {selectedPlan ? (
        entitlements.length > 0 ? (
          <SurfaceCard>
            <AppText variant="secondarySemibold">Quyền lợi đi kèm</AppText>
            <View style={styles.entitlementList}>
              {entitlements.map((item) => (
                <AppText key={item.key} tone="secondary" variant="secondary">
                  • {item.label}
                </AppText>
              ))}
            </View>
            <AppText tone="muted" variant="secondary">
              Số thiết bị và thời hạn có thể tùy chỉnh ở bước tiếp theo.
            </AppText>
          </SurfaceCard>
        ) : (
          <AppText tone="muted" variant="secondary">
            Số thiết bị và thời hạn có thể tùy chỉnh ở bước tiếp theo.
          </AppText>
        )
      ) : hasPlans ? (
        <InlineNotice
          message="Chọn một gói ở trên để xem quyền lợi và mua bản quyền."
          tone="info"
        />
      ) : null}

      {helpDocs.data?.items && helpDocs.data.items.length > 0 ? (
        <View style={styles.section}>
          <AppText accessibilityRole="header" variant="sectionTitle">
            Hướng dẫn liên quan
          </AppText>
          {helpDocs.data.items.map((doc) => (
            <SurfaceCard key={doc.id} onPress={() => onOpenHelpDocument(doc.id)}>
              <AppText variant="bodySemibold">{doc.title}</AppText>
              {doc.summary ? (
                <AppText numberOfLines={2} tone="secondary" variant="secondary">
                  {doc.summary}
                </AppText>
              ) : null}
            </SurfaceCard>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  barButton: {
    flex: 1,
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  artwork: {
    backgroundColor: colors.surfaceSelected,
    borderRadius: radius.card,
    height: 72,
    width: 72,
  },
  artworkFallback: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderColor: colors.infoBorder,
    borderRadius: radius.card,
    borderWidth: sizes.borderWidth,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  heroMeta: {
    flex: 1,
    gap: spacing.xxs,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  entitlementList: {
    gap: spacing.xxs,
  },
});
