import { PageHeader, PageLoading } from '../components/WorkspacePrimitives';
import { Alert, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  SafetyCertificateOutlined,
  DesktopOutlined,
  CalendarOutlined,
  BookOutlined,
  SearchOutlined,
  RightOutlined,
} from '@ant-design/icons';

import { useLicenses } from '../../application/licenses/licenseQueries';
import { useOrders } from '../../application/orders/orderQueries';
import { selectBuyerHomeMetrics } from '../../domain/buyerHome';

function formatMetric(value: number): string {
  return String(value);
}

export function BuyerHomeScreen() {
  const navigate = useNavigate();
  const licenses = useLicenses();
  const orders = useOrders();
  const licenseRows = licenses.data ?? [];
  const orderRows = orders.data ?? [];
  const metrics = selectBuyerHomeMetrics(orderRows, licenseRows, new Date());
  const loading = licenses.isLoading || orders.isLoading;
  const failed = licenses.isError || orders.isError;

  if (loading) return <PageLoading />;
  if (failed && (!licenses.data || !orders.data)) {
    return (
      <div className="buyer-home-screen">
        <main className="buyer-home-main" id="main-content" tabIndex={-1}>
          <PageHeader title="Tổng quan tài khoản" />
          <Alert
            showIcon
            message="Không thể tải dữ liệu trang chủ."
            type="error"
            action={
              <Button onClick={() => { void licenses.refetch(); void orders.refetch(); }}>
                Thử lại
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  const hasExpiring = !loading && !failed && metrics.licensesExpiringWithin30Days > 0;

  return (
    <div className="buyer-home-screen">
      <main className="buyer-home-main" id="main-content" tabIndex={-1}>
        <PageHeader title="Tổng quan tài khoản" />
        {failed ? <Alert showIcon message="Không thể tải dữ liệu trang chủ." type="error" /> : null}

        <section aria-label="Tóm tắt tài khoản" className="buyer-home-metrics">
          <button
            type="button"
            className="buyer-home-metric"
            onClick={() => void navigate('/buyer/licenses?filter=ACTIVE')}
            aria-label={`Bản quyền đang hoạt động: ${loading || failed ? 'chưa có dữ liệu' : metrics.activeLicenses}`}
          >
            <div className="buyer-home-metric-icon buyer-home-metric-icon--primary">
              <SafetyCertificateOutlined />
            </div>
            <strong>{loading || failed ? '—' : formatMetric(metrics.activeLicenses)}</strong>
            <span>Bản quyền đang hoạt động</span>
          </button>

          <button
            type="button"
            className="buyer-home-metric"
            onClick={() => void navigate('/buyer/licenses')}
            aria-label={`Thiết bị đang sử dụng: ${loading || failed || metrics.activeDevices === null ? 'chưa có dữ liệu' : metrics.activeDevices}`}
          >
            <div className="buyer-home-metric-icon buyer-home-metric-icon--neutral">
              <DesktopOutlined />
            </div>
            <strong>{loading || failed || metrics.activeDevices === null ? '—' : formatMetric(metrics.activeDevices)}</strong>
            <span>Thiết bị đang sử dụng</span>
            {!loading && !failed && metrics.activeDevices === null && <small>Số thiết bị do bên bán quản lý chưa được xác minh.</small>}
          </button>

          <button
            type="button"
            className={`buyer-home-metric ${hasExpiring ? 'buyer-home-metric--attention' : ''}`}
            onClick={() => void navigate('/buyer/licenses?filter=expiring')}
            aria-label={`Sắp hết hạn trong 30 ngày: ${loading || failed ? 'chưa có dữ liệu' : metrics.licensesExpiringWithin30Days}`}
          >
            <div className="buyer-home-metric-icon buyer-home-metric-icon--warning">
              <CalendarOutlined />
            </div>
            <strong>{loading || failed ? '—' : formatMetric(metrics.licensesExpiringWithin30Days)}</strong>
            <span>Sắp hết hạn trong 30 ngày</span>
            {hasExpiring ? <span className="buyer-home-attention-chip">Cần chú ý</span> : null}
          </button>
        </section>

        {hasExpiring ? (
          <section aria-labelledby="buyer-attention-title" className="buyer-home-attention-section">
            <div className="buyer-home-attention-header">
              <h2 id="buyer-attention-title">Cần chú ý</h2>
              <button
                type="button"
                className="buyer-home-attention-link"
                onClick={() => void navigate('/buyer/licenses?filter=expiring')}
              >
                Xem bản quyền
              </button>
            </div>
            <div
              role="button"
              tabIndex={0}
              className="buyer-home-attention-card"
              onClick={() => void navigate('/buyer/licenses?filter=expiring')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void navigate('/buyer/licenses?filter=expiring');
                }
              }}
              aria-label={`${metrics.licensesExpiringWithin30Days} bản quyền sắp hết hạn. Kiểm tra thời hạn sử dụng để gia hạn kịp thời.`}
            >
              <div className="buyer-home-attention-icon-box">
                <CalendarOutlined />
              </div>
              <div className="buyer-home-attention-content">
                <h3>{metrics.licensesExpiringWithin30Days} bản quyền sắp hết hạn</h3>
                <p>Kiểm tra thời hạn sử dụng để gia hạn kịp thời.</p>
              </div>
              <div className="buyer-home-attention-arrow">
                <RightOutlined />
              </div>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="buyer-shortcuts-title" className="buyer-home-shortcuts">
          <h2 id="buyer-shortcuts-title">Lối tắt</h2>
          <div className="buyer-home-shortcut-grid">
            <button
              type="button"
              className="buyer-home-shortcut"
              onClick={() => void navigate('/buyer/licenses')}
              aria-label="Quản lý bản quyền: Xem và gia hạn"
            >
              <div className="buyer-home-shortcut-icon">
                <SafetyCertificateOutlined />
              </div>
              <h3>Quản lý bản quyền</h3>
              <p>Xem và gia hạn</p>
            </button>
            <button
              type="button"
              className="buyer-home-shortcut"
              onClick={() => void navigate('/help')}
              aria-label="Đọc hướng dẫn: Cài đặt và sử dụng"
            >
              <div className="buyer-home-shortcut-icon">
                <BookOutlined />
              </div>
              <h3>Đọc hướng dẫn</h3>
              <p>Cài đặt và sử dụng</p>
            </button>
            <button
              type="button"
              className="buyer-home-shortcut"
              onClick={() => void navigate('/verify')}
              aria-label="Xác minh: Kiểm tra bản quyền"
            >
              <div className="buyer-home-shortcut-icon">
                <SearchOutlined />
              </div>
              <h3>Xác minh</h3>
              <p>Kiểm tra bản quyền</p>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
