import { StyleSheet, View } from 'react-native';

import {
  orderStatusLabel,
  orderStatusTone,
  selectOrderPrimaryAction,
  type OrderPrimaryAction,
} from '../../application/orders/orderPresentation';
import type { MobileOrderSummary } from '../../infrastructure/api/client';
import { formatDateTimeVi, formatVnd } from '../formatters';
import { spacing } from '../theme/tokens';
import { AppButton } from './ui/AppButton';
import { AppText } from './ui/AppText';
import { StatusBadge } from './ui/StatusBadge';
import { SurfaceCard } from './ui/SurfaceCard';

export interface OrderCardProps {
  readonly order: MobileOrderSummary;
  readonly fulfillmentHint?: string | null;
  readonly onOpenDetail: (orderId: string) => void;
  readonly onPrimaryAction?: (order: MobileOrderSummary, action: OrderPrimaryAction) => void;
}

export function OrderCard({
  order,
  fulfillmentHint,
  onOpenDetail,
  onPrimaryAction,
}: OrderCardProps) {
  const action = selectOrderPrimaryAction(order);

  return (
    <SurfaceCard onPress={() => onOpenDetail(order.id)}>
      <View style={styles.headerBlock}>
        <AppText variant="cardTitle">{order.productNameSnapshot}</AppText>
        <AppText tone="secondary" variant="secondary">
          {order.planNameSnapshot} · {order.durationMonthsSnapshot} tháng ·{' '}
          {order.maxActiveDevicesSnapshot} thiết bị
        </AppText>
        <View style={styles.statusRow}>
          <StatusBadge
            label={orderStatusLabel(order.orderStatus)}
            tone={orderStatusTone(order.orderStatus)}
          />
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.subMetaRow}>
          <AppText
            ellipsizeMode="middle"
            numberOfLines={1}
            style={styles.orderNumber}
            tone="muted"
            variant="secondary"
          >
            {order.orderNumber}
          </AppText>
          <AppText tone="muted" variant="secondary">
            · {formatDateTimeVi(order.createdAt)}
          </AppText>
        </View>
        {fulfillmentHint ? (
          <AppText tone="info" variant="secondary">
            {fulfillmentHint}
          </AppText>
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <AppText variant="priceCard">{formatVnd(order.priceVndSnapshot)}</AppText>
        <AppButton
          label={action.label}
          onPress={() => {
            if (onPrimaryAction && action.kind !== 'detail') {
              onPrimaryAction(order, action);
            } else {
              onOpenDetail(order.id);
            }
          }}
          variant={action.kind === 'detail' ? 'secondary' : 'primary'}
        />
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: spacing.xs,
  },
  statusRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  body: {
    gap: spacing.xxs,
  },
  subMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xxs,
  },
  orderNumber: {
    flexShrink: 1,
  },
  footerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
  },
});
