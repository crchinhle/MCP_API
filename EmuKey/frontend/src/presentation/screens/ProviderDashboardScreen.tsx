import { Alert, Empty, Spin } from 'antd';
import { Link } from 'react-router-dom';

import { useAdminPlans, useAdminProducts } from '../../application/catalog/catalogQueries';
import { usePaymentHistory } from '../../application/orders/orderQueries';
import { useProviderLicenses } from '../../application/licenses/licenseQueries';
import { PageHeader } from '../components/WorkspacePrimitives';

export function ProviderDashboardScreen() {
  const products = useAdminProducts();
  const plans = useAdminPlans();
  const payments = usePaymentHistory();
  const licenses = useProviderLicenses();
  const loading = products.isLoading || plans.isLoading || payments.isLoading || licenses.isLoading;
  const error = products.error ?? plans.error ?? payments.error ?? licenses.error;
  return (
    <div className="provider-dashboard-screen">
      <PageHeader
        title="Tổng quan nhà cung cấp"
      />
      {loading ? <Spin aria-label="Đang tải tổng quan Provider" /> : null}
      {error ? <Alert showIcon type="error" message="Không thể tải tổng quan Provider." /> : null}
      <section className="metric-grid metric-grid--four">
        <article className="metric-card"><span className="status-chip status-chip--neutral">Sản phẩm</span><strong>{products.data?.length ?? '—'}</strong><small>Danh mục doanh nghiệp</small></article>
        <article className="metric-card"><span className="status-chip status-chip--neutral">Gói bản quyền</span><strong>{plans.data?.length ?? '—'}</strong><small>Bản nháp và đã công bố</small></article>
        <article className="metric-card"><span className="status-chip status-chip--commerce">Thanh toán</span><strong>{payments.data?.length ?? '—'}</strong><small>Lịch sử đã tải</small></article>
        <article className="metric-card"><span className="status-chip status-chip--success">Bản quyền</span><strong>{licenses.data?.length ?? '—'}</strong><small>Bản quyền đã cấp</small></article>
      </section>
      <section className="workspace-card section-card">
        <h2>Việc cần theo dõi</h2>
        {!loading && !error && !products.data?.length && !plans.data?.length ? <Empty description="Chưa có sản phẩm hoặc gói trong danh mục." /> : <p className="muted-copy">Kiểm tra sản phẩm nháp, theo dõi thanh toán và quản lý các bản quyền đã cấp từ menu bên cạnh.</p>}
        <Link className="primary-link" to="/provider/catalog">Quản lý danh mục</Link>
      </section>
    </div>
  );
}
