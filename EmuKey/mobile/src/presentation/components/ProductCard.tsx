import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import type { MobileProduct } from '../../infrastructure/api/client';
import { formatVnd, getInitials } from '../formatters';
import { colors, radius, sizes, spacing } from '../theme/tokens';
import { AppButton } from './ui/AppButton';
import { AppText } from './ui/AppText';
import { SurfaceCard } from './ui/SurfaceCard';

export interface ProductCardProps {
  readonly product: MobileProduct;
  readonly onOpen: (productId: string) => void;
  readonly compact?: boolean;
  readonly variant?: 'list' | 'featured';
}

export function ProductCard({ product, onOpen, compact = false, variant = 'list' }: ProductCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const minPrice = product.plans.length
    ? Math.min(...product.plans.map((plan) => plan.priceVnd))
    : null;
  const showImage = Boolean(product.imageUrl && !imageFailed);

  if (variant === 'featured') {
    return (
      <SurfaceCard style={styles.featuredCard}>
        <View style={styles.featuredArtwork}>
          <AppText tone="primary" variant="pageTitle">{getInitials(product.name)}</AppText>
          {showImage ? (
            <Image
              accessibilityIgnoresInvertColors
              onError={() => setImageFailed(true)}
              resizeMode="cover"
              source={{ uri: product.imageUrl! }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </View>
        <View style={styles.featuredBody}>
          <AppText accessibilityRole="header" variant="cardTitle">{product.name}</AppText>
          {product.providerDisplayName ? (
            <AppText tone="muted" variant="secondary">{product.providerDisplayName}</AppText>
          ) : null}
          <AppText numberOfLines={3} tone="secondary" variant="secondary">{product.summary}</AppText>
          <AppText tone={minPrice !== null ? 'primary' : 'muted'} variant="priceCard">
            {minPrice !== null ? `Từ ${formatVnd(minPrice)}` : 'Chưa có gói'}
          </AppText>
          <AppButton
            accessibilityLabel={`Xem gói & chi tiết: ${product.name}`}
            fullWidth
            label="Xem gói & chi tiết"
            onPress={() => onOpen(product.id)}
          />
        </View>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard
      accessibilityHint="Mở chi tiết sản phẩm"
      accessibilityLabel={`${product.name}. ${minPrice !== null ? `Từ ${formatVnd(minPrice)}` : 'Chưa có gói'}`}
      onPress={() => onOpen(product.id)}
      style={compact ? styles.compactCard : undefined}
    >
      <View style={styles.topRow}>
        <View style={styles.artworkFallback}>
          <AppText tone="primary" variant="cardTitle">
            {getInitials(product.name)}
          </AppText>
          {showImage ? (
            <Image
              accessibilityIgnoresInvertColors
              onError={() => setImageFailed(true)}
              resizeMode="cover"
              source={{ uri: product.imageUrl! }}
              style={styles.artworkOverlay}
            />
          ) : null}
        </View>
        <View style={styles.info}>
          <AppText numberOfLines={2} variant="cardTitle">
            {product.name}
          </AppText>
          {product.providerDisplayName ? (
            <AppText numberOfLines={1} tone="muted" variant="secondary">
              {product.providerDisplayName}
            </AppText>
          ) : null}
        </View>
      </View>

      <AppText numberOfLines={2} tone="secondary" variant="secondary">
        {product.summary}
      </AppText>

      <View style={styles.bottomRow}>
        <AppText tone={minPrice !== null ? 'primary' : 'muted'} variant="priceCard">
          {minPrice !== null ? `Từ ${formatVnd(minPrice)}` : 'Chưa có gói'}
        </AppText>
        <AppButton
          label="Xem chi tiết"
          onPress={() => onOpen(product.id)}
          variant="secondary"
        />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  featuredCard: {
    gap: 0,
    overflow: 'hidden',
    padding: 0,
  },
  featuredArtwork: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    height: 180,
    justifyContent: 'center',
    width: '100%',
  },
  featuredBody: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  compactCard: {
    flex: 1,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  artworkOverlay: {
    borderRadius: radius.control,
    height: 54,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 54,
  },
  artworkFallback: {
    alignItems: 'center',
    backgroundColor: colors.infoSurface,
    borderColor: colors.infoBorder,
    borderRadius: radius.control,
    borderWidth: sizes.borderWidth,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  info: {
    flex: 1,
    gap: spacing.xxs,
  },
  bottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
  },
});
