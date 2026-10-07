import { PageLoading } from '../components/WorkspacePrimitives';
import { Alert, Button, Card, Empty, Input, Pagination, Select } from 'antd';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';

import {
  formatVnd,
  useProducts,
} from '../../application/catalog/catalogQueries';
import { ProductArtwork } from '../components/ProductArtwork';
import { SiteHeader } from '../components/SiteHeader';

const sortOptions = [
  { value: 'popular', label: 'Mặc định' },
  { value: 'price-asc', label: 'Giá tăng dần' },
] as const;

export function CatalogScreen({ authenticated = false }: { readonly authenticated?: boolean }) {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const [page, setPage] = useState(1);
  const [sort, setSort] =
    useState<(typeof sortOptions)[number]['value']>('popular');
  const { data: products = [], isLoading, isError, refetch } = useProducts();
  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('vi');
    const filtered = products.filter(
      (product) =>
        !normalizedSearch ||
        `${product.name} ${product.summary}`
          .toLocaleLowerCase('vi')
          .includes(normalizedSearch),
    );

    return sort === 'price-asc'
      ? filtered.sort(
          (left, right) => Math.min(...left.plans.map((plan) => plan.priceVnd)) - Math.min(...right.plans.map((plan) => plan.priceVnd)),
        )
      : filtered;
  }, [products, search, sort]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visibleProducts.length / 12)));

  if (isLoading) return <div className="page-shell">{!authenticated ? <SiteHeader /> : null}<PageLoading /></div>;

  return (
    <div className="page-shell">
      {!authenticated ? <SiteHeader /> : null}
       <main className="catalog-content" id="main-content" tabIndex={-1}>
        <section className="catalog-hero">
          <div>
            <h1>Sản phẩm</h1>
            <p>Chọn gói phù hợp với số thiết bị, thời hạn và nhu cầu sử dụng.</p>
          </div>
        </section>

        <section aria-label="Bộ lọc sản phẩm" className="catalog-toolbar">
          <label>
            <span>Tìm sản phẩm</span>
            <Input
              aria-label="Tìm sản phẩm"
              placeholder="Tìm theo tên hoặc mô tả"
              value={search}
              onChange={(event) => { const value = event.target.value; setPage(1); const next = new URLSearchParams(params); if (value) next.set('q', value); else next.delete('q'); setParams(next, { replace: true }); }}
            />
          </label>
          <div className="catalog-compare-action">
            <span>Cần chọn nhanh?</span>
            <Link className="secondary-link" to="/compare">So sánh các gói</Link>
          </div>
          <label>
            <span>Sắp xếp</span>
            <Select
              aria-label="Sắp xếp"
              options={[...sortOptions]}
              value={sort}
              onChange={(value) => { setSort(value); setPage(1); }}
            />
          </label>
        </section>

        <section
          aria-label="Danh sách sản phẩm"
          className="product-grid"
          id="product-grid"
        >

          {isError ? <Alert message="Không thể tải danh mục sản phẩm" type="error" showIcon action={<Button onClick={() => void refetch()}>Thử lại</Button>} /> : null}
          {!isLoading && !isError && products.length === 0 ? (
            <Empty description="Chưa có sản phẩm và gói giá được công bố." />
          ) : null}
{!isLoading && !isError && visibleProducts.slice((currentPage - 1) * 12, currentPage * 12).map((product) => (
             <Card
               className="product-card"
               key={product.slug}
             >
               <ProductArtwork imageUrl={product.imageUrl} productName={product.name} tone={product.tone} />
               <h2>{product.name}</h2>
               <p>{product.summary}</p>
               <strong>{product.plans.length ? `Từ ${formatVnd(Math.min(...product.plans.map((plan) => plan.priceVnd)))}` : 'Chưa có gói'}</strong>
               <div className="product-actions">
                 <Link
                   className="primary-link"
                   to={`${authenticated ? '/buyer/products/' : '/products/'}${product.slug}`}
                 >
                   Xem gói & chi tiết
                 </Link>
               </div>
             </Card>
           ))}
          {!isLoading && !isError && products.length > 0 && visibleProducts.length === 0 ? (
            <Empty description="Không tìm thấy sản phẩm phù hợp" />
          ) : null}
        </section>
        {!isLoading && !isError ? <Pagination current={currentPage} pageSize={12} total={visibleProducts.length} onChange={setPage} hideOnSinglePage showSizeChanger={false} /> : null}
      </main>
    </div>
  );
}
