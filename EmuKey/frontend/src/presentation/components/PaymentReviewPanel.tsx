import { Alert, Button, Drawer, Form, Input, Modal, Select, Skeleton, Table } from 'antd';
import { useState } from 'react';
import { usePaymentReviews, useReviewPayment } from '../../application/orders/orderQueries';
import type { PaymentReviewDto, ReviewPaymentDto } from '../../infrastructure/api/generated';
import { paginationTextControls } from '../theme';
import { FactList, formatMoney, paymentClassificationLabels, paymentReviewLabels } from './WorkspacePrimitives';

export function PaymentReviewPanel() {
  const reviews = usePaymentReviews();
  const review = useReviewPayment();
  const [selectedId, setSelectedId] = useState<string>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<ReviewPaymentDto['status']>('RESOLVED');
  const selected = reviews.data?.find((row) => row.id === selectedId);
  const open = reviews.data?.filter((row) => row.reviewStatus === 'OPEN') ?? [];
  const closed = reviews.data?.filter((row) => row.reviewStatus === 'RESOLVED' || row.reviewStatus === 'CLOSED_NO_ACTION') ?? [];
  const time = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN') : 'Chưa xác định';
  const columns = [
    { title: 'Giao dịch / đơn hàng', render: (_: unknown, row: PaymentReviewDto) => <><strong>{row.orderNumber ?? row.providerEventId}</strong><small>{row.providerTransactionReference ?? 'Chưa có mã giao dịch'}</small></> },
    { title: 'Phân loại', dataIndex: 'classification', render: (value: string) => paymentClassificationLabels[value] ?? 'Chưa xác định' },
    { title: 'Số tiền', dataIndex: 'amountVnd', render: formatMoney },
    { title: 'Thời gian', dataIndex: 'receivedAt', render: time },
    { title: 'Rà soát', dataIndex: 'reviewStatus', render: (value: string) => paymentReviewLabels[value] ?? 'Chưa xác định' },
    { title: 'Thao tác', render: (_: unknown, row: PaymentReviewDto) => <Button onClick={() => { setSelectedId(row.id); review.reset(); }}>{row.reviewStatus === 'OPEN' ? 'Kiểm tra giao dịch' : 'Xem chi tiết rà soát'}</Button> },
  ];
  return <section aria-label="Xử lý thanh toán cần kiểm tra" className="workspace-card system-section">
    <div className="section-heading"><h2>Thanh toán cần kiểm tra</h2><Button onClick={() => setHistoryOpen((value) => !value)} aria-expanded={historyOpen}>Lịch sử rà soát</Button></div>
    {reviews.isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : reviews.isError ? <Alert type="error" title="Không thể tải giao dịch cần kiểm tra" action={<Button loading={reviews.isFetching} onClick={() => void reviews.refetch()}>Thử lại</Button>} /> : <>
      {open.length ? <Table<PaymentReviewDto> pagination={{ ...paginationTextControls, pageSize: 5, showSizeChanger: false }} rowKey="id" dataSource={open} scroll={{ x: 900 }} columns={columns} /> : <p className="system-inline-state" role="status">Không có giao dịch cần kiểm tra</p>}
      {historyOpen ? <><h3>Kết quả rà soát đã lưu</h3><Table<PaymentReviewDto> rowKey="id" dataSource={closed} columns={columns} scroll={{ x: 900 }} pagination={{ ...paginationTextControls, pageSize: 5 }} locale={{ emptyText: 'Chưa có kết quả rà soát đã lưu.' }} /></> : null}
    </>}
    {review.isSuccess ? <p role="status">Đã lưu kết quả kiểm tra.</p> : null}
    <Drawer className="system-drawer" title="Chi tiết rà soát thanh toán" size={560} open={Boolean(selectedId)} onClose={() => setSelectedId(undefined)}>
      {selected ? <><FactList facts={[
        { label: 'Mã đơn', value: selected.orderNumber ?? 'Chưa gắn đơn' }, { label: 'Sự kiện', value: selected.providerEventId },
        { label: 'Mã giao dịch', value: selected.providerTransactionReference ?? 'Chưa cung cấp' }, { label: 'Số tiền', value: formatMoney(selected.amountVnd) },
        { label: 'Phân loại', value: paymentClassificationLabels[selected.classification] ?? 'Chưa xác định' }, { label: 'Trạng thái rà soát', value: paymentReviewLabels[selected.reviewStatus ?? ''] ?? 'Chưa xác định' },
        { label: 'Thời gian giao dịch', value: time(selected.providerOccurredAt) }, { label: 'Thời gian tiếp nhận', value: time(selected.receivedAt) },
        { label: 'Thời gian rà soát', value: time(selected.reviewedAt) }, { label: 'Lý do / bằng chứng đã lưu', value: selected.reviewReason ?? 'Chưa ghi nhận' },
      ]} /><p className="muted-copy">Ghi nhận kết quả kiểm tra chứng từ. Thao tác này không tự hoàn tiền, nhận thanh toán hoặc cấp bản quyền.</p>
      {selected.reviewStatus === 'OPEN' ? <Button type="primary" onClick={() => { setReason(''); setStatus('RESOLVED'); review.reset(); setEditing(true); }}>Ghi kết quả kiểm tra</Button> : null}</> : null}
    </Drawer>
    <Modal open={editing && Boolean(selected)} title="Xác nhận kết quả kiểm tra" okText="Lưu kết quả" cancelText="Hủy" confirmLoading={review.isPending} okButtonProps={{ disabled: reason.trim().length < 3 }} onCancel={() => { if (!review.isPending) setEditing(false); }} onOk={() => { if (selected?.reviewStatus === 'OPEN' && reason.trim().length >= 3 && !review.isPending) review.mutate({ id: selected.id, input: { status, reason: reason.trim() } }, { onSuccess: () => { setEditing(false); setSelectedId(undefined); } }); }}>
      <Form layout="vertical">
        <Form.Item label="Kết quả kiểm tra"><Select aria-label="Kết quả kiểm tra thanh toán" value={status} onChange={setStatus} disabled={review.isPending} options={[{ value: 'RESOLVED', label: 'Đã giải quyết' }, { value: 'CLOSED_NO_ACTION', label: 'Đóng, không cần xử lý' }]} /></Form.Item>
        <Form.Item label="Lý do và bằng chứng" required help="Nhập từ 3 đến 1000 ký tự."><Input.TextArea aria-label="Lý do xử lý thanh toán" maxLength={1000} value={reason} disabled={review.isPending} onChange={(event) => setReason(event.target.value)} /></Form.Item>
      </Form>
      {review.isError ? <Alert type="error" title="Không thể lưu kết quả. Kiểm tra giao dịch và thử lại." /> : null}
    </Modal>
  </section>;
}
