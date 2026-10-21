import { Alert, Button } from 'antd';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAssistanceHealth, usePlatformReadiness } from '../../application/operations/operationsQueries';
import { usePaymentReviews } from '../../application/orders/orderQueries';
import { knowledgeDocumentState, useKnowledgeDocuments } from '../../application/assistance/knowledgeQueries';
import { PageHeader, StatusChip } from '../components/WorkspacePrimitives';
import { SystemUsersPanel } from '../components/SystemUsersPanel';
import { SystemBlockchainPanel } from '../components/SystemBlockchainPanel';
import { ProviderOperationsScreen } from './ProviderOperationsScreen';

function SystemOverview() {
  const readiness = usePlatformReadiness();
  const assistance = useAssistanceHealth();
  const reviews = usePaymentReviews();
  const documents = useKnowledgeDocuments();
  const pendingDocuments = documents.data?.filter((document) => knowledgeDocumentState(document, documents.data ?? []) === 'READY').length;
  const work = [
    { title: 'Tài liệu chờ duyệt', count: pendingDocuments, query: documents, to: '/system/console/knowledge', link: 'Duyệt tài liệu', description: 'Các phiên bản đã xử lý, đang chờ công bố.' },
    { title: 'Thanh toán cần kiểm tra', count: reviews.data?.filter((review) => review.reviewStatus === 'OPEN').length, query: reviews, to: '/system/console?view=payments', link: 'Kiểm tra thanh toán', description: 'Các giao dịch chưa có kết luận rà soát.' },
    { title: 'Yêu cầu hỗ trợ', count: assistance.data?.conversations.waitingSupport, query: assistance, description: 'Đang chờ nhân viên hỗ trợ tiếp nhận.' },
  ];
  return <div className="system-screen">
    <PageHeader title="Tổng quan hệ thống" description="Theo dõi tình trạng dịch vụ và các công việc quản trị cần chú ý." />
    <section className="workspace-card system-section" aria-label="Sức khỏe hệ thống">
      <div className="section-heading"><h2>Tình trạng dịch vụ</h2><Button loading={readiness.isFetching} onClick={() => void readiness.refetch()}>Kiểm tra lại</Button></div>
      <dl className="system-health-list">
        {['API', 'PostgreSQL', 'Redis'].map((name) => {
          const value = name === 'API' ? readiness.data?.status : readiness.data?.dependencies[name === 'PostgreSQL' ? 'postgres' : 'redis'];
          const known = !readiness.isError && (name === 'API' ? value === 'ok' || value === 'degraded' : value === 'up' || value === 'down');
          const healthy = value === 'ok' || value === 'up';
          return <div key={name}><dt>{name}</dt><dd><StatusChip tone={known ? healthy ? 'success' : 'error' : 'neutral'}>{readiness.isLoading ? 'Đang kiểm tra' : !known ? 'Chưa xác định' : healthy ? name === 'API' ? 'Hoạt động' : 'Đã kết nối' : value === 'degraded' ? 'Có dịch vụ không khả dụng' : 'Không khả dụng'}</StatusChip></dd></div>;
        })}
      </dl>
      {readiness.isError ? <Alert showIcon type="warning" title="Không thể truy vấn tình trạng dịch vụ." description="Chưa đủ thông tin để kết luận dịch vụ ngừng hoạt động." action={<Button disabled={readiness.isFetching} onClick={() => void readiness.refetch()}>Thử lại</Button>} /> : null}
    </section>
    <section className="workspace-card system-section" aria-label="Công việc cần xử lý">
      <h2>Công việc cần xử lý</h2>
      <ul className="system-work-list">{work.map((item) => <li key={item.title}>
        <div><h3>{item.title}</h3><p className="muted-copy">{item.description}</p></div>
        {item.query.isLoading ? <span role="status">Đang tải…</span> : item.query.isError ? <Button loading={item.query.isFetching} onClick={() => void item.query.refetch()}>Thử lại</Button> : <strong aria-label={`${item.title}: ${item.count ?? 'chưa xác định'}`}>{item.count ?? 'Chưa xác định'}</strong>}
        {item.to ? <Link to={item.to}>{item.link}</Link> : <small className="muted-copy">Nhân viên hỗ trợ tiếp nhận</small>}
      </li>)}</ul>
      {documents.isError ? <Alert type="error" title="Không thể tải số tài liệu chờ duyệt." /> : null}
      {reviews.isError ? <Alert type="error" title="Không thể tải số thanh toán cần kiểm tra." /> : null}
      {assistance.isError ? <Alert type="error" title="Không thể tải tình trạng thông báo và hỗ trợ." /> : null}
    </section>
    {assistance.isSuccess && assistance.data.notifications.deadLetter > 0 ? <Alert showIcon type="warning" title={`${assistance.data.notifications.deadLetter} thông báo chưa thể gửi sau các lần thử.`} /> : null}
    <div className="system-related-links"><Link to="/system/console?view=users">Quản lý người dùng</Link><Link to="/system/console?view=blockchain">Đối soát blockchain</Link></div>
  </div>;
}

export function SystemConsoleScreen() {
  const view = new URLSearchParams(useLocation().search).get('view');
  if (view === 'audit') return <Navigate to="/system/console" replace />;
  if (view === 'users') return <SystemUsersPanel />;
  if (view === 'payments') return <div className="system-screen"><ProviderOperationsScreen /></div>;
  if (view === 'blockchain') return <SystemBlockchainPanel />;
  return <SystemOverview />;
}
