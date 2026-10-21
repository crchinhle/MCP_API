import { paginationTextControls } from '../theme';
import { Alert, Button, DatePicker, Descriptions, Drawer, Empty, Input, Select, Table } from 'antd';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { paymentNeedsReview, usePaymentHistory } from '../../application/orders/orderQueries';
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

function formatPaymentTime(value: string) {
  return Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN') : 'Chưa xác định';
}

const reviewStatusLabels: Record<string, string> = { OPEN: 'Chờ kiểm tra', RESOLVED: 'Đã giải quyết', CLOSED_NO_ACTION: 'Đã đóng, không cần xử lý' };

export function ProviderOperationsScreen() {
  const payments = usePaymentHistory();
  const [query, setQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedClassification = searchParams.get('classification') ?? '';
  const classification = requestedClassification === 'exceptions' || Object.hasOwn(paymentClassificationLabels, requestedClassification) ? requestedClassification : '';
  const setClassification = (value: string) => setSearchParams((previous) => {
    const next = new URLSearchParams(previous);
    if (value) next.set('classification', value);
    else next.delete('classification');
    return next;
  }, { replace: true });
  const [selected, setSelected] = useState<PaymentHistoryDto | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const normalized = query.trim().toLocaleLowerCase('vi');
  const visiblePayments = useMemo(
    () => (payments.data ?? []).filter((payment) =>
      (!classification || (classification === 'exceptions' ? paymentNeedsReview(payment) : payment.classification === classification)) &&
      (!range || (new Date(payment.providerOccurredAt).getTime() >= range[0] && new Date(payment.providerOccurredAt).getTime() <= range[1])) &&
      `${payment.orderNumber ?? ''} ${payment.productNameSnapshot ?? ''} ${payment.planNameSnapshot ?? ''} ${payment.providerTransactionReference ?? ''} ${payment.providerEventId} ${payment.transactionId} ${payment.classification} ${payment.reviewStatus ?? ''}`
        .toLocaleLowerCase('vi')
        .includes(normalized)),
    [normalized, payments.data, classification, range],
  );
  if (payments.isLoading) return <PageLoading />;

  return (
    <>
      <PageHeader title="Thanh toán & đối soát" />
      <div className="inline-filter">
        <Input.Search
          aria-label="Tìm dữ liệu vận hành"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm mã đơn, sản phẩm hoặc giao dịch"
          value={query}
        />
        <Select aria-label="Lọc kết quả đối soát" value={classification} onChange={setClassification} options={[{ value: '', label: 'Tất cả giao dịch' }, { value: 'exceptions', label: 'Giao dịch cần kiểm tra' }, ...Object.entries(paymentClassificationLabels).map(([value, label]) => ({ value, label }))]} />
        <DatePicker.RangePicker prevIcon="−" nextIcon="+" superPrevIcon="−−" superNextIcon="++" aria-label="Lọc khoảng thời gian" format="DD/MM/YYYY" onChange={(values) => setRange(values?.[0] && values[1] ? [values[0].startOf('day').valueOf(), values[1].endOf('day').valueOf()] : null)} />
      </div>
      <section className="workspace-card operations-card">
        <p className="muted-copy">Đối chiếu giao dịch theo mã đơn, số tiền và thời gian ghi nhận. Liên hệ bộ phận hỗ trợ khi có giao dịch cần kiểm tra.</p>
        {payments.isError ? <Alert showIcon type="error" title="Không thể tải lịch sử thanh toán." action={<Button onClick={() => void payments.refetch()}>Thử lại</Button>} /> : null}
        {!payments.isError && visiblePayments.length === 0 ? <Empty description="Không có giao dịch đối soát phù hợp." /> : null}
        {!payments.isError && visiblePayments.length > 0 ? <Table<PaymentHistoryDto> rowKey="transactionId" dataSource={visiblePayments} scroll={{ x: 900 }} pagination={{ ...paginationTextControls, pageSize: 10, showSizeChanger: false }} columns={[
          { title: 'Đơn hàng', render: (_, item) => <><strong>{item.orderNumber ?? 'Chưa gắn đơn'}</strong><small>{item.orderType === 'RENEWAL' ? 'Gia hạn' : item.orderType === 'NEW_PURCHASE' ? 'Mua mới' : ''}</small></> },
          { title: 'Sản phẩm / gói', render: (_, item) => <>{item.productNameSnapshot ?? 'Chưa xác định'}<small>{item.planNameSnapshot ?? ''}</small></> },
          { title: 'Số tiền', dataIndex: 'amountVnd', render: (value: number) => `${value.toLocaleString('vi-VN')} ₫` },
          { title: 'Thời gian', dataIndex: 'providerOccurredAt', render: formatPaymentTime },
          { title: 'Đối soát', dataIndex: 'classification', render: (value: string) => <StatusChip tone={paymentClassificationTone(value)}>{paymentClassificationLabels[value] ?? value}</StatusChip> },
          { title: 'Chi tiết', render: (_, item) => <Button onClick={() => setSelected(item)}>Xem</Button> },
        ]} /> : null}
      </section>
      <Drawer title="Chi tiết giao dịch" size={500} className="provider-payment-drawer" open={Boolean(selected)} onClose={() => setSelected(null)}>
        {selected ? <><h2>Đơn hàng</h2><Descriptions column={1} items={[{key:'order',label:'Mã đơn',children:selected.orderNumber ?? 'Chưa gắn đơn'},{key:'product',label:'Sản phẩm',children:selected.productNameSnapshot ?? 'Chưa xác định'},{key:'plan',label:'Gói',children:selected.planNameSnapshot ?? 'Chưa xác định'}]} /><h2>Thanh toán</h2><Descriptions column={1} items={[{key:'amount',label:'Số tiền',children:`${selected.amountVnd.toLocaleString('vi-VN')} ₫`},{key:'ref',label:'Mã giao dịch',children:selected.providerTransactionReference ?? 'Không có'},{key:'event',label:'Mã sự kiện',children:selected.providerEventId},{key:'occurred',label:'Thời gian SePay',children:formatPaymentTime(selected.providerOccurredAt)},{key:'received',label:'Thời gian tiếp nhận',children:formatPaymentTime(selected.receivedAt)}]} /><h2>Kết quả đối soát</h2><StatusChip tone={paymentClassificationTone(selected.classification)}>{paymentClassificationLabels[selected.classification] ?? selected.classification}</StatusChip>{selected.reviewStatus ? <p>Trạng thái kiểm tra: {reviewStatusLabels[selected.reviewStatus] ?? selected.reviewStatus}</p> : null}</> : null}
      </Drawer>
    </>
  );
}
