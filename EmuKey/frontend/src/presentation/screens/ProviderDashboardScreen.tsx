import { Alert, Button, Empty, Skeleton } from 'antd';
import { Link } from 'react-router-dom';
import { ClockCircleOutlined } from '@ant-design/icons';

import { useAdminProducts } from '../../application/catalog/catalogQueries';
import {
  paymentNeedsReview,
  usePaymentHistory,
} from '../../application/orders/orderQueries';
import {
  providerLicenseDate,
  useProviderLicenses,
} from '../../application/licenses/licenseQueries';
import { PageHeader } from '../components/WorkspacePrimitives';
import {
  ProviderLicenseId,
  ProviderLicenseStatus,
} from '../components/ProviderLicenseSummary';

export function ProviderDashboardScreen() {
  const products = useAdminProducts();
  const payments = usePaymentHistory();
  const licenses = useProviderLicenses();
  const publishedProducts =
    products.data?.filter((product) => product.status === 'PUBLISHED') ?? [];
  const draftProducts =
    products.data?.filter((product) => product.status === 'DRAFT') ?? [];
  // The Provider projection returns raw event finality (CONFIRMED), not the public verification state.
  const activeLicenses =
    licenses.data?.filter(
      (license) =>
        license.status === 'ACTIVE' && license.finality === 'CONFIRMED',
    ) ?? [];
  const pendingLicenses =
    licenses.data?.filter((license) => license.status === 'PENDING_ONCHAIN') ??
    [];
  const paymentExceptions = payments.data?.filter(paymentNeedsReview) ?? [];
  const createdTime = (createdAt: string) =>
    Number.isFinite(Date.parse(createdAt)) ? Date.parse(createdAt) : -Infinity;
  const recentLicenses = [...(licenses.data ?? [])]
    .sort((a, b) => createdTime(b.createdAt) - createdTime(a.createdAt))
    .slice(0, 5);
  const onboarding = products.isSuccess && products.data.length === 0;
  const metrics = [
    {
      label: 'Sản phẩm đã công bố',
      value: publishedProducts.length,
      query: products,
      to: '/provider/catalog?status=PUBLISHED',
      link: 'Xem sản phẩm',
    },
    {
      label: 'Bản quyền có hiệu lực',
      value: activeLicenses.length,
      query: licenses,
      to: '/provider/licenses?status=ACTIVE&finality=CONFIRMED',
      link: 'Xem bản quyền',
    },
    {
      label: 'Đang phát hành',
      value: pendingLicenses.length,
      query: licenses,
      to: '/provider/licenses?status=PENDING_ONCHAIN',
      link: 'Xem tiến độ',
    },
    {
      label: 'Giao dịch cần kiểm tra',
      value: paymentExceptions.length,
      query: payments,
      to: '/provider/operations?classification=exceptions',
      link: 'Xem giao dịch',
    },
  ];

  return (
    <div className="provider-dashboard-screen">
      <PageHeader
        title="Tổng quan nhà cung cấp"
        description="Theo dõi hoạt động và các công việc cần xử lý."
      />
      <section
        className="provider-summary-metrics"
        aria-label="Chỉ số hoạt động"
      >
        {metrics.map(({ label, value, query, to, link }) => (
          <article
            className="metric-card provider-summary-metric"
            key={label}
            aria-label={label}
          >
            <span>{label}</span>
            {query.isPending ? (
              <div
                role="status"
                aria-label={`Đang tải ${label.toLocaleLowerCase('vi')}`}
                aria-busy="true"
              >
                <Skeleton.Input active />
              </div>
            ) : (
              <strong
                aria-label={
                  query.isError ? 'Không tải được dữ liệu' : undefined
                }
              >
                {query.isError ? '—' : value}
              </strong>
            )}
            {query.isError ? (
              <div className="provider-metric-error">
                <span role="alert">Không thể tải dữ liệu.</span>
                <button
                  type="button"
                  className="provider-inline-action"
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                  aria-label={`Thử lại ${label.toLocaleLowerCase('vi')}`}
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <Link to={to}>
                {link} <span aria-hidden="true">→</span>
              </Link>
            )}
          </article>
        ))}
      </section>

      {products.isPending ? (
        <div
          className="workspace-card provider-dashboard-panel provider-dashboard-work-loading"
          role="status"
          aria-label="Đang tải công việc sản phẩm"
          aria-busy="true"
        >
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        </div>
      ) : onboarding ? (
        <section
          className="workspace-card provider-dashboard-empty"
          aria-labelledby="provider-onboarding-title"
        >
          <h2 id="provider-onboarding-title">Bạn chưa có sản phẩm nào</h2>
          <p>Tạo sản phẩm đầu tiên để bắt đầu cấu hình gói bán.</p>
          <Link className="primary-link" to="/provider/catalog?create=product">
            Thêm sản phẩm
          </Link>
        </section>
      ) : products.isSuccess && draftProducts.length > 0 ? (
        <section
          className="workspace-card provider-dashboard-panel"
          aria-labelledby="provider-work-title"
        >
          <h2 id="provider-work-title">Công việc cần hoàn thiện</h2>
          <div className="provider-dashboard-item">
            <div>
              <strong>{draftProducts.length} sản phẩm chưa công bố</strong>
              <p>Hoàn thiện thông tin và gói bán để sẵn sàng công bố.</p>
            </div>
            <Link to="/provider/catalog?status=DRAFT">
              Xem sản phẩm nháp <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ) : null}

      {licenses.isPending ? (
        <div
          className="workspace-card provider-dashboard-progress provider-dashboard-progress--loading"
          role="status"
          aria-label="Đang tải tiến trình phát hành"
          aria-busy="true"
        >
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        </div>
      ) : licenses.isSuccess && pendingLicenses.length > 0 ? (
        <section
          className="workspace-card provider-dashboard-progress"
          aria-label="Tiến trình hệ thống đang xử lý"
        >
          <ClockCircleOutlined aria-hidden="true" />
          <div>
            <strong>
              {pendingLicenses.length} bản quyền đang chờ hoàn tất phát hành
            </strong>
            <p>Hệ thống đang xử lý xác nhận blockchain.</p>
          </div>
          <Link to="/provider/licenses?status=PENDING_ONCHAIN">
            Xem tiến độ <span aria-hidden="true">→</span>
          </Link>
        </section>
      ) : null}

      {!(onboarding && licenses.isSuccess && recentLicenses.length === 0) ? (
        <section
          className="workspace-card provider-dashboard-panel provider-recent-licenses"
          aria-labelledby="provider-recent-title"
        >
          <div className="provider-dashboard-section-head">
            <h2 id="provider-recent-title">Bản quyền mới nhất</h2>
            <Link to="/provider/licenses">
              Xem tất cả <span aria-hidden="true">→</span>
            </Link>
          </div>
          {licenses.isPending ? (
            <div
              className="provider-dashboard-recent-loading"
              role="status"
              aria-label="Đang tải bản quyền mới nhất"
              aria-busy="true"
            >
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton
                  key={index}
                  active
                  paragraph={{ rows: 2 }}
                  title={false}
                />
              ))}
            </div>
          ) : licenses.isError ? (
            <Alert
              showIcon
              type="error"
              title="Không thể tải bản quyền mới nhất."
              action={
                <Button
                  loading={licenses.isFetching}
                  onClick={() => void licenses.refetch()}
                >
                  Thử lại
                </Button>
              }
            />
          ) : recentLicenses.length === 0 ? (
            <Empty
              description={
                <>
                  <strong>Chưa có bản quyền nào được phát hành</strong>
                  <p>
                    Các bản quyền mới sẽ xuất hiện tại đây sau khi hệ thống ghi
                    nhận phát hành.
                  </p>
                </>
              }
            />
          ) : (
            <div className="provider-recent-table-wrap">
              <table className="provider-recent-table">
                <thead>
                  <tr>
                    <th scope="col">Ngày tạo</th>
                    <th scope="col">Sản phẩm / gói</th>
                    <th scope="col">Mã tra cứu</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLicenses.map((license) => (
                    <tr key={license.id}>
                      <td className="provider-recent-date">
                        {providerLicenseDate(license.createdAt)}
                      </td>
                      <td className="provider-recent-product">
                        <strong>{license.productName}</strong>
                        <small>
                          {license.plan.name} · v{license.plan.version}
                        </small>
                      </td>
                      <td className="provider-recent-code">
                        <ProviderLicenseId value={license.publicLicenseId} />
                      </td>
                      <td className="provider-recent-status">
                        <ProviderLicenseStatus
                          license={license}
                          secondary={false}
                        />
                      </td>
                      <td className="provider-recent-action">
                        <Link
                          to={`/provider/licenses?licenseId=${encodeURIComponent(license.id)}`}
                        >
                          Xem chi tiết <span aria-hidden="true">→</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
