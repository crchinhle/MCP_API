import { PageLoading } from '../components/WorkspacePrimitives';
import { Button, Result, Select } from 'antd';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useOptionalAuth } from '../../application/auth/authContext';
import { PurchaseFlowModal } from '../components/PurchaseFlowModal';

import {
  formatVnd,
  useProduct,
} from '../../application/catalog/catalogQueries';
import { ProductArtwork } from '../components/ProductArtwork';
import { SiteHeader } from '../components/SiteHeader';

export function ProductDetailScreen({ authenticated = false }: { readonly authenticated?: boolean }) {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const auth = useOptionalAuth();
  const { data: product, isLoading, isError } = useProduct(slug);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const defaultPlan = product?.plans[0];
  const selectedPlan =
    product?.plans.find((plan) => plan.id === selectedPlanId) ?? defaultPlan;

  if (isLoading) return <div className="page-shell">{!authenticated ? <SiteHeader /> : null}<PageLoading /></div>;
  if (isError) {
    return (
      <Result
        extra={<Button href="/products">Về danh mục</Button>}
        status="error"
        title="Không thể tải sản phẩm"
        subTitle="Danh mục public đang tạm thời không khả dụng."
      />
    );
  }
  if (!product) {
    return (
      <Result
        extra={<Button href="/products">Về danh mục</Button>}
        status="404"
        title="Sản phẩm chưa được công bố"
        subTitle="Sản phẩm có thể đang ở trạng thái nháp, đã lưu trữ hoặc chưa có gói public hợp lệ."
      />
    );
  }
  if (!selectedPlan) {
    return (
      <Result
        extra={<Button href="/products">Về danh mục</Button>}
        status="info"
        title="Sản phẩm chưa có gói được công bố"
      />
    );
  }

  return (
    <div className="page-shell">
        {!authenticated ? <SiteHeader /> : null}
      <main className="detail-content">
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link to={authenticated ? '/buyer/products' : '/products'}>Sản phẩm</Link>
          <span>/</span>
          <span>{product.name}</span>
        </nav>

        <section className="product-hero">
          <ProductArtwork imageUrl={product.imageUrl} large productName={product.name} tone={product.tone} />
          <div className="product-summary">
            <h1>{product.name}</h1>
            <p>{product.summary}</p>
          </div>
        </section>

        <section className="detail-lower">
          <article className="pricing-card">
            <h2>Chọn gói bản quyền</h2>
            <p>Kiểm tra giá, thời hạn và số thiết bị trước khi mua. Bạn sẽ được đọc điều khoản của đơn hàng trước khi thanh toán.</p>
            <label>
              <span>Gói</span>
              <Select
                aria-label="Gói"
                options={product.plans.map((plan) => ({
                  value: plan.id,
                  label: `${plan.label} · ${formatVnd(plan.priceVnd)}`,
                }))}
                value={selectedPlan.id}
                onChange={setSelectedPlanId}
              />
            </label>
            <div className="plan-summary">
              <strong>{selectedPlan.label}</strong>
              <p>{formatVnd(selectedPlan.priceVnd)}</p>
              <p>Tối đa {selectedPlan.devices} thiết bị</p>
              <p>Thời hạn: {selectedPlan.durationMonths ? `${selectedPlan.durationMonths} tháng` : 'Chưa có thông tin'}</p>
              {selectedPlan.entitlements ? <p>Quyền lợi: {Object.entries(selectedPlan.entitlements).filter(([, value]) => Boolean(value)).map(([key, value]) => `${key === 'desktop' ? 'Ứng dụng máy tính' : key}${value === true ? '' : `: ${String(value)}`}`).join(', ') || 'Không có quyền lợi bổ sung'}</p> : null}
            </div>
            <div className="plan-actions">
              <Button
                onClick={() => void navigate(
                  `/compare?ids=${encodeURIComponent(product.plans.slice(0, 4).map((plan) => plan.id).join(','))}`,
                )}
              >
                So sánh gói
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  if (!authenticated && !auth?.user) {
                    const checkout = `/buyer/checkout?product=${encodeURIComponent(product.slug)}&planId=${encodeURIComponent(selectedPlan.id)}`;
                    void navigate(`/auth?mode=login&redirect=${encodeURIComponent(checkout)}`);
                    return;
                  }
                  setPurchaseOpen(true);
                }}
              >
                Mua ngay
              </Button>
            </div>
          </article>
        </section>
      </main>
      {auth?.user || !authenticated ? (
        <PurchaseFlowModal
          initialPlanId={selectedPlan.id}
          onClose={() => setPurchaseOpen(false)}
          open={purchaseOpen}
          product={product}
        />
      ) : null}
    </div>
  );
}
