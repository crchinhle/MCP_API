import { Alert, Breadcrumb, Button, Empty, Spin } from 'antd';
import {
  ArrowLeftOutlined,
  BookOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SiteHeader } from '../components/SiteHeader';
import { usePublicKnowledgeDocument } from '../../application/assistance/knowledgeQueries';
import { useOptionalAuth } from '../../application/auth/authContext';

export function PublicHelpDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useOptionalAuth();

  const { data: doc, isLoading, isError } = usePublicKnowledgeDocument(id);

  if (isLoading) {
    return (
      <div className="page-shell">
        <SiteHeader />
        <main className="public-help-wrapper" id="main-content" tabIndex={-1}>
          <div className="public-help-loading-box" style={{ minHeight: 400 }}>
            <Spin size="large" />
            <p>Đang tải nội dung bài viết...</p>
          </div>
        </main>
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="page-shell">
        <SiteHeader />
        <main className="public-help-wrapper" id="main-content" tabIndex={-1}>
          <div className="public-help-card-container">
            <Button
              className="public-help-back-link"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/help')}
              type="text"
            >
              Quay lại danh sách hướng dẫn
            </Button>
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <Empty
                description="Không tìm thấy tài liệu hướng dẫn này hoặc tài liệu chưa được công bố."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
              <Button style={{ marginTop: 16 }} type="primary" onClick={() => navigate('/help')}>
                Khám phá các hướng dẫn khác
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const headings = doc.chunks
    ?.filter((c) => Boolean(c.heading))
    .map((c, i) => ({
      id: c.id || `chunk-${i}`,
      title: c.heading!,
      index: i,
    })) ?? [];

  const scrollToHeading = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="public-help-wrapper" id="main-content" tabIndex={-1}>
        <div className="public-help-detail-container">
          {/* Breadcrumb & Navigation */}
          <div className="public-help-nav-row">
            <Breadcrumb
              items={[
                { title: <Link to="/help">Trung tâm hướng dẫn</Link> },
                { title: doc.productName },
                { title: doc.title },
              ]}
            />
            <Button
              className="public-help-back-link"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/help')}
              type="text"
            >
              Quay lại danh sách
            </Button>
          </div>

          {/* Document Header Banner */}
          <header className="public-help-detail-header">
            <div className="public-help-detail-meta-chips">
              <span className="public-help-product-badge">{doc.productName}</span>
              {doc.planName && <span className="public-help-plan-badge">{doc.planName}</span>}
              <span className="public-help-date-label">
                Cập nhật: {new Date(doc.updatedAt).toLocaleDateString('vi-VN')}
              </span>
            </div>

            <h1 className="public-help-detail-title">{doc.title}</h1>

            {doc.summary && <p className="public-help-detail-summary">{doc.summary}</p>}

            {doc.tags && doc.tags.length > 0 && (
              <div className="public-help-detail-tags">
                {doc.tags.map((tag) => (
                  <span key={tag} className="public-help-item-tag-badge">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* Two Columns Layout */}
          <div className="public-help-detail-grid">
            {/* Left: Main Content Reader */}
            <article className="public-help-content-column">
              <div className="public-help-article-body">
                {doc.chunks && doc.chunks.length > 0 ? (
                  doc.chunks.map((chunk, idx) => {
                    const chunkId = chunk.id || `chunk-${idx}`;
                    return (
                      <section key={chunkId} className="public-help-chunk-section" id={chunkId}>
                        {chunk.heading && (
                          <h2 className="public-help-chunk-heading">{chunk.heading}</h2>
                        )}
                        <div className="public-help-chunk-text">
                          {chunk.content.split('\n\n').map((paragraph, pIdx) => {
                            const trimmed = paragraph.trim();
                            if (!trimmed) return null;

                            // Handle bullet points
                            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                              const items = trimmed
                                .split('\n')
                                .map((line) => line.replace(/^[-*]\s+/, '').trim())
                                .filter(Boolean);
                              return (
                                <ul key={pIdx} className="public-help-bullet-list">
                                  {items.map((it, iIdx) => (
                                    <li key={iIdx}>{it}</li>
                                  ))}
                                </ul>
                              );
                            }

                            // Handle numbered lists
                            if (/^\d+\.\s+/.test(trimmed)) {
                              const items = trimmed
                                .split('\n')
                                .map((line) => line.replace(/^\d+\.\s+/, '').trim())
                                .filter(Boolean);
                              return (
                                <ol key={pIdx} className="public-help-numbered-list">
                                  {items.map((it, iIdx) => (
                                    <li key={iIdx}>{it}</li>
                                  ))}
                                </ol>
                              );
                            }

                            return <p key={pIdx}>{trimmed}</p>;
                          })}
                        </div>
                      </section>
                    );
                  })
                ) : (
                  <p className="public-help-plain-content">{doc.content}</p>
                )}
              </div>
            </article>

            {/* Right: Sidebar */}
            <aside className="public-help-sidebar-column">
              {/* Table of Contents (Mục lục) if multiple headings */}
              {headings.length > 1 && (
                <div className="public-help-sidebar-card">
                  <div className="public-help-sidebar-card-title">
                    <BookOutlined style={{ color: '#2563eb', marginRight: 8 }} />
                    Mục lục bài viết
                  </div>
                  <nav aria-label="Mục lục bài viết" className="public-help-toc-list">
                    {headings.map((h) => (
                      <button
                        key={h.id}
                        className="public-help-toc-item"
                        onClick={() => scrollToHeading(h.id)}
                        type="button"
                      >
                        {h.title}
                      </button>
                    ))}
                  </nav>
                </div>
              )}

              {/* Related Product Card */}
              <div className="public-help-sidebar-card">
                <div className="public-help-sidebar-card-title">
                  <ShoppingOutlined style={{ color: '#059669', marginRight: 8 }} />
                  Sản phẩm liên quan
                </div>
                <div className="public-help-related-product-info">
                  <div className="public-help-related-product-name">{doc.productName}</div>
                  {doc.planName && (
                    <div className="public-help-related-product-plan">
                      Áp dụng cho: <strong>{doc.planName}</strong>
                    </div>
                  )}
                  <Button
                    block
                    className="public-help-product-btn"
                    onClick={() => navigate(`/products/id/${doc.productId}`)}
                    type="default"
                  >
                    Xem chi tiết sản phẩm
                  </Button>
                </div>
              </div>

              {/* Related Articles Card */}
              {doc.relatedDocuments && doc.relatedDocuments.length > 0 && (
                <div className="public-help-sidebar-card">
                  <div className="public-help-sidebar-card-title">
                    <FileTextOutlined style={{ color: '#6366f1', marginRight: 8 }} />
                    Bài viết cùng chủ đề
                  </div>
                  <div className="public-help-related-docs-list">
                    {doc.relatedDocuments.map((rel) => (
                      <div
                        key={rel.id}
                        className="public-help-related-doc-item"
                        onClick={() => navigate(`/help/${rel.id}`)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="public-help-related-doc-title">{rel.title}</div>
                        {rel.tags && rel.tags.length > 0 && (
                          <div className="public-help-related-doc-tags">
                            {rel.tags.slice(0, 2).map((t) => (
                              <span key={t} className="public-help-related-doc-tag">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Need Extra Help */}
              <div className="public-help-sidebar-card public-help-sidebar-card--support">
                <div className="public-help-sidebar-card-title">
                  <QuestionCircleOutlined style={{ color: '#ea580c', marginRight: 8 }} />
                  Cần trợ giúp thêm?
                </div>
                <p style={{ fontSize: 13, color: '#4b5563', margin: '8px 0 14px' }}>
                  Nếu gặp sự cố kích hoạt hoặc cần hỗ trợ trực tiếp từ đội ngũ kỹ thuật:
                </p>
                <Button
                  block
                  onClick={() =>
                    navigate(
                      auth?.user
                        ? auth.user.role === 'CUSTOMER'
                          ? '/buyer/support'
                          : '/buyer'
                        : '/auth?redirect=/buyer/support',
                    )
                  }
                  type="primary"
                >
                  {auth?.user ? 'Mở khu vực hỗ trợ' : 'Đăng nhập để được hỗ trợ'}
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
