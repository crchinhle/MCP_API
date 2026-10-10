import { Alert, Button, Result } from 'antd';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useProduct } from '../../application/catalog/catalogQueries';
import { readCheckoutIntent } from '../../application/orders/checkoutIntent';
import { useAuth } from '../../application/auth/authContext';
import { PurchaseFlowModal } from '../components/PurchaseFlowModal';
import { PageLoading } from '../components/WorkspacePrimitives';

export function BuyerCheckoutScreen() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const productSlug = searchParams.get('product') ?? 'securedesk';
  const requestedPlanId = searchParams.get('planId') ?? undefined;
  const requestedOrderId = searchParams.get('orderId') ?? undefined;
  const intent = readCheckoutIntent(user?.id);
  const { data: product, isLoading, isError } = useProduct(productSlug);
  const [open, setOpen] = useState(true);

  if (isLoading) return <PageLoading />;
  if (isError) {
    return <Result status="error" title="Không thể tải gói giá" subTitle="Danh mục đang tạm thời không khả dụng." />;
  }
  if (!product) {
    return <Result status="info" title="Sản phẩm chưa sẵn sàng" subTitle="Sản phẩm chưa được công bố hoặc đã thay đổi. Quay lại danh mục để chọn sản phẩm khác." />;
  }

  const matchingIntent = intent?.productSlug === productSlug
    && (!requestedPlanId || intent.planId === requestedPlanId)
    ? intent
    : undefined;
  const resumableOrderId = requestedOrderId ?? matchingIntent?.orderId;
  const planId = requestedPlanId
    ?? (resumableOrderId ? matchingIntent?.planId : undefined)
    ?? (product.plans.length === 1 ? product.plans[0]?.id : undefined);

  return (
    <main className="workspace-screen">
      <h1>Hoàn tất mua bản quyền</h1>
      <Alert
        showIcon
        type="info"
        title="Quy trình mua bản quyền"
        description="Đơn hàng chỉ được tạo sau khi bạn xác nhận cấu hình. Các đơn hiện có vẫn được giữ để tiếp tục."
      />
      <div className="workspace-actions">
        {!open ? <Button type="primary" onClick={() => setOpen(true)}>{resumableOrderId ? 'Tiếp tục đơn hàng' : 'Tiếp tục mua'}</Button> : null}
        <Button href={`/buyer/products/${encodeURIComponent(productSlug)}`}>Quay lại sản phẩm</Button>
      </div>
      <PurchaseFlowModal
        {...(planId ? { initialPlanId: planId } : {})}
        onClose={() => setOpen(false)}
        open={open}
        product={product}
        {...(resumableOrderId ? { resumeOrderId: resumableOrderId } : {})}
      />
    </main>
  );
}
