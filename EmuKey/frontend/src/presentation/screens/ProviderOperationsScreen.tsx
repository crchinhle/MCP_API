import { Alert, Button, Empty, Input, Tabs } from 'antd';
import { useMemo, useState } from 'react';

import { usePaymentHistory } from '../../application/orders/orderQueries';
import type { PaymentHistoryDto } from '../../infrastructure/api/generated';
import { PageLoading, PageHeader, StatusChip } from '../components/WorkspacePrimitives';

export const paymentClassificationLabels: Record<string, string> = {
  MATCHED: 'Đã khớp',
  DUPLICATE: 'Giao dịch trùng',
  UNMATCHED: 'Chưa khớp đơn hàng',
  AMOUNT_MISMATCH: 'Số tiền không khớp',
  INVALID: 'Không hợp lệ',
};

export function paymentClassificationTone(classification: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (classification === 'MATCHED') return 'success';
  if (classification === 'AMOUNT_MISMATCH' || classification === 'INVALID') return 'error';
  if (classification === 'DUPLICATE' || classification === 'UNMATCHED') return 'warning';
  return 'neutral';
}

export function ProviderOperationsScreen() {
  const payments = usePaymentHistory();
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase('vi');
  const visiblePayments = useMemo(
    () => (payments.data ?? []).filter((payment) =>
      `${payment.orderNumber ?? ''} ${payment.productNameSnapshot ?? ''} ${payment.planNameSnapshot ?? ''} ${payment.providerTransactionReference ?? ''} ${payment.providerEventId} ${payment.transactionId} ${payment.classification} ${payment.reviewStatus ?? ''}`
        .toLocaleLowerCase('vi')
        .includes(normalized)),
    [normalized, payments.data],
  );
  if (payments.isLoading) return <PageLoading />;

  const evidenceList = (reconciliation: boolean) => (
    <PaymentEvidenceList
      payments={visiblePayments}
      error={payments.error}
      isError={payments.isError}
      isFetching={payments.isFetching}
      onRetry={() => void payments.refetch()}
      reconciliation={reconciliation}
    />
  );

  return (
    <>
      <PageHeader title="Vận hành" />
      <div className="inline-filter">
        <Input.Search
          aria-label="Tìm dữ liệu vận hành"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm mã đơn, sản phẩm hoặc giao dịch"
          value={query}
        />
      </div>
      <section className="workspace-card operations-card">
        <Tabs items={[
          { key: 'orders', label: 'Đơn hàng & thanh toán', children: evidenceList(false) },
          {
            key: 'reconcile',
            label: 'Đối soát thanh toán',
            children: <>
              <p className="muted-copy">Giao dịch và dấu thời gian do SePay gửi, cùng kết quả đối chiếu. Tab này chỉ cung cấp thông tin; việc xử lý giao dịch cần kiểm tra thuộc vai trò hỗ trợ hoặc quản trị hệ thống.</p>
              {evidenceList(true)}
            </>,
          },
        ]} />
      </section>
    </>
  );
}

function PaymentEvidenceList({
  payments,
  error,
  isError,
  isFetching,
  onRetry,
  reconciliation = false,
}: {
  readonly payments: PaymentHistoryDto[];
  readonly error: unknown;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly onRetry: () => void;
  readonly reconciliation?: boolean;
}) {
  if (isError) return <Alert showIcon type="error" title="Không thể tải lịch sử thanh toán." action={<Button disabled={isFetching} onClick={onRetry}>Thử lại</Button>} description={error instanceof Error ? error.message : undefined} />;
  if (payments.length === 0) return <Empty description={reconciliation ? 'Không có giao dịch đối chiếu phù hợp.' : 'Chưa có thanh toán phù hợp.'} />;
  return (
    <div className="stack-list">
      {payments.map((payment) => (
        <article key={payment.transactionId}>
          <div>
            <strong>{payment.orderNumber ?? 'Chưa gắn đơn hàng'} · {payment.orderType === 'RENEWAL' ? 'Gia hạn' : payment.orderType === 'NEW_PURCHASE' ? 'Mua mới' : 'Chưa phân loại'}</strong>
            <small>{payment.productNameSnapshot ?? 'Chưa xác định sản phẩm'}{payment.planNameSnapshot ? ` · ${payment.planNameSnapshot}` : ''} · {payment.amountVnd.toLocaleString('vi-VN')} ₫</small>
            <small>Mã giao dịch: {payment.providerTransactionReference ?? 'Không có'} · Sự kiện: {payment.providerEventId}</small>
            <small>Thời gian SePay: {new Date(payment.providerOccurredAt).toLocaleString('vi-VN')} · Tiếp nhận: {new Date(payment.receivedAt).toLocaleString('vi-VN')}</small>
          </div>
          <StatusChip tone={paymentClassificationTone(payment.classification)}>{paymentClassificationLabels[payment.classification] ?? 'Chưa xác định'}</StatusChip>
          {payment.reviewStatus ? <small>Trạng thái kiểm tra: {payment.reviewStatus === 'OPEN' ? 'Đang mở' : 'Đã xử lý'}</small> : null}
          {reconciliation && payment.orderId === null ? <small>Chưa liên kết với đơn hàng; cần đối chiếu bởi bộ phận có thẩm quyền.</small> : null}
        </article>
      ))}
    </div>
  );
}
