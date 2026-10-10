import { PageLoading } from '../components/WorkspacePrimitives';
import { Alert, Button, Empty } from 'antd';
import {
  BlockOutlined,
  CheckCircleOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';

import { formatVnd, useProducts } from '../../application/catalog/catalogQueries';
import { ProductArtwork } from '../components/ProductArtwork';
import { SiteHeader } from '../components/SiteHeader';
import type { Product } from '../../domain/product';

const publicHomeStyles = `
  .public-home-screen {
    min-height: 100vh;
    background: var(--canvas);
    font-family: 'IBM Plex Sans Variable', 'IBM Plex Sans', 'Segoe UI', sans-serif;
  }

  .public-home-screen h1,
  .public-home-screen h2,
  .public-home-screen h3,
  .public-home-screen button {
    font-family: inherit;
  }

  .public-home-content {
    width: min(100% - 80px, 1320px);
    margin: 0 auto;
  }

  .public-home-hero {
    margin-inline: 56px;
    padding: 36px 48px;
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
    align-items: center;
    gap: 48px;
    border-radius: 0 0 12px 12px;
    color: var(--sidebar-text);
    background: var(--sidebar);
  }

  .public-home-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    color: #a8c3ff;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .public-home-hero h1 {
    max-width: 760px;
    margin: 0 0 16px;
    font-size: clamp(1.9rem, 3vw, 2.375rem);
    line-height: 1.16;
    letter-spacing: -0.01em;
  }

  .public-home-hero p {
    max-width: 720px;
    margin: 0;
    color: var(--sidebar-muted, #b0ada6);
    font-size: 16px;
    line-height: 1.55;
  }

  .public-home-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 26px;
  }

  .public-home-hero-flow {
    padding: 22px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.055);
  }

  .public-home-hero-flow-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;
  }

  .public-home-hero-flow h2 {
    margin: 0;
    font-size: 16px;
  }

  .public-home-hero-flow-header span {
    padding: 4px 9px;
    border: 1px solid rgba(168, 195, 255, 0.3);
    border-radius: 999px;
    color: #c7d8ff;
    font-size: 12px;
    white-space: nowrap;
  }

  .public-home-hero-flow ol {
    margin: 0;
    padding: 0;
    display: grid;
    gap: 14px;
    list-style: none;
  }

  .public-home-hero-flow li {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    align-items: start;
    gap: 12px;
  }

  .public-home-flow-icon {
    width: 34px;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    color: #dbe6ff;
    background: rgba(31, 91, 216, 0.34);
    font-size: 16px;
  }

  .public-home-hero-flow strong {
    display: block;
    margin-bottom: 3px;
    font-size: 14px;
  }

  .public-home-hero-flow p {
    font-size: 13px;
    line-height: 1.45;
  }

  .public-home-introduction {
    margin: 36px 56px 0;
    padding: clamp(40px, 5vw, 64px);
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    align-items: start;
    gap: clamp(40px, 6vw, 88px);
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
  }

  .public-home-introduction-heading {
    align-self: center;
  }

  .public-home-introduction h2 {
    max-width: 560px;
    margin: 0;
    font-size: clamp(2.2rem, 3.6vw, 3.5rem);
    font-weight: 650;
    line-height: 1.08;
    letter-spacing: -0.03em;
  }

  .public-home-introduction-summary {
    max-width: 520px;
    margin: 22px 0 0;
    color: var(--text-secondary);
    font-size: 20px;
    line-height: 1.6;
  }

  .public-home-introduction-copy > p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 16px;
    line-height: 1.7;
  }

  .public-home-introduction-copy > p + p {
    margin-top: 14px;
  }

  .public-home-introduction-copy > .public-home-introduction-lead {
    color: var(--text);
    font-size: 19px;
    line-height: 1.6;
  }

  .public-home-introduction-points {
    margin: 28px 0 0;
    padding: 0;
    display: grid;
    list-style: none;
    border-top: 1px solid var(--border);
  }

  .public-home-introduction-points li {
    padding: 15px 0;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 12px;
    border-bottom: 1px solid var(--border);
    line-height: 1.5;
  }

  .public-home-introduction-points .anticon {
    margin-top: 3px;
    color: var(--primary);
    font-size: 17px;
  }

  .public-home-introduction-points strong {
    display: block;
    margin-bottom: 2px;
    font-size: 15px;
  }

  .public-home-introduction-points span {
    color: var(--text-secondary);
    font-size: 14px;
  }

  .public-home-introduction-actions {
    margin-top: 28px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .public-home-featured {
    padding: 44px 56px 64px;
  }

  .public-home-featured-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  }

  .public-home-featured-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .public-home-featured-header p {
    margin: 6px 0 0;
    color: var(--text-secondary);
  }

  .public-home-carousel {
    position: relative;
  }

  .public-home-viewport {
    overflow: hidden;
  }

  .public-home-track {
    width: 100%;
    display: flex;
    transition: transform 350ms ease;
    will-change: transform;
  }

  .public-home-page {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
    flex: 0 0 100%;
    width: 100%;
    min-width: 100%;
    box-sizing: border-box;
  }

  .public-home-featured-card {
    height: 100%;
    border-color: var(--border);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 10px 28px rgba(20, 28, 45, 0.05);
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .public-home-featured-card:hover,
  .public-home-featured-card:focus-within {
    transform: translateY(-3px);
    box-shadow: 0 14px 34px rgba(20, 28, 45, 0.1);
  }

  .public-home-featured-card .ant-card-body {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 24px;
  }

  .public-home-featured-card h3,
  .public-home-featured-card p {
    margin: 0;
  }

  .public-home-featured-card h3 {
    font-size: 20px;
    line-height: 28px;
  }

  .public-home-featured-card p {
    min-height: 48px;
    color: var(--text-secondary);
    font-size: 16px;
    line-height: 1.55;
  }

  .public-home-featured-card strong {
    font-size: 17px;
  }

  .public-home-featured-card .ant-btn {
    align-self: flex-start;
    margin-top: auto;
    min-height: 44px;
  }

  .public-home-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    margin-top: 24px;
  }

  .public-home-arrow {
    width: 40px;
    height: 40px;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--surface);
    color: var(--text);
    font-size: 20px;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .public-home-arrow:hover:not(:disabled) {
    background: var(--subtle);
    border-color: var(--border-hover);
  }

  .public-home-arrow:disabled {
    color: var(--text-disabled);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .public-home-dots {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .public-home-dots button {
    width: 12px;
    height: 12px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--border);
    cursor: pointer;
    transition: background 120ms ease, transform 120ms ease;
  }

  .public-home-dots button.active {
    background: var(--primary);
    transform: scale(1.15);
  }

  @media (max-width: 1100px) {
    .public-home-hero {
      grid-template-columns: minmax(0, 1fr) minmax(300px, 0.7fr);
      gap: 32px;
    }

    .public-home-page { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 960px) {
    .public-home-hero {
      margin-inline: 32px;
      padding: 40px 32px;
      grid-template-columns: 1fr;
    }

    .public-home-introduction {
      margin-inline: 32px;
      grid-template-columns: 1fr;
      gap: 32px;
    }

    .public-home-featured { padding: 40px 32px 56px; }
  }

  @media (max-width: 760px) {
    .public-home-content { width: 100%; }
    .public-home-hero {
      margin-inline: 16px;
      padding: 32px 16px;
    }

    .public-home-hero h1 {
      font-size: clamp(1.6rem, 6vw, 1.9rem);
    }

    .public-home-featured {
      padding: 32px 16px 48px;
    }

    .public-home-introduction {
      margin: 24px 16px 0;
      padding: 32px 20px;
    }

    .public-home-introduction h2 {
      font-size: clamp(1.75rem, 7vw, 2.1rem);
    }
    .public-home-introduction-copy > p + p { display: none; }
    .public-home-introduction-points { gap: 8px; }

    .public-home-featured-header {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }

    .public-home-page {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .public-home-introduction-actions {
      width: 100%;
    }

    .public-home-introduction-actions .ant-btn {
      flex: 1 1 180px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .public-home-track { transition: none; }
    .public-home-dots button { transition: none; }
    .public-home-featured-card { transition: none; }
  }
`;

function cardsPerPage(): number {
  if (typeof window === 'undefined') return 3;
  const w = window.innerWidth;
  if (w <= 760) return 1;
  if (w <= 1100) return 2;
  return 3;
}

function FeaturedCarousel({ products }: { readonly products: readonly Product[] }) {
  const [perPage, setPerPage] = useState(cardsPerPage);
  useEffect(() => {
    const onResize = () => setPerPage(cardsPerPage());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const pageCount = Math.max(1, Math.ceil(products.length / perPage));
  const hasMorePages = pageCount > 1;

  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const goPrev = useCallback(() => setPage((current) => Math.max(0, current - 1)), []);
  const goNext = useCallback(() => setPage((current) => (current + 1) % pageCount), [pageCount]);
  const goFirst = useCallback(() => setPage(0), []);
  const goLast = useCallback(() => setPage(pageCount - 1), [pageCount]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const tag = (event.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); goPrev(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); goNext(); }
    else if (event.key === 'Home') { event.preventDefault(); goFirst(); }
    else if (event.key === 'End') { event.preventDefault(); goLast(); }
  };

  const pages: Product[][] = [];
  for (let i = 0; i < products.length; i += perPage) {
    pages.push(products.slice(i, i + perPage));
  }

  return (
    <div
      aria-label="Sản phẩm nổi bật"
      className="public-home-carousel"
      onKeyDown={handleKeyDown}
      role="region"
    >
      <div className="public-home-viewport">
        <div
          aria-live="polite"
          className="public-home-track"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {pages.map((pageProducts, pageIndex) => (
            <div aria-hidden={pageIndex !== page} className="public-home-page" inert={pageIndex !== page} key={`page-${pageIndex}`}>
              {pageProducts.map((product) => {
                const startingPlan = product.plans[0];
                return (
                  <div className="public-home-featured-card ant-card ant-card-bordered" key={product.slug}>
                    <div className="ant-card-body">
                      <ProductArtwork imageUrl={product.imageUrl} productName={product.name} tone={product.tone} />
                      <h3>{product.name}</h3>
                      <p>{product.summary}</p>
                      {startingPlan ? <strong>Từ {formatVnd(startingPlan.priceVnd)}</strong> : null}
                      <Button href={`/products/${product.slug}`} type="primary">
                        Xem chi tiết
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {hasMorePages ? (
        <div className="public-home-nav">
          <button aria-label="Trước" className="public-home-arrow" disabled={page === 0} onClick={goPrev} type="button">&#8249;</button>
          <div aria-label="Chọn trang sản phẩm" className="public-home-dots" role="tablist">
            {pages.map((_, pageIndex) => (
              <button
                aria-label={`Trang ${pageIndex + 1}`}
                aria-selected={pageIndex === page}
                className={pageIndex === page ? 'active' : undefined}
                key={`dot-${pageIndex}`}
                onClick={() => setPage(pageIndex)}
                role="tab"
                type="button"
              />
            ))}
          </div>
          <button aria-label="Sau" className="public-home-arrow" onClick={goNext} type="button">&#8250;</button>
        </div>
      ) : null}
    </div>
  );
}

export function PublicHomeScreen() {
  const { data: products = [], isLoading, isError, refetch } = useProducts();
  const featured = products.slice(0, 6);

  if (isLoading) return <div className="page-shell"><SiteHeader /><PageLoading /></div>;

  return (
    <div className="page-shell public-home-screen">
      <style>{publicHomeStyles}</style>
      <SiteHeader />
      <main className="public-home-content">
        <section aria-labelledby="public-home-title" className="public-home-hero">
          <div className="public-home-hero-copy">
            <span className="public-home-eyebrow">
              <SafetyCertificateOutlined aria-hidden="true" />
              Nền tảng bản quyền số minh bạch
            </span>
            <h1 id="public-home-title">Bản quyền phần mềm được xác lập on-chain</h1>
            <p>Thanh toán off-chain, quyền sử dụng được xác lập và kiểm chứng on-chain.</p>
            <div className="public-home-hero-actions">
              <Button href="/products" type="primary">
                Xem sản phẩm
              </Button>
              <Button href="/verify">Xác minh bản quyền</Button>
            </div>
          </div>

          <aside aria-labelledby="public-home-flow-title" className="public-home-hero-flow">
            <div className="public-home-hero-flow-header">
              <h2 id="public-home-flow-title">Quy trình cấp phép</h2>
              <span>3 bước rõ ràng</span>
            </div>
            <ol>
              <li>
                <span className="public-home-flow-icon"><ShoppingCartOutlined aria-hidden="true" /></span>
                <div>
                  <strong>Chọn sản phẩm</strong>
                  <p>So sánh gói và số lượng thiết bị phù hợp.</p>
                </div>
              </li>
              <li>
                <span className="public-home-flow-icon"><KeyOutlined aria-hidden="true" /></span>
                <div>
                  <strong>Hoàn tất đơn hàng</strong>
                  <p>Thanh toán theo hướng dẫn và nhận license trong tài khoản.</p>
                </div>
              </li>
              <li>
                <span className="public-home-flow-icon"><BlockOutlined aria-hidden="true" /></span>
                <div>
                  <strong>Xác minh on-chain</strong>
                  <p>Tra cứu trạng thái công khai mà không lộ dữ liệu người mua.</p>
                </div>
              </li>
            </ol>
          </aside>
        </section>

        <section aria-labelledby="public-home-introduction-title" className="public-home-introduction">
          <div className="public-home-introduction-heading">
            <h2 id="public-home-introduction-title">Chọn bản quyền phù hợp cho bạn</h2>
            <p className="public-home-introduction-summary">
              Khám phá, sở hữu và quản lý phần mềm theo một quy trình rõ ràng từ lúc chọn gói đến khi xác minh.
            </p>
          </div>

          <div className="public-home-introduction-copy">
            <p className="public-home-introduction-lead">
              EmuKey là nền tảng kết nối người mua với các nhà cung cấp phần mềm, giúp quá trình chọn gói,
              thanh toán, nhận license và xác minh quyền sử dụng diễn ra liền mạch.
            </p>
            <p>
              Thay vì quản lý đơn hàng, mã bản quyền và tình trạng bản quyền ở nhiều nơi, bạn có thể theo dõi
              toàn bộ vòng đời license trong một tài khoản và chủ động kiểm tra trạng thái công khai khi cần.
            </p>
            <ul className="public-home-introduction-points">
              <li>
                <CheckCircleOutlined aria-hidden="true" />
                <div><strong>Chọn đúng gói</strong><span>So sánh mức giá, thời hạn và số lượng thiết bị trước khi mua.</span></div>
              </li>
              <li>
                <CheckCircleOutlined aria-hidden="true" />
                <div><strong>Theo dõi xuyên suốt</strong><span>Quản lý đơn hàng, license và thiết bị từ một khu vực tài khoản thống nhất.</span></div>
              </li>
              <li>
                <CheckCircleOutlined aria-hidden="true" />
                <div><strong>Chủ động xác minh</strong><span>Kiểm tra trạng thái và finality on-chain mà không công khai dữ liệu người mua.</span></div>
              </li>
            </ul>
            <div className="public-home-introduction-actions">
              <Button href="/products" type="primary">Khám phá sản phẩm</Button>
              <Button href="/help">Tìm hiểu quy trình</Button>
            </div>
          </div>
        </section>

        <section aria-labelledby="public-home-featured-title" className="public-home-featured">
          <div className="public-home-featured-header">
            <div>
              <h2 id="public-home-featured-title">Sản phẩm nổi bật</h2>
              <p>Các gói phần mềm đang được phát hành trên EmuKey.</p>
            </div>
          </div>


          {isError ? (
            <Alert
              action={<Button onClick={() => void refetch()}>Thử lại</Button>}
              message="Không thể tải danh mục sản phẩm"
              showIcon
              type="error"
            />
          ) : null}
          {!isLoading && !isError && featured.length === 0 ? (
            <Empty description="Chưa có sản phẩm." />
          ) : null}
          {!isLoading && !isError && featured.length > 0 ? (
            <FeaturedCarousel products={featured} />
          ) : null}
        </section>
      </main>
    </div>
  );
}
