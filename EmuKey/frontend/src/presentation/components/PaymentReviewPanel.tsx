import { Alert, Button, Drawer, Form, Input, Modal, Select, Skeleton, Table } from 'antd';
import { useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePaymentHistory, usePaymentReviews, useReviewPayment } from '../../application/orders/orderQueries';
import type { PaymentReviewDto, ReviewPaymentDto } from '../../infrastructure/api/generated';
import { paginationTextControls } from '../theme';
import { FactList, formatMoney, ModalFocusBoundary, paymentClassificationLabels, paymentReviewLabels } from './WorkspacePrimitives';

export function PaymentReviewPanel() {
  const reviews = usePaymentReviews();
  const payments = usePaymentHistory();
  const review = useReviewPayment();
  const resetReview = review.reset;
  const [params, setParams] = useSearchParams();
  const urlTransactionId = params.get('transactionId') ?? undefined;
  const [manualSelectedId, setManualSelectedId] = useState<string | undefined>(undefined);
  const activeId = urlTransactionId ?? manualSelectedId;
  const activeReviewId = useRef(activeId);
  const [reviewSaved, setReviewSaved] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState<ReviewPaymentDto['resolution']>('NO_ACTION');
  const [refundReference, setRefundReference] = useState('');
  const [orderId, setOrderId] = useState('');
  const [attemptId, setAttemptId] = useState('');
  useLayoutEffect(() => {
    if (urlTransactionId) setManualSelectedId(undefined);
  }, [urlTransactionId]);

  useLayoutEffect(() => {
    activeReviewId.current = activeId;
    if (activeId) setReviewSaved(false);
    setEditing(false);
    setReason('');
    setResolution('NO_ACTION');
    setRefundReference('');
    setOrderId('');
    setAttemptId('');
    resetReview();
    return () => {
      activeReviewId.current = undefined;
    };
  }, [activeId, resetReview]);
  const selected = reviews.data?.find((row) => row.id === activeId);
  const awaitingSourcesForUrl = Boolean(
    urlTransactionId && !selected && (reviews.isLoading || payments.isLoading),
  );
  const ownedByHistoryOnly = Boolean(
    activeId &&
      activeId === urlTransactionId &&
      !selected &&
      !reviews.isLoading &&
      !payments.isLoading &&
      payments.data?.some((item) => item.transactionId === activeId),
  );
  const drawerOpen = Boolean(activeId) && !awaitingSourcesForUrl && !ownedByHistoryOnly;
  const open = reviews.data?.filter((row) => row.reviewStatus === 'OPEN') ?? [];
  const closed = reviews.data?.filter((row) => row.reviewStatus === 'RESOLVED' || row.reviewStatus === 'CLOSED_NO_ACTION') ?? [];
  const time = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN') : 'Chưa xác định';
  const removeTransactionFromUrl = () => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('transactionId');
      return next;
    }, { replace: true });
  };

  const closeReview = () => {
    setManualSelectedId(undefined);
    setEditing(false);
    resetReview();
    if (urlTransactionId) removeTransactionFromUrl();
  };

  const submitReview = () => {
    if (selected?.reviewStatus !== 'OPEN' || reason.trim().length < 3 || review.isPending) return;
    const input: ReviewPaymentDto = { resolution, reason: reason.trim() };
    if (resolution === 'REFUND_CONFIRMED') {
      input.refundReference = refundReference.trim();
    }
    if (resolution === 'REMATCHED' || resolution === 'ACCEPT_AND_FULFILL') {
      input.orderId = orderId.trim();
      input.paymentAttemptId = attemptId.trim();
    }
    review.mutate({ id: selected.id, input }, {
      onSuccess: (_data, variables) => {
        if (variables.id !== activeReviewId.current) return;
        setReviewSaved(true);
        closeReview();
      },
    });
  };

  const columns = [
    { title: 'Giao dịch / đơn hàng', render: (_: unknown, row: PaymentReviewDto) => <><strong>{row.orderNumber ?? row.providerEventId}</strong><small>{row.providerTransactionReference ?? 'Chưa có mã giao dịch'}</small></> },
    { title: 'Phân loại', dataIndex: 'classification', render: (value: string) => paymentClassificationLabels[value] ?? 'Chưa xác định' },
    { title: 'Số tiền', dataIndex: 'amountVnd', render: formatMoney },
    { title: 'Thời gian', dataIndex: 'receivedAt', render: time },
    { title: 'Rà soát', dataIndex: 'reviewStatus', render: (value: string) => paymentReviewLabels[value] ?? 'Chưa xác định' },
    { title: 'Thao tác', render: (_: unknown, row: PaymentReviewDto) => <Button onClick={() => { if (urlTransactionId) removeTransactionFromUrl(); setManualSelectedId(row.id); resetReview(); }}>{row.reviewStatus === 'OPEN' ? 'Kiểm tra giao dịch' : 'Xem chi tiết rà soát'}</Button> },
  ];
  return <section aria-label="Xử lý thanh toán cần kiểm tra" className="workspace-card system-section">
    <div className="section-heading"><h2>Thanh toán cần kiểm tra</h2><Button onClick={() => setHistoryOpen((value) => !value)} aria-expanded={historyOpen}>Lịch sử rà soát</Button></div>
    {reviews.isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : reviews.isError ? <Alert type="error" title="Không thể tải giao dịch cần kiểm tra" action={<Button loading={reviews.isFetching} onClick={() => void reviews.refetch()}>Thử lại</Button>} /> : <>
      {open.length ? <Table<PaymentReviewDto> pagination={{ ...paginationTextControls, pageSize: 5, showSizeChanger: false }} rowKey="id" dataSource={open} scroll={{ x: 900 }} columns={columns} /> : <p className="system-inline-state" role="status">Không có giao dịch cần kiểm tra</p>}
      {historyOpen ? <><h3>Kết quả rà soát đã lưu</h3><Table<PaymentReviewDto> rowKey="id" dataSource={closed} columns={columns} scroll={{ x: 900 }} pagination={{ ...paginationTextControls, pageSize: 5 }} locale={{ emptyText: 'Chưa có kết quả rà soát đã lưu.' }} /></> : null}
    </>}
    {reviewSaved ? <p role="status">Đã lưu kết quả kiểm tra.</p> : null}
    <Drawer className="system-drawer" title="Chi tiết rà soát thanh toán" size={560} open={drawerOpen} onClose={closeReview}>
      {activeId && !selected && !reviews.isLoading ? <Alert type="warning" title="Không tìm thấy giao dịch hoặc quyền truy cập đã thay đổi." /> : null}
      {selected ? <><FactList facts={[
        { label: 'Mã đơn', value: selected.orderNumber ?? 'Chưa gắn đơn' }, { label: 'Sự kiện', value: selected.providerEventId },
        { label: 'Mã giao dịch', value: selected.providerTransactionReference ?? 'Chưa cung cấp' }, { label: 'Số tiền', value: formatMoney(selected.amountVnd) },
        { label: 'Phân loại', value: paymentClassificationLabels[selected.classification] ?? 'Chưa xác định' }, { label: 'Trạng thái rà soát', value: paymentReviewLabels[selected.reviewStatus ?? ''] ?? 'Chưa xác định' },
        { label: 'Thời gian giao dịch', value: time(selected.providerOccurredAt) }, { label: 'Thời gian tiếp nhận', value: time(selected.receivedAt) },
        { label: 'Thời gian rà soát', value: time(selected.reviewedAt) }, { label: 'Lý do / bằng chứng đã lưu', value: selected.reviewReason ?? 'Chưa ghi nhận' },
      ]} /><p className="muted-copy">Chọn đúng kết quả nghiệp vụ. Xác nhận hoàn tiền chỉ ghi bằng chứng tiền đã hoàn; ghép lại hoặc chấp nhận giao dịch có thể cấp bản quyền khi backend kiểm tra hợp lệ.</p>
      {selected.reviewStatus === 'OPEN' ? <Button type="primary" onClick={() => { setReason(''); setResolution('NO_ACTION'); setRefundReference(''); setOrderId(selected.orderId ?? ''); setAttemptId(''); review.reset(); setEditing(true); }}>Ghi kết quả kiểm tra</Button> : null}</> : null}
    </Drawer>
    <Modal modalRender={(node) => <ModalFocusBoundary>{node}</ModalFocusBoundary>} open={editing && Boolean(selected)} title="Xác nhận kết quả kiểm tra" okText="Lưu kết quả" cancelText="Hủy" confirmLoading={review.isPending} okButtonProps={{ disabled: reason.trim().length < 3 || (resolution === 'REFUND_CONFIRMED' && refundReference.trim().length < 3) || (['REMATCHED','ACCEPT_AND_FULFILL'].includes(resolution) && (!orderId.trim() || !attemptId.trim())) }} onCancel={() => { if (!review.isPending) setEditing(false); }} onOk={submitReview}>
      <Form layout="vertical">
        <Form.Item label="Kết quả kiểm tra"><Select aria-label="Kết quả kiểm tra thanh toán" value={resolution} onChange={setResolution} disabled={review.isPending} options={[{ value: 'NO_ACTION', label: 'Đóng, không thực hiện thêm' }, { value: 'REFUND_CONFIRMED', label: 'Đã xác nhận hoàn tiền' }, ...(['UNMATCHED','INVALID','AMOUNT_MISMATCH'].includes(selected?.classification ?? '') ? [{ value: 'REMATCHED', label: 'Ghép lại đúng đơn và cấp quyền' }] : []), ...(['UNMATCHED','INVALID'].includes(selected?.classification ?? '') ? [{ value: 'ACCEPT_AND_FULFILL', label: 'Chấp nhận và cấp quyền' }] : [])]} /></Form.Item>
        {resolution === 'REFUND_CONFIRMED' ? <Form.Item label="Mã bằng chứng hoàn tiền" required><Input aria-label="Mã bằng chứng hoàn tiền" value={refundReference} onChange={(event) => setRefundReference(event.target.value)} /></Form.Item> : null}
        {['REMATCHED','ACCEPT_AND_FULFILL'].includes(resolution) ? <><Form.Item label="UUID đơn hàng" required><Input aria-label="UUID đơn hàng" value={orderId} onChange={(event) => setOrderId(event.target.value)} /></Form.Item><Form.Item label="UUID lần thanh toán" required><Input aria-label="UUID lần thanh toán" value={attemptId} onChange={(event) => setAttemptId(event.target.value)} /></Form.Item><Alert type="warning" title="Backend chỉ cấp quyền khi số tiền, điều khoản và thời điểm đều hợp lệ. Đơn hết hạn hoặc đã hủy không được mở lại." /></> : null}
        <Form.Item label="Lý do và bằng chứng" required help="Nhập từ 3 đến 1000 ký tự."><Input.TextArea aria-label="Lý do xử lý thanh toán" maxLength={1000} value={reason} disabled={review.isPending} onChange={(event) => setReason(event.target.value)} /></Form.Item>
      </Form>
      {review.isError ? <Alert type="error" title="Không thể lưu kết quả. Kiểm tra giao dịch và thử lại." /> : null}
    </Modal>
  </section>;
}
