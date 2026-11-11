import { useEffect, useState } from 'react';
import type { StatusTone } from '../../domain/workspace';
import { CopyableId, FactList, formatMoney, StatusChip } from './WorkspacePrimitives';

/** All purchase values are the backend's immutable order snapshot. */
export interface OrderSummarySnapshot {
  readonly providerName?: string;
  readonly buyerName?: string;
  readonly buyerEmail?: string;
  readonly createdAt?: string;
  readonly paymentDueAt?: string;
  readonly orderStatus?: string;
  readonly orderType?: string;
  readonly pricing?: { basePriceVnd: number; baseDeviceQuantity: number; baseDurationMonths: number } | null;
  readonly total: number;
  readonly productName?: string;
  readonly planName?: string;
  readonly billingCycle?: string;
  readonly durationMonths?: number;
  readonly maxActiveDevices?: number;
  readonly entitlements?: Readonly<Record<string, unknown>>;
  readonly orderNumber?: string;
}

const billingCycleLabels: Record<string, string> = { MONTHLY: 'Theo tháng', QUARTERLY: 'Theo quý', YEARLY: 'Theo năm' };
// Only documented customer-facing features are rendered; internal/unknown keys stay private.
const entitlementLabels: Record<string, string> = {
  desktop: 'Ứng dụng máy tính', desktopApp: 'Ứng dụng máy tính',
  analytics: 'Báo cáo và phân tích', cloudSync: 'Đồng bộ dữ liệu đám mây', prioritySupport: 'Hỗ trợ ưu tiên',
};
const orderStatuses: Record<string, { label: string; tone: StatusTone }> = {
  WAITING_PAYMENT: { label: 'Chờ thanh toán', tone: 'warning' },
  PAYMENT_ACCEPTED: { label: 'Đã thanh toán', tone: 'success' },
  EXPIRED: { label: 'Hết hạn', tone: 'error' },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral' },
};

export function entitlementLabel(key: string, value: unknown): string | null {
  const label = entitlementLabels[key];
  if (!label) return null;
  if (value === true) return label;
  if (value === false) return `${label}: Không bao gồm`;
  return `${label}: Chưa có thông tin`;
}

export function OrderEntitlements({ entitlements }: { readonly entitlements?: Readonly<Record<string, unknown>> | undefined }) {
  const entries = Object.entries(entitlements ?? {}).filter(([key, value]) => Object.hasOwn(entitlementLabels, key) && value === true);
  if (!entries.length) return null;
  return <section className="order-summary__benefit-section" aria-label="Quyền lợi của gói">
    <h3>Quyền lợi của gói</h3>
    <ul className="order-summary__benefits">
      {entries.map(([key]) => <li key={key}>
        <span aria-hidden="true" className="order-summary__benefit-included">✓</span>
        <span>{entitlementLabels[key]}</span>
      </li>)}
    </ul>
  </section>;
}

function orderDate(value?: string) {
  if (!value) return 'Chưa có thông tin';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Chưa có thông tin';
  const parts = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  return `${part('day')}/${part('month')}/${part('year')}, ${part('hour')}:${part('minute')}`;
}

function PaymentCountdown({ dueAt }: { readonly dueAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  const deadline = Date.parse(dueAt);
  useEffect(() => {
    if (!Number.isFinite(deadline)) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  if (!Number.isFinite(deadline)) return null;
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return <div className="order-summary__countdown" role="timer" aria-live="off">
    <strong>{seconds > 0 ? `Còn ${Math.floor(seconds / 60)} phút ${seconds % 60} giây` : 'Đã đến hạn thanh toán'}</strong>
    <span>{seconds > 0 ? 'Vui lòng hoàn tất thanh toán trong thời gian này.' : 'Đang chờ hệ thống xác nhận trạng thái đơn hàng. Nếu đã chuyển tiền, không thanh toán lại.'}</span>
  </div>;
}

export function OrderSummary({ order }: { readonly order: OrderSummarySnapshot }) {
  const status = order.orderStatus ? orderStatuses[order.orderStatus] : undefined;
  const facts = [
    { label: 'Nhà cung cấp', value: order.providerName || 'Chưa có thông tin' },
    { label: 'Người mua', value: order.buyerName || 'Chưa có thông tin' },
    { label: 'Email người mua', value: order.buyerEmail || 'Chưa có thông tin' },
    { label: 'Ngày tạo đơn', value: orderDate(order.createdAt) },
    { label: 'Hạn thanh toán', value: orderDate(order.paymentDueAt) },
  ];
  return <section className="workspace-card order-summary">
    <header className="order-summary__heading"><h2>Chi tiết đơn hàng</h2>{status ? <StatusChip tone={status.tone}>{status.label}</StatusChip> : null}</header>
    <div className="order-summary__identifier"><span>Mã đơn hàng</span>{order.orderNumber ? <CopyableId value={order.orderNumber} copyLabel="Sao chép mã đơn" /> : <span>Chưa có thông tin</span>}</div>
    <FactList facts={facts} />
    {order.orderStatus === 'WAITING_PAYMENT' && order.paymentDueAt ? <PaymentCountdown dueAt={order.paymentDueAt} /> : null}
    <div className="order-summary__package">
      <h3>{order.productName || 'Chưa có tên sản phẩm'}</h3>
      <p>{order.planName || 'Chưa có tên gói'}</p>
      <dl className="order-summary__configuration">
        <div><dt>Số thiết bị</dt><dd>{order.maxActiveDevices != null ? `${order.maxActiveDevices} thiết bị` : 'Chưa có thông tin'}</dd></div>
        <div><dt>Thời hạn</dt><dd>{order.durationMonths ? `${order.durationMonths} tháng` : billingCycleLabels[order.billingCycle ?? ''] ?? 'Chưa có thông tin'}</dd></div>
        <div><dt>Thành tiền</dt><dd>{formatMoney(order.total)}</dd></div>
      </dl>
    </div>
    <OrderEntitlements entitlements={order.entitlements} />
    <footer className="order-summary__total"><span>Tổng thanh toán</span><strong>{formatMoney(order.total)}</strong></footer>
  </section>;
}
