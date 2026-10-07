import { Alert, Button, Checkbox, Result, Spin, Steps } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { describeApiError } from '../../application/auth/authContext';
import { useOrder, useOrderMutations, useOrderTerms, useRenewalPreview } from '../../application/orders/orderQueries';
import { OrderSummary } from '../components/OrderSummary';
import { PageLoading, FactList, PageHeader } from '../components/WorkspacePrimitives';

export function BuyerRenewalScreen() {
  const { licenseId = '' } = useParams();
  const navigate = useNavigate();
  const preview = useRenewalPreview(licenseId);
  const mutations = useOrderMutations();
  const [createdOrderId, setCreatedOrderId] = useState('');
  const liveOrder = useOrder(createdOrderId || preview.data?.pendingOrder?.id || '');
  const order = liveOrder.data ?? preview.data?.pendingOrder;
  const waitingTerms = order?.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE';
  const terms = useOrderTerms(waitingTerms ? order.id : '');
  const [accepted, setAccepted] = useState(false);
  useEffect(() => { setAccepted(false); }, [order?.id, terms.data?.version, terms.data?.hash]);

  if (preview.isPending) return <PageLoading />;
  if (preview.isError || !preview.data) return <Result status="error" title="Không thể tải thông tin gia hạn" subTitle="Bản quyền có thể không thuộc tài khoản này hoặc kết nối đang gián đoạn." extra={<Button onClick={() => void preview.refetch()}>Thử lại</Button>} />;
  const offer = preview.data;
  const terminal = order && ['CANCELLED', 'EXPIRED'].includes(order.orderStatus);
  const continuing = order && ['WAITING_PAYMENT', 'PAYMENT_ACCEPTED'].includes(order.orderStatus);
  const requestError = mutations.create.error ?? mutations.acceptServiceTerms.error ?? terms.error ?? liveOrder.error;
  const proceed = () => {
    if (continuing) {
      void navigate(`/buyer/orders/${order.id}/payment`);
    } else if (waitingTerms && accepted) {
      if (!terms.data || terms.isFetching || terms.isError) return;
      mutations.acceptServiceTerms.mutate({ order, terms: terms.data }, { onSuccess: (value) => void navigate(`/buyer/orders/${value.id}/payment`) });
    } else if (!order && offer.canRenew) {
      mutations.create.mutate({ planId: offer.planId, targetLicenseId: licenseId }, {
        onSuccess: (value) => { setCreatedOrderId(value.id); setAccepted(false); },
      });
    }
  };

  return <div className="workspace-screen">
    <PageHeader title="Gia hạn bản quyền" />
    <Steps current={continuing ? 2 : order ? 1 : 0} items={[{ title: 'Thông tin gia hạn' }, { title: 'Điều khoản' }, { title: 'Thanh toán' }]} />
    <div className="checkout-grid">
      <div className="checkout-stack">
        <section className="workspace-card section-card">
          <h2>Thông tin gia hạn</h2>
          <FactList facts={[
            { label: 'Sản phẩm', value: offer.productName },
            { label: 'Gói', value: order?.planNameSnapshot ?? offer.planName },
            { label: 'Thời gian gia hạn', value: `${order?.durationMonthsSnapshot ?? offer.durationMonths} tháng` },
            { label: 'Hết hạn hiện tại', value: new Date(offer.currentExpiresAt).toLocaleDateString('vi-VN') },
            { label: 'Hết hạn dự kiến', value: new Date(offer.estimatedExpiresAt).toLocaleDateString('vi-VN') },
          ]} />
          <p className="muted-copy">Giữ nguyên mã bản quyền và thiết bị đang sử dụng. Bạn không cần nhập mã để gia hạn.</p>
          <p className="muted-copy">Hạn mới dự kiến nếu thanh toán lúc này. Thời gian còn lại được giữ nguyên; bản quyền đã hết hạn sẽ tính từ thời điểm thanh toán hợp lệ. Gia hạn không tự mở lại bản quyền đang tạm ngưng.</p>
        </section>
        {waitingTerms ? <section className="workspace-card section-card">
          <h2>Điều khoản gia hạn</h2>
          {terms.isPending ? <Spin aria-label="Đang tải điều khoản gia hạn" /> : terms.data ? <>
            <pre className="terms-document">{terms.data.content}</pre>
            <Checkbox checked={accepted} onChange={(event) => setAccepted(event.target.checked)}>Tôi đã đọc và đồng ý với điều khoản gia hạn</Checkbox>
          </> : null}
        </section> : null}
        {order && !terminal ? <Alert showIcon type="info" title={order.orderStatus === 'PAYMENT_ACCEPTED' ? 'Đơn gia hạn đã thanh toán. Bạn có thể theo dõi tiến trình, không cần thanh toán lại.' : 'Bạn đang có đơn gia hạn chưa hoàn tất. Tiếp tục đơn này để tránh thanh toán trùng.'} /> : null}
        {terminal ? <Alert showIcon type="warning" title="Đơn gia hạn đã hủy hoặc hết hạn" action={<Button onClick={() => { setCreatedOrderId(''); setAccepted(false); void preview.refetch(); }}>Tải lại thông tin gia hạn</Button>} /> : null}
        {!offer.canRenew && !order ? <Alert showIcon type="warning" title="Bản quyền hoặc gói hiện không hỗ trợ gia hạn. Vui lòng liên hệ hỗ trợ." /> : null}
        {requestError ? <Alert showIcon role="alert" type="error" title={describeApiError(requestError, 'Không thể xử lý gia hạn. Vui lòng thử lại.')} /> : null}
      </div>
      <aside className="checkout-stack">
        <OrderSummary order={{ total: order?.priceVndSnapshot ?? offer.priceVnd }} />
        <p className="muted-copy">{order ? 'Giá đã được lưu cho đơn gia hạn này.' : 'Giá hiện tại của gói. Giá chính thức được xác nhận khi tạo đơn.'}</p>
        <Alert showIcon type="info" title="Hạn sử dụng được cập nhật sau khi thanh toán và giao dịch gia hạn được xác nhận." />
        <div className="workspace-actions">
          <Button onClick={() => void navigate('/buyer/licenses')}>Quay lại</Button>
          <Button type="primary" loading={mutations.create.isPending || mutations.acceptServiceTerms.isPending || (Boolean(createdOrderId) && liveOrder.isPending)}
            disabled={Boolean(terminal) || liveOrder.isError || (waitingTerms ? !accepted || !terms.data || terms.isFetching || terms.isError : !order && !offer.canRenew)} onClick={proceed}>
            {order?.orderStatus === 'PAYMENT_ACCEPTED' ? 'Theo dõi gia hạn' : continuing ? 'Tiếp tục thanh toán' : waitingTerms ? 'Đồng ý và thanh toán' : 'Tạo đơn gia hạn'}
          </Button>
        </div>
      </aside>
    </div>
  </div>;
}
