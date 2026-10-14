import { PageLoading } from '../components/WorkspacePrimitives';
import { Alert, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

import { useLicenses } from '../../application/licenses/licenseQueries';
import { useOrders } from '../../application/orders/orderQueries';
import { selectBuyerHomeMetrics } from '../../domain/buyerHome';

function formatMetric(value: number): string {
  return String(value).padStart(2, '0');
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
    return <Alert showIcon message="Không thể tải dữ liệu trang chủ." type="error" action={<Button onClick={() => { void licenses.refetch(); void orders.refetch(); }}>Thử lại</Button>} />;
  }

  return (
    <div className="buyer-home-screen">
      <main className="buyer-home-main">
        {failed ? <Alert showIcon message="Không thể tải dữ liệu trang chủ." type="error" /> : null}

        <section aria-label="Tóm tắt tài khoản" className="buyer-home-metrics">
          <article className="buyer-home-metric">
            <strong>{loading || failed ? '—' : formatMetric(metrics.recentOrders)}</strong>
            <span>Đơn hàng gần đây</span>
          </article>
          <article className="buyer-home-metric">
            <strong>{loading || failed ? '—' : formatMetric(metrics.activeDevices)}</strong>
            <span>Thiết bị đang dùng</span>
          </article>
          <article className="buyer-home-metric buyer-home-metric--attention">
            <strong>{loading || failed ? '—' : formatMetric(metrics.licensesExpiringWithin30Days)}</strong>
            <span>Sắp hết hạn trong 30 ngày</span>
            {!loading && !failed && metrics.licensesExpiringWithin30Days > 0 ? <span className="buyer-home-attention-chip">Cần chú ý</span> : null}
          </article>
        </section>

        <section aria-labelledby="buyer-shortcuts-title" className="buyer-home-shortcuts">
          <h2 id="buyer-shortcuts-title">Lối tắt</h2>
          <div className="buyer-home-shortcut-grid">
            <article className="buyer-home-shortcut">
              <h3>Mua thêm sản phẩm</h3>
              <p>Khám phá các phần mềm và gói bản quyền trong danh mục.</p>
              <Button onClick={() => void navigate('/buyer/products')}>Mở danh mục</Button>
            </article>
            <article className="buyer-home-shortcut">
              <h3>Đọc hướng dẫn</h3>
              <p>Cài đặt, kích hoạt và xử lý sự cố.</p>
              <Button onClick={() => void navigate('/help')}>Xem hướng dẫn</Button>
            </article>
            <article className="buyer-home-shortcut">
              <h3>Xác minh bản quyền</h3>
              <p>Kiểm tra nhanh mã bản quyền hiện có.</p>
              <Button onClick={() => void navigate('/verify')}>Xác minh ngay</Button>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
