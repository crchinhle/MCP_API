import { FactList, formatMoney } from './WorkspacePrimitives';

/**
 * PAY-14: the checkout summary must show the full server-side snapshot for the
 * order (plan, term, device cap, entitlements, price), not only the total.
 * Every value comes from the created order so the buyer sees exactly what the
 * backend will charge.
 */
export interface OrderSummarySnapshot {
  readonly total: number;
  readonly productName?: string;
  readonly planName?: string;
  readonly billingCycle?: string;
  readonly durationMonths?: number;
  readonly maxActiveDevices?: number;
  readonly entitlements?: Readonly<Record<string, unknown>>;
  readonly orderNumber?: string;
}

const billingCycleLabels: Record<string, string> = {
  MONTHLY: 'Theo tháng',
  QUARTERLY: 'Theo quý',
  YEARLY: 'Theo năm',
};

export function entitlementLabel(key: string, value: unknown): string {
  const label: Record<string, string> = {
    desktop: 'Ứng dụng máy tính',
  };
  if (value === true) return label[key] ?? key;
  const formatted = value === false ? 'Không' : typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value) ?? '—';
  return `${label[key] ?? key}: ${formatted}`;
}

export function OrderSummary({ order }: { readonly order: OrderSummarySnapshot }) {
  const entitlements = Object.entries(order.entitlements ?? {})
    .map(([key, value]) => entitlementLabel(key, value));
  const facts = [
    { label: 'Tổng thanh toán', value: formatMoney(order.total) },
    order.productName ? { label: 'Sản phẩm', value: order.productName } : null,
    order.planName ? { label: 'Gói', value: order.planName } : null,
    order.billingCycle ? { label: 'Kỳ thanh toán', value: billingCycleLabels[order.billingCycle] ?? order.billingCycle } : null,
    order.durationMonths ? { label: 'Thời hạn', value: `${order.durationMonths} tháng` } : null,
    order.maxActiveDevices != null ? { label: 'Số thiết bị tối đa', value: `${order.maxActiveDevices} thiết bị` } : null,
    entitlements.length ? { label: 'Quyền lợi', value: entitlements.join(', ') } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <section className="workspace-card order-summary">
      <h2>Chi tiết thanh toán</h2>
      {order.orderNumber ? <p className="muted-copy">Mã đơn: {order.orderNumber}</p> : null}
      <FactList facts={facts} />
      <small>Giá cuối cùng được snapshot từ gói đã công bố khi tạo đơn.</small>
    </section>
  );
}
