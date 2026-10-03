import { Alert, Button, Input, Modal, Select, Table } from 'antd';
import { useState } from 'react';
import { usePaymentReviews, useReviewPayment } from '../../application/orders/orderQueries';
import type { PaymentReviewDto, ReviewPaymentDto } from '../../infrastructure/api/generated';

export function PaymentReviewPanel() {
  const reviews = usePaymentReviews();
  const review = useReviewPayment();
  const [selected, setSelected] = useState<PaymentReviewDto>();
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<ReviewPaymentDto['status']>('RESOLVED');
  return <section aria-label="Xử lý thanh toán cần kiểm tra">
    <h2>Thanh toán cần kiểm tra</h2>
    <p>Ghi nhận kết quả kiểm tra chứng từ. Thao tác này không tự hoàn tiền, nhận thanh toán hoặc cấp bản quyền.</p>
    {reviews.isError ? <Alert type="error" title="Không thể tải giao dịch cần kiểm tra" action={<Button onClick={() => void reviews.refetch()}>Thử lại</Button>} /> : null}
    <Table rowKey="id" loading={reviews.isPending} dataSource={reviews.data ?? []} scroll={{ x: 700 }} columns={[
      { title: 'Sự kiện', dataIndex: 'providerEventId' },
      { title: 'Phân loại', dataIndex: 'classification' },
      { title: 'Số tiền', dataIndex: 'amountVnd', render: (value: number) => `${value.toLocaleString('vi-VN')} ₫` },
      { title: 'Trạng thái kiểm tra', dataIndex: 'reviewStatus', render: (value: string | null) => value ?? 'Chưa xử lý' },
      { title: 'Thao tác', render: (_: unknown, row: PaymentReviewDto) => <Button disabled={row.reviewStatus === 'RESOLVED' || row.reviewStatus === 'CLOSED_NO_ACTION'} onClick={() => { setSelected(row); setReason(''); setStatus('RESOLVED'); review.reset(); }}>Kiểm tra giao dịch</Button> },
    ]} />
    <Modal open={Boolean(selected)} title="Xác nhận kết quả kiểm tra" okText="Lưu kết quả" cancelText="Hủy" confirmLoading={review.isPending} okButtonProps={{ disabled: reason.trim().length < 3 }} onCancel={() => { if (!review.isPending) setSelected(undefined); }} onOk={() => { if (selected && reason.trim().length >= 3) review.mutate({ id: selected.id, input: { status, reason: reason.trim() } }, { onSuccess: () => setSelected(undefined) }); }}>
      <p>{selected?.providerEventId} · {selected?.providerTransactionReference ?? 'Không có mã giao dịch'}</p>
      <Select aria-label="Kết quả kiểm tra thanh toán" value={status} onChange={setStatus} options={[{ value: 'RESOLVED', label: 'Đã giải quyết' }, { value: 'CLOSED_NO_ACTION', label: 'Đóng, không cần xử lý' }]} />
      <Input.TextArea aria-label="Lý do xử lý thanh toán" placeholder="Ghi lý do và bằng chứng kiểm tra (ít nhất 3 ký tự)" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      {review.isError ? <Alert type="error" title="Không thể lưu kết quả. Kiểm tra giao dịch và thử lại." /> : null}
    </Modal>
    {review.isSuccess ? <Alert type="success" title="Đã lưu kết quả kiểm tra." /> : null}
  </section>;
}
