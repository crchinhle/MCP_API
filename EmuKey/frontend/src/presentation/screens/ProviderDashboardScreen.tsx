import { Alert, Button, Empty } from 'antd';
import { Link } from 'react-router-dom';

import { useAdminPlans, useAdminProducts } from '../../application/catalog/catalogQueries';
import { usePaymentHistory } from '../../application/orders/orderQueries';
import { useProviderLicenses } from '../../application/licenses/licenseQueries';
import { PageLoading, PageHeader, StatusChip } from '../components/WorkspacePrimitives';

export function ProviderDashboardScreen() {
  const products = useAdminProducts();
  const plans = useAdminPlans();
  const payments = usePaymentHistory();
  const licenses = useProviderLicenses();
  const loading = products.isLoading || plans.isLoading || payments.isLoading || licenses.isLoading;
  const error = products.error ?? plans.error ?? payments.error ?? licenses.error;
  if (loading) return <PageLoading />;
  if (error && (!products.data || !plans.data || !payments.data || !licenses.data)) {
    return <Alert showIcon type="error" message="Không thể tải tổng quan Provider." action={<Button onClick={() => { void products.refetch(); void plans.refetch(); void payments.refetch(); void licenses.refetch(); }}>Thử lại</Button>} />;
  }

  const publishedProducts = (products.data ?? []).filter((product) => product.status === 'PUBLISHED');
  const activeLicenses = (licenses.data ?? []).filter((license) => license.status === 'ACTIVE');
  const pendingLicenses = (licenses.data ?? []).filter((license) => license.status === 'PENDING_ONCHAIN');
  const paymentExceptions = (payments.data ?? []).filter((payment) => payment.classification !== 'MATCHED');
  const draftProducts = (products.data ?? []).filter((product) => product.status === 'DRAFT');
  const attentionItems = [
    ...(pendingLicenses.length ? [{ count: pendingLicenses.length, label: 'bản quyền đang chờ xác nhận', to: '/provider/licenses' }] : []),
    ...(paymentExceptions.length ? [{ count: paymentExceptions.length, label: 'giao dịch cần kiểm tra', to: '/provider/operations' }] : []),
    ...(draftProducts.length ? [{ count: draftProducts.length, label: 'sản phẩm nháp chưa công bố', to: '/provider/catalog' }] : []),
  ];

  return (
    <div className="provider-dashboard-screen">
      <PageHeader
        title="Tổng quan nhà cung cấp"
      />

      {error ? <Alert showIcon type="error" message="Không thể tải tổng quan Provider." /> : null}
      <section className="metric-grid metric-grid--four" aria-label="Chỉ số hoạt động">
        <article className="metric-card"><span className="status-chip status-chip--neutral">Sản phẩm đang bán</span><strong>{publishedProducts.length}</strong><small>Trạng thái PUBLISHED</small></article>
        <article className="metric-card"><span className="status-chip status-chip--success">Bản quyền hoạt động</span><strong>{activeLicenses.length}</strong><small>Trạng thái ACTIVE</small></article>
        <article className="metric-card"><span className="status-chip status-chip--warning">Chờ xác nhận</span><strong>{pendingLicenses.length}</strong><small>Trạng thái PENDING_ONCHAIN</small></article>
        <article className="metric-card"><span className="status-chip status-chip--commerce">Giao dịch cần kiểm tra</span><strong>{paymentExceptions.length}</strong><small>Chưa MATCHED</small></article>
      </section>
      <section className="workspace-card section-card">
        <h2>Cần chú ý</h2>
        {attentionItems.length === 0 ? (
          <Empty description="Không có vấn đề nào cần xử lý." />
        ) : (
          <ul className="provider-attention-list">
            {attentionItems.map((item) => (
              <li key={item.label}>
                <StatusChip tone={item.label.includes('chờ') ? 'warning' : item.label.includes('kiểm tra') ? 'error' : 'info'}>
                  {item.count} {item.label}
                </StatusChip>
                <Link className="primary-link" to={item.to}>Xem chi tiết</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
