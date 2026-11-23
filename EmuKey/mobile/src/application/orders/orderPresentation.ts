import type { MobileOrderDetail, MobileOrderSummary } from '../../infrastructure/api/client';
import type { SemanticTone } from '../../presentation/theme/tokens';

export function orderStatusLabel(status: string): string {
  switch (status) {
    case 'WAITING_SERVICE_TERMS_ACCEPTANCE':
      return 'Chờ đồng ý điều khoản';
    case 'WAITING_PAYMENT':
      return 'Chờ thanh toán';
    case 'PAYMENT_ACCEPTED':
      return 'Đã nhận thanh toán';
    case 'CANCELLED':
      return 'Đã hủy';
    case 'EXPIRED':
      return 'Đã hết hạn';
    default:
      return 'Chưa xác định';
  }
}

export function orderStatusTone(status: string): SemanticTone {
  switch (status) {
    case 'PAYMENT_ACCEPTED':
      return 'success';
    case 'WAITING_PAYMENT':
      return 'warning';
    case 'WAITING_SERVICE_TERMS_ACCEPTANCE':
      return 'info';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'error';
    default:
      return 'neutral';
  }
}

export function canCancelOrder(order: Pick<MobileOrderSummary, 'orderStatus'>): boolean {
  return (
    order.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE' ||
    order.orderStatus === 'WAITING_PAYMENT'
  );
}

export interface OrderPrimaryAction {
  readonly kind: 'terms' | 'payment' | 'detail';
  readonly label: string;
}

export function selectOrderPrimaryAction(
  order: Pick<MobileOrderDetail, 'orderStatus'>,
): OrderPrimaryAction {
  if (order.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE') {
    return { kind: 'terms', label: 'Đồng ý điều khoản' };
  }
  if (order.orderStatus === 'WAITING_PAYMENT') {
    return { kind: 'payment', label: 'Thanh toán' };
  }
  return { kind: 'detail', label: 'Xem chi tiết' };
}

const entitlementLabels: Record<string, string> = {
  desktop: 'Ứng dụng máy tính',
  desktopApp: 'Ứng dụng máy tính',
  analytics: 'Báo cáo và phân tích',
  cloudSync: 'Đồng bộ dữ liệu đám mây',
  prioritySupport: 'Hỗ trợ ưu tiên',
};

export function paymentClassificationLabel(classification: string): string {
  switch (classification) {
    case 'MATCHED':
      return 'Đã khớp';
    case 'DUPLICATE':
      return 'Giao dịch trùng';
    case 'UNMATCHED':
      return 'Chưa khớp đơn hàng';
    case 'AMOUNT_MISMATCH':
      return 'Số tiền không khớp';
    case 'INVALID':
      return 'Không hợp lệ';
    default:
      return classification || 'Chưa xác định';
  }
}

export function paymentClassificationTone(classification: string): SemanticTone {
  switch (classification) {
    case 'MATCHED':
      return 'success';
    case 'AMOUNT_MISMATCH':
    case 'INVALID':
      return 'error';
    case 'DUPLICATE':
    case 'UNMATCHED':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function paymentReviewLabel(reviewStatus: string | null | undefined): string | null {
  if (!reviewStatus) return null;
  switch (reviewStatus) {
    case 'OPEN':
      return 'Chờ kiểm tra';
    case 'RESOLVED':
      return 'Đã giải quyết';
    case 'CLOSED_NO_ACTION':
      return 'Đã đóng, không cần xử lý';
    default:
      return reviewStatus;
  }
}

export function formatEntitlementsList(
  entitlements: Readonly<Record<string, unknown>> | undefined | null,
): { key: string; label: string; included: boolean; detail: string }[] {
  if (!entitlements) return [];
  return Object.entries(entitlements)
    .filter(([key]) => Object.hasOwn(entitlementLabels, key))
    .map(([key, value]) => {
      const baseLabel = entitlementLabels[key] ?? key;
      if (value === true) {
        return { key, label: baseLabel, included: true, detail: 'Bao gồm' };
      }
      if (value === false) {
        return { key, label: baseLabel, included: false, detail: 'Không bao gồm' };
      }
      return { key, label: baseLabel, included: false, detail: 'Chưa có thông tin' };
    });
}
