import { Alert, Empty, Input, Spin, Tabs } from 'antd';
import { useMemo, useState } from 'react';

import { usePaymentHistory } from '../../application/orders/orderQueries';
import {
  FactList,
  PageHeader,
  StatusChip,
} from '../components/WorkspacePrimitives';

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
  const visibleOrders = useMemo(
    () =>
      (payments.data ?? []).filter((payment) =>
        `${payment.orderNumber} ${payment.productNameSnapshot} ${payment.providerTransactionReference ?? ''}`
          .toLocaleLowerCase('vi')
          .includes(normalized),
      ),
    [normalized, payments.data],
  );
  return (
    <>
      <PageHeader
        title="Vận hành"
      />
      <div className="inline-filter">
        <Input.Search
          aria-label="Tìm dữ liệu vận hành"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm mã đơn, sản phẩm hoặc giao dịch"
          value={query}
        />
      </div>
      <section className="workspace-card operations-card">
        <Tabs
          items={[
            {
              key: 'orders',
              label: 'Đơn hàng & thanh toán',
              children: (
                <div className="stack-list">
                  {payments.isPending ? <Spin aria-label="Đang tải thanh toán" /> : null}
                  {payments.isError ? <Alert showIcon type="error" message="Không thể tải lịch sử thanh toán." /> : null}
                  {!payments.isPending && !payments.isError && visibleOrders.length === 0 ? (
                    <Empty description="Chưa có thanh toán phù hợp." />
                  ) : null}
                  {visibleOrders.map((payment) => (
                    <article key={payment.transactionId}>
                      <div>
                        <strong>
                          {payment.orderNumber} · {payment.orderType === 'RENEWAL' ? 'Gia hạn' : 'Mua mới'}
                        </strong>
                        <small>
                          {payment.productNameSnapshot} · {payment.planNameSnapshot} · {payment.amountVnd.toLocaleString('vi-VN')} ₫
                        </small>
                      </div>
                       <StatusChip tone={paymentClassificationTone(payment.classification)}>
                         {paymentClassificationLabels[payment.classification] ?? 'Chưa xác định'}
                       </StatusChip>
                       {payment.reviewStatus ? <small>Kiểm tra: {payment.reviewStatus === 'OPEN' ? 'Đang mở' : 'Đã xử lý'}</small> : null}
                    </article>
                  ))}
                </div>
              ),
            },
            {
              key: 'reconcile',
              label: 'Đối soát thanh toán',
              children: (
                <FactList
                  facts={[
                    { label: 'Tổng giao dịch', value: String(payments.data?.length ?? 0) },
                    { label: 'Đã khớp', value: String(payments.data?.filter((payment) => payment.classification === 'MATCHED').length ?? 0) },
                    { label: 'Cần kiểm tra', value: String(payments.data?.filter((payment) => payment.classification !== 'MATCHED').length ?? 0) },
                  ]}
                />
              ),
            },
          ]}
        />
      </section>
    </>
  );
}
