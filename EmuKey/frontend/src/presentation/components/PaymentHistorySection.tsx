import { paginationTextControls } from '../theme';
import { Alert, Button, DatePicker, Descriptions, Drawer, Empty, Input, Select, Table } from 'antd';
import { useLayoutEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { paymentNeedsReview, usePaymentHistory, usePaymentReviews } from '../../application/orders/orderQueries';
import type { PaymentHistoryDto } from '../../infrastructure/api/generated';
import {
  PageLoading,
  paymentClassificationLabels,
  paymentClassificationTone,
  paymentReviewLabels,
  StatusChip,
} from './WorkspacePrimitives';

function formatPaymentTime(value: string) {
  return Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN') : 'Chưa xác định';
}

export interface PaymentHistorySectionProps {
  readonly emptyDescription?: string | undefined;
  readonly introCopy?: string | undefined;
  readonly isSystem?: boolean;
}

export function PaymentHistorySection({
  emptyDescription,
  introCopy,
  isSystem = false,
}: PaymentHistorySectionProps) {
  const payments = usePaymentHistory();
  const reviews = usePaymentReviews(isSystem);
  const [query, setQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedClassification = searchParams.get('classification') ?? '';
  const classification =
    requestedClassification === 'exceptions' || Object.hasOwn(paymentClassificationLabels, requestedClassification)
      ? requestedClassification
      : '';
  const setClassification = (value: string) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set('classification', value);
        else next.delete('classification');
        return next;
      },
      { replace: true },
    );
  const [manualSelected, setManualSelected] = useState<PaymentHistoryDto | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const normalized = query.trim().toLocaleLowerCase('vi');
  const requestedTransactionId = searchParams.get('transactionId') ?? '';

  useLayoutEffect(() => {
    if (requestedTransactionId) setManualSelected(null);
  }, [requestedTransactionId]);

  const visiblePayments = useMemo(
    () =>
      (payments.data ?? []).filter(
        (payment) =>
          (!classification ||
            (classification === 'exceptions'
              ? paymentNeedsReview(payment)
              : payment.classification === classification)) &&
          (!range ||
            (new Date(payment.providerOccurredAt).getTime() >= range[0] &&
              new Date(payment.providerOccurredAt).getTime() <= range[1])) &&
          `${payment.orderNumber ?? ''} ${payment.productNameSnapshot ?? ''} ${payment.planNameSnapshot ?? ''} ${payment.providerTransactionReference ?? ''} ${payment.providerEventId} ${payment.transactionId} ${payment.classification} ${payment.reviewStatus ?? ''}`
            .toLocaleLowerCase('vi')
            .includes(normalized),
      ),
    [normalized, payments.data, classification, range],
  );

  const ownedByReview = Boolean(
    isSystem &&
      requestedTransactionId &&
      (reviews.isLoading || reviews.data?.some((row) => row.id === requestedTransactionId)),
  );
  const selected = requestedTransactionId
    ? ownedByReview
      ? null
      : (payments.data ?? []).find((item) => item.transactionId === requestedTransactionId) ?? null
    : manualSelected;

  if (payments.isLoading && !isSystem) return <PageLoading />;

  const closeDrawer = () => {
    setManualSelected(null);
    if (searchParams.has('transactionId')) {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.delete('transactionId');
          return next;
        },
        { replace: true },
      );
    }
  };

  return (
    <>
      <div className="inline-filter">
        <Input.Search
          aria-label="Tìm dữ liệu vận hành"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm mã đơn, sản phẩm hoặc giao dịch"
          value={query}
        />
        <Select
          aria-label="Lọc kết quả đối soát"
          value={classification}
          onChange={setClassification}
          options={[
            { value: '', label: 'Tất cả giao dịch' },
            { value: 'exceptions', label: 'Giao dịch cần kiểm tra' },
            ...Object.entries(paymentClassificationLabels).map(([value, label]) => ({ value, label })),
          ]}
        />
        <DatePicker.RangePicker
          {...(isSystem ? { placeholder: ['Từ ngày', 'Đến ngày'] as [string, string] } : {})}
          prevIcon="−"
          nextIcon="+"
          superPrevIcon="−−"
          superNextIcon="++"
          aria-label="Lọc khoảng thời gian"
          format="DD/MM/YYYY"
          onChange={(values) =>
            setRange(
              values?.[0] && values[1]
                ? [values[0].startOf('day').valueOf(), values[1].endOf('day').valueOf()]
                : null,
            )
          }
        />
      </div>
      <section className="workspace-card operations-card">
        {introCopy ? <p className="muted-copy">{introCopy}</p> : null}
        {payments.isError ? (
          <Alert
            showIcon
            type="error"
            title="Không thể tải lịch sử thanh toán."
            action={<Button onClick={() => void payments.refetch()}>Thử lại</Button>}
          />
        ) : null}
        {payments.isLoading && isSystem ? <p role="status">Đang tải lịch sử thanh toán…</p> : null}
        {!payments.isLoading && !payments.isError && visiblePayments.length === 0 ? (
          <Empty
            description={
              emptyDescription ??
              (isSystem && !query && !classification && !range
                ? 'Chưa có giao dịch thanh toán.'
                : 'Không có giao dịch đối soát phù hợp.')
            }
          />
        ) : null}
        {!payments.isError && visiblePayments.length > 0 ? (
          <Table<PaymentHistoryDto>
            rowKey="transactionId"
            dataSource={visiblePayments}
            scroll={{ x: 900 }}
            pagination={{ ...paginationTextControls, pageSize: 10, showSizeChanger: false }}
            columns={[
              {
                title: 'Đơn hàng',
                render: (_, item) => (
                  <>
                    <strong>{item.orderNumber ?? 'Chưa gắn đơn'}</strong>
                    <small>{item.orderType === 'RENEWAL' ? 'Gia hạn' : item.orderType === 'NEW_PURCHASE' ? 'Mua mới' : ''}</small>
                  </>
                ),
              },
              {
                title: 'Sản phẩm / gói',
                render: (_, item) => (
                  <>
                    {item.productNameSnapshot ?? 'Chưa xác định'}
                    <small>{item.planNameSnapshot ?? ''}</small>
                  </>
                ),
              },
              {
                title: 'Số tiền',
                align: 'right',
                dataIndex: 'amountVnd',
                render: (value: number) => `${value.toLocaleString('vi-VN')} ₫`,
              },
              { title: 'Thời gian', dataIndex: 'providerOccurredAt', render: formatPaymentTime },
              {
                title: 'Đối soát',
                dataIndex: 'classification',
                render: (value: string) => (
                  <StatusChip tone={paymentClassificationTone(value)}>
                    {paymentClassificationLabels[value] ?? value}
                  </StatusChip>
                ),
              },
              {
                title: 'Chi tiết',
                render: (_, item) => (
                  <Button
                    onClick={() => {
                      if (requestedTransactionId) {
                        setSearchParams(
                          (previous) => {
                            const next = new URLSearchParams(previous);
                            next.set('transactionId', item.transactionId);
                            return next;
                          },
                          { replace: true },
                        );
                      } else {
                        setManualSelected(item);
                      }
                    }}
                  >
                    Xem
                  </Button>
                ),
              },
            ]}
          />
        ) : null}
      </section>
      <Drawer
        title="Chi tiết giao dịch"
        size={500}
        className="provider-payment-drawer"
        open={Boolean(selected)}
        onClose={closeDrawer}
      >
        {selected ? (
          <>
            <h2>Đơn hàng</h2>
            <Descriptions
              column={1}
              items={[
                { key: 'order', label: 'Mã đơn', children: selected.orderNumber ?? 'Chưa gắn đơn' },
                { key: 'product', label: 'Sản phẩm', children: selected.productNameSnapshot ?? 'Chưa xác định' },
                { key: 'plan', label: 'Gói', children: selected.planNameSnapshot ?? 'Chưa xác định' },
              ]}
            />
            <h2>Thanh toán</h2>
            <Descriptions
              column={1}
              items={[
                { key: 'amount', label: 'Số tiền', children: `${selected.amountVnd.toLocaleString('vi-VN')} ₫` },
                { key: 'ref', label: 'Mã giao dịch', children: selected.providerTransactionReference ?? 'Không có' },
                { key: 'event', label: 'Mã sự kiện', children: selected.providerEventId },
                { key: 'occurred', label: 'Thời gian SePay', children: formatPaymentTime(selected.providerOccurredAt) },
                { key: 'received', label: 'Thời gian tiếp nhận', children: formatPaymentTime(selected.receivedAt) },
              ]}
            />
            <h2>Kết quả đối soát</h2>
            <StatusChip tone={paymentClassificationTone(selected.classification)}>
              {paymentClassificationLabels[selected.classification] ?? selected.classification}
            </StatusChip>
            {selected.reviewStatus ? (
              <p>Trạng thái kiểm tra: {paymentReviewLabels[selected.reviewStatus] ?? selected.reviewStatus}</p>
            ) : null}
          </>
        ) : null}
      </Drawer>
    </>
  );
}
