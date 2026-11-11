import { Empty, Input, Pagination, Select, Spin } from 'antd';
import { FileTextOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SiteHeader } from '../components/SiteHeader';
import { usePublicKnowledgeDocuments } from '../../application/assistance/knowledgeQueries';

export function PublicHelpScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const searchParam = params.get('q') ?? '';
  const tagParam = params.get('tag') ?? 'Tất cả';
  const productParam = params.get('product') ?? '';
  const pageParam = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);

  const [searchInput, setSearchInput] = useState(searchParam);

  const queryArgs: { search?: string; tag?: string; productId?: string; page?: number; limit?: number } = {
    page: pageParam,
    limit: 10,
  };
  if (searchParam.trim()) queryArgs.search = searchParam.trim();
  if (tagParam && tagParam !== 'Tất cả') queryArgs.tag = tagParam;
  if (productParam) queryArgs.productId = productParam;

  const { data, isLoading, isError } = usePublicKnowledgeDocuments(queryArgs);

  const updateFilters = (newFilters: { q?: string; tag?: string; product?: string; page?: number }) => {
    const next = new URLSearchParams(params);
    if (newFilters.q !== undefined) {
      if (newFilters.q.trim()) next.set('q', newFilters.q.trim());
      else next.delete('q');
      next.set('page', '1');
    }
    if (newFilters.tag !== undefined) {
      if (newFilters.tag && newFilters.tag !== 'Tất cả') next.set('tag', newFilters.tag);
      else next.delete('tag');
      next.set('page', '1');
    }
    if (newFilters.product !== undefined) {
      if (newFilters.product) next.set('product', newFilters.product);
      else next.delete('product');
      next.set('page', '1');
    }
    if (newFilters.page !== undefined) {
      next.set('page', String(newFilters.page));
    }
    setParams(next);
  };

  const handleSearch = (value: string) => {
    updateFilters({ q: value });
  };

  const handleTagClick = (tag: string) => {
    updateFilters({ tag: tag === tagParam ? 'Tất cả' : tag });
  };

  const handleProductChange = (productId: string) => {
    updateFilters({ product: productId });
  };

  const allTags = useMemo(() => {
    const tagsFromApi = data?.availableTags ?? [];
    return ['Tất cả', ...tagsFromApi];
  }, [data?.availableTags]);

  const productOptions = useMemo(() => {
    const defaultOpt = { value: '', label: 'Tất cả sản phẩm' };
    if (!data?.products) return [defaultOpt];
    return [defaultOpt, ...data.products.map((p) => ({ value: p.id, label: p.name }))];
  }, [data?.products]);

  const totalItems = data?.total ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="public-help-wrapper" id="main-content" tabIndex={-1}>
        <div className="public-help-card-container">
          {/* Header row */}
          <div className="public-help-header-row">
            <h1 className="public-help-title">Trung tâm hướng dẫn</h1>
            <span className="public-help-demo-badge">Demo</span>
          </div>

          {/* Search Bar */}
          <div className="public-help-search-row">
            <Input
              allowClear
              aria-label="Tìm tài liệu hướng dẫn"
              className="public-help-search-input"
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (!e.target.value) updateFilters({ q: '' });
              }}
              onPressEnter={() => handleSearch(searchInput)}
              placeholder="Tìm tài liệu hướng dẫn..."
              prefix={<SearchOutlined style={{ color: '#9ca3af', fontSize: 16, marginRight: 8 }} />}
              size="large"
              value={searchInput}
            />
          </div>

          {/* Tag Filter Pills */}
          <div aria-label="Bộ lọc chuyên mục" className="public-help-tags-bar" role="tablist">
            {allTags.map((tag) => {
              const isActive = (tag === 'Tất cả' && !tagParam) || tagParam === tag;
              return (
                <button
                  key={tag}
                  aria-selected={isActive}
                  className={`public-help-tag-pill ${isActive ? 'public-help-tag-pill--active' : ''}`}
                  onClick={() => handleTagClick(tag)}
                  role="tab"
                  type="button"
                >
                  {tag}
                </button>
              );
            })}
          </div>

          {/* Subheader: Document Count & Product Filter */}
          <div className="public-help-subheader-row">
            <div className="public-help-count-label">
              Danh sách tài liệu ({totalItems})
            </div>
            <div className="public-help-product-filter">
              <Select
                aria-label="Lọc theo sản phẩm"
                className="public-help-product-select"
                onChange={handleProductChange}
                options={productOptions}
                value={productParam}
              />
            </div>
          </div>

          {/* Document List */}
          <div className="public-help-list-region">
            {isLoading ? (
              <div className="public-help-loading-box">
                <Spin size="large" />
                <p>Đang tải tài liệu hướng dẫn...</p>
              </div>
            ) : isError ? (
              <div className="public-help-empty-box">
                <Empty description="Không thể kết nối máy chủ để tải tài liệu." />
              </div>
            ) : items.length === 0 ? (
              <div className="public-help-empty-box">
                <Empty description="Không tìm thấy tài liệu hướng dẫn phù hợp với bộ lọc." />
                {(searchParam || tagParam !== 'Tất cả' || productParam) && (
                  <button
                    className="public-help-clear-btn"
                    onClick={() => {
                      setSearchInput('');
                      setParams(new URLSearchParams());
                    }}
                    type="button"
                  >
                    Xóa tất cả bộ lọc
                  </button>
                )}
              </div>
            ) : (
              <div className="public-help-items-stack">
                {items.map((doc) => (
                  <div
                    key={doc.id}
                    className="public-help-item-card"
                    onClick={() => navigate(`/help/${doc.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/help/${doc.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="public-help-item-left">
                      <div className="public-help-item-icon-box">
                        <FileTextOutlined className="public-help-item-icon" />
                      </div>
                      <div className="public-help-item-content">
                        <div className="public-help-item-product">
                          {doc.productName}
                          {doc.planName ? ` · ${doc.planName}` : ''}
                        </div>
                        <h2 className="public-help-item-title">{doc.title}</h2>
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="public-help-item-tags">
                            {doc.tags.map((t) => (
                              <span key={t} className="public-help-item-tag-badge">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="public-help-item-right">
                      <RightOutlined className="public-help-item-chevron" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalItems > 10 && (
            <div className="public-help-pagination-box">
              <Pagination
                current={pageParam}
                onChange={(p) => updateFilters({ page: p })}
                pageSize={10}
                showSizeChanger={false}
                total={totalItems}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
