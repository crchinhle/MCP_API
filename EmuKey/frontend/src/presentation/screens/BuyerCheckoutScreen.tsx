import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Checkbox, Result, Steps } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useProduct } from '../../application/catalog/catalogQueries';
import { describeApiError, useAuth } from '../../application/auth/authContext';
import {
  clearCheckoutIntent,
  readCheckoutIntent,
  writeCheckoutIntent,
} from '../../application/orders/checkoutIntent';
import {
  type OrderDetail,
  useOrder,
  useOrderMutations,
  useOrderTerms,
} from '../../application/orders/orderQueries';
import { OrderSummary } from '../components/OrderSummary';
import { PageLoading, PageHeader } from '../components/WorkspacePrimitives';

export function BuyerCheckoutScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const productSlug = searchParams.get('product') ?? 'securedesk';
  const { data: product, isLoading, isError } = useProduct(productSlug);
  const planId = searchParams.get('planId') ?? product?.plans[0]?.id;
  const existingIntent = readCheckoutIntent(user?.id);
  const [order, setOrder] = useState<OrderDetail>();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orderMutations = useOrderMutations();
  const createOrderMutation = orderMutations.create;
  const resumedOrder = useOrder(existingIntent?.orderId ?? '');
  const termsQuery = useOrderTerms(order?.id ?? '');
  useEffect(() => { setAccepted(false); }, [order?.id, termsQuery.data?.version, termsQuery.data?.hash]);

  useEffect(() => {
    if (resumedOrder.data && existingIntent?.planId === planId) {
      setOrder(resumedOrder.data);
    }
  }, [existingIntent?.planId, planId, resumedOrder.data]);

  function createOrder() {
    if (!planId) return;
    setError(null);
    createOrderMutation.mutate({ planId }, {
      onSuccess: (created) => {
        setOrder(created);
        writeCheckoutIntent(user?.id, { orderId: created.id, planId, productSlug });
      },
    });
  }

  function acceptServiceTerms() {
    if (!accepted || !order || !termsQuery.data || termsQuery.isFetching || termsQuery.isError) {
      setError('Bạn cần đọc và đồng ý điều khoản trước khi tiếp tục.');
      return;
    }
    setError(null);
    orderMutations.acceptServiceTerms.mutate({ order, terms: termsQuery.data }, {
      onSuccess: (acceptedOrder) => {
        clearCheckoutIntent(user?.id);
        void navigate(`/buyer/orders/${acceptedOrder.id}/payment`);
      },
    });
  }

  if (isLoading) return <PageLoading />;
  if (isError)
    return (
      <Result
        status="error"
        title="Không thể tải gói giá"
        subTitle="Danh mục đang tạm thời không khả dụng."
      />
    );
  if (!product || !planId)
    return (
      <Result
        status="info"
        title="Gói chưa sẵn sàng"
        subTitle="Gói này chưa được công bố hoặc đã thay đổi. Quay lại danh mục để chọn gói khác."
      />
    );
  const selectedPlan =
    product.plans.find((plan) => plan.id === planId);
  if (!selectedPlan)
    return <Result status="info" title="Sản phẩm chưa có gói được công bố" />;

  return (
    <div className="workspace-screen">
      <PageHeader
        title="Hoàn tất mua bản quyền"
      />
      <Steps
        current={order ? 1 : 0}
        items={[
          { title: 'Chọn gói' },
          { title: 'Xác nhận' },
          { title: 'Thanh toán' },
        ]}
      />
      <div className="checkout-grid">
        <div className="checkout-stack">
          <Alert
            showIcon
            type="success"
            message="Đơn hàng và bản quyền sẽ được lưu trong tài khoản EmuKey đang đăng nhập."
          />
          <section className="workspace-card section-card">
            <h2>Cấu hình đơn hàng</h2>
            <div className="form-grid checkout-facts">
              <div>
                <span className="fact-label">Gói</span>
                <strong className="readonly-value">{selectedPlan.label}</strong>
              </div>
              <div>
                <span className="fact-label">Số thiết bị tối đa</span>
                <strong className="readonly-value">{selectedPlan.devices} thiết bị</strong>
              </div>
            </div>
          </section>
           <section className="workspace-card section-card">
             {!order ? (
               <>
                 <h2>Xác nhận ý định mua</h2>
                 <p>Kiểm tra gói và tạo đơn hàng khi bạn sẵn sàng. Việc mở trang này chưa tạo đơn hoặc yêu cầu thanh toán.</p>
                 {resumedOrder.isPending && existingIntent ? <LoadingOverlay label="Đang khôi phục đơn hàng" /> : null}
                 {resumedOrder.isError && existingIntent ? <Alert showIcon type="warning" message="Không thể khôi phục đơn hàng trước đó." action={<Button onClick={() => void resumedOrder.refetch()}>Thử lại</Button>} /> : null}
                 {createOrderMutation.isError ? <Alert showIcon type="error" message={describeApiError(createOrderMutation.error, 'Không thể tạo đơn hàng. Vui lòng thử lại.')} /> : null}
                 <><Button type="primary" disabled={createOrderMutation.isPending} onClick={createOrder}>Tạo đơn hàng</Button><LoadingOverlay active={createOrderMutation.isPending} label="Đang xử lý yêu cầu: Tạo đơn hàng" /></>
               </>
             ) : termsQuery.isPending ? (
               <LoadingOverlay label="Đang tải điều khoản" />
             ) : termsQuery.isError || !termsQuery.data ? (
               <Alert
                 showIcon
                 type="error"
                 message="Không thể tải đúng phiên bản điều khoản của đơn hàng."
                 action={<Button onClick={() => void termsQuery.refetch()}>Thử lại</Button>}
               />
             ) : (
               <>
                 <h2>Điều khoản cấp phép</h2>
                 <pre className="terms-document">{termsQuery.data.content}</pre>
                 <p className="muted-copy">Điều khoản này áp dụng riêng cho đơn hàng hiện tại.</p>
                 <Checkbox
                   checked={accepted}
                   onChange={(event) => {
                     setAccepted(event.target.checked);
                     setError(null);
                   }}
                 >
                   Tôi đã đọc và đồng ý với điều khoản cấp phép
                 </Checkbox>
               </>
             )}
             {error || orderMutations.acceptServiceTerms.error || termsQuery.error ? (
               <Alert
                 message={
                   error ??
                   describeApiError(
                     orderMutations.acceptServiceTerms.error ?? termsQuery.error,
                     'Không thể hoàn tất bước đơn hàng và điều khoản. Vui lòng thử lại.',
                   )
                 }
                 role="alert"
                 type="error"
               />
             ) : null}
           </section>
        </div>
        <aside className="checkout-stack">
           <OrderSummary
             order={order ? {
               total: order.priceVndSnapshot,
               productName: order.productNameSnapshot,
               planName: order.planNameSnapshot,
               billingCycle: order.billingCycleSnapshot,
               durationMonths: order.durationMonthsSnapshot,
               maxActiveDevices: order.maxActiveDevicesSnapshot,
               entitlements: order.entitlementsSnapshot,
               orderNumber: order.orderNumber,
             } : { total: selectedPlan.priceVnd }}
           />
          <section className="workspace-card section-card">
            <span className="status-chip status-chip--warning">{order?.paymentDueAt ? `Hạn thanh toán: ${new Date(order.paymentDueAt).toLocaleString('vi-VN')}` : 'Đang chuẩn bị đơn hàng'}</span>
            <p>Quay lại danh mục nếu bạn muốn chọn một gói khác.</p>
          </section>
          <div className="workspace-actions">
            <Button onClick={() => void navigate(`/products/${encodeURIComponent(productSlug)}`)}>
              Quay lại
            </Button>
              <><Button
                type="primary"
                disabled={(!order || !accepted || !termsQuery.data || termsQuery.isFetching || termsQuery.isError) || (createOrderMutation.isPending ||
                orderMutations.acceptServiceTerms.isPending)}

              onClick={acceptServiceTerms}
            >
              Đồng ý và tiếp tục thanh toán
            </Button><LoadingOverlay active={createOrderMutation.isPending ||
                orderMutations.acceptServiceTerms.isPending} label="Đang xử lý yêu cầu: Đồng ý và tiếp tục thanh toán" /></>
          </div>
        </aside>
      </div>
    </div>
  );
}
