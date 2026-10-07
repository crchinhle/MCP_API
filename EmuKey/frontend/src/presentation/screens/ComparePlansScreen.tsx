import { PageLoading } from '../components/WorkspacePrimitives';
import { Alert, Button, Checkbox, Empty, Input, Spin, Table } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
  formatVnd,
  useComparePlans,
  useProducts,
} from '../../application/catalog/catalogQueries';
import { useOptionalAuth } from '../../application/auth/authContext';
import { SiteHeader } from '../components/SiteHeader';

function displayDimension(key: string, value: unknown): string {
  if (key === 'priceVnd' && typeof value === 'number') return formatVnd(value);
  if (key === 'durationMonths' && typeof value === 'number') return `${value} tháng`;
  if (key === 'maxActiveDevices' && typeof value === 'number') return `${value} thiết bị`;
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([name, enabled]) => `${name}: ${typeof enabled === 'boolean' ? (enabled ? 'Có' : 'Không') : String(enabled)}`)
      .join(', ') || 'Không có';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
}

export function ComparePlansScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useOptionalAuth();
  const initialIds = useMemo(
    () => [...new Set((searchParams.get('ids') ?? '').split(',').filter(Boolean))].slice(0, 4),
    [searchParams],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const [query, setQuery] = useState('');
  const products = useProducts();
  const comparison = useComparePlans(selectedIds);
  const choices = (products.data ?? []).flatMap((product) =>
    product.plans.map((plan) => ({
      id: plan.id,
      label: `${product.name} · ${plan.label}`,
      productSlug: product.slug,
    })),
  );

  if (products.isLoading) return <div className="page-shell"><SiteHeader /><PageLoading /></div>;

  return (
    <div className="page-shell">
      <SiteHeader />
       <main className="catalog-content comparison-content" id="main-content" tabIndex={-1}>
        <nav aria-label="Breadcrumb" className="breadcrumb">
          <Link to="/products">Sản phẩm</Link><span>/</span><span>So sánh gói</span>
        </nav>
        <section className="catalog-hero comparison-hero">
          <div>
            <h1>So sánh gói bản quyền</h1>
            <p>Chọn từ hai đến bốn gói để đối chiếu giá, thời hạn, số thiết bị và quyền lợi.</p>
            <Input aria-label="Tìm gói so sánh" placeholder="Tìm sản phẩm hoặc tên gói" value={query} onChange={(event) => setQuery(event.target.value)} />
            <p>Đã chọn {selectedIds.length}/4 gói</p>
            {selectedIds.length ? <Button onClick={() => setSelectedIds([])}>Bỏ chọn tất cả</Button> : null}
          </div>
          <div className="comparison-selection" aria-label="Chọn gói để so sánh">

            {products.isError ? <Alert type="error" title="Không thể tải các gói" action={<Button onClick={() => void products.refetch()}>Thử lại</Button>} /> : null}
            {choices.filter((choice) => selectedIds.includes(choice.id) || choice.label.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).map((choice) => (
              <Checkbox
                checked={selectedIds.includes(choice.id)}
                disabled={!selectedIds.includes(choice.id) && selectedIds.length >= 4}
                key={choice.id}
                onChange={(event) => setSelectedIds((current) =>
                  event.target.checked
                    ? [...current, choice.id]
                    : current.filter((id) => id !== choice.id),
                )}
              >
                {choice.label}
              </Checkbox>
            ))}
          </div>
        </section>

        {selectedIds.length < 2 ? (
          <Empty description="Chọn ít nhất hai gói để bắt đầu so sánh." />
        ) : comparison.isLoading ? (
          <Spin aria-label="Đang so sánh gói" />
        ) : comparison.isError || !comparison.data ? (
          <Alert showIcon type="error" message="Không thể tải dữ liệu so sánh gói." />
        ) : (
          <section className="workspace-card table-card comparison-table" aria-label="Bảng so sánh gói">
            <Table
              dataSource={comparison.data.dimensions.map((dimension) => ({ ...dimension, id: dimension.key }))}
              pagination={false}
              rowKey="id"
              scroll={{ x: 720 }}
              columns={[
                { dataIndex: 'label', fixed: 'left', title: 'Tiêu chí', width: 190 },
                ...comparison.data.plans.map((plan) => ({
                  key: plan.id,
                  title: <span>{plan.productName}<br /><small>{plan.name}</small></span>,
                  render: (_: unknown, row: { key: string; values: Record<string, unknown> }) =>
                    displayDimension(row.key, row.values[plan.id]),
                })),
              ]}
            />
            <div className="workspace-actions comparison-actions">
              <Button href="/products">Chọn lại sản phẩm</Button>
              {comparison.data.plans.map((plan) => {
                const choice = choices.find((item) => item.id === plan.id);
                if (!choice) return null;
                const checkout = `/buyer/checkout?product=${encodeURIComponent(choice.productSlug)}&planId=${encodeURIComponent(choice.id)}`;
                return <Button key={plan.id} type="primary" onClick={() => void navigate(auth?.user ? checkout : `/auth?mode=login&redirect=${encodeURIComponent(checkout)}`)}>Mua {plan.name}</Button>;
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
