import { Alert, Button, Skeleton } from 'antd';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useProviderInvitations, useSystemUsers } from '../../application/auth/identityQueries';
import { usePaymentReviews } from '../../application/orders/orderQueries';
import { knowledgeDocumentState, useKnowledgeDocuments } from '../../application/assistance/knowledgeQueries';
import { PageHeader } from '../components/WorkspacePrimitives';
import { SystemUsersPanel } from '../components/SystemUsersPanel';
import { SystemBlockchainPanel } from '../components/SystemBlockchainPanel';
import { ProviderOperationsScreen } from './ProviderOperationsScreen';

interface CountQuery {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => unknown;
}

function OverviewCount({ title, count, query }: { title: string; count: number | undefined; query: CountQuery }) {
  if (query.isPending) return <span role="status" aria-label={`Đang tải ${title.toLocaleLowerCase('vi')}`}><Skeleton.Input active size="small" /></span>;
  return <div className="system-count">
    <strong aria-label={`${title}: ${query.isError ? '—' : count ?? '—'}`}>{query.isError ? '—' : count ?? '—'}</strong>
    {query.isError ? <Button size="small" aria-label={`Thử lại: ${title}`} loading={query.isFetching} onClick={() => void query.refetch()}>Thử lại</Button> : null}
  </div>;
}

function SystemOverview() {
  const accounts = useSystemUsers();
  const invitations = useProviderInvitations();
  const reviews = usePaymentReviews();
  const documents = useKnowledgeDocuments();
  const pendingDocuments = documents.data?.filter((document) => knowledgeDocumentState(document, documents.data ?? []) === 'READY').length;
  const publishedDocuments = documents.data ? new Set(documents.data.filter((document) => document.status === 'READY' && document.isCurrent).map((document) => JSON.stringify([document.providerUserId, document.logicalDocumentKey]))).size : undefined;
  const metrics = [
    { title: 'Tổng tài khoản', count: accounts.data?.length, query: accounts, to: '/system/console?view=users', link: 'Xem người dùng' },
    { title: 'Tài khoản quản trị nhà cung cấp', supporting: 'Đang hoạt động', count: accounts.data?.filter((account) => account.role === 'PROVIDER_ADMIN' && account.status === 'ACTIVE').length, query: accounts, to: '/system/console?view=users&role=PROVIDER_ADMIN&status=ACTIVE', link: 'Xem nhà cung cấp' },
    { title: 'Tài liệu đã công bố', count: publishedDocuments, query: documents, to: '/system/console/knowledge?status=PUBLISHED', link: 'Xem tài liệu' },
  ];
  const work = [
    { title: 'Tài liệu chờ duyệt', count: pendingDocuments, query: documents, to: '/system/console/knowledge?status=READY', link: 'Duyệt tài liệu', description: 'Các phiên bản đã xử lý, đang chờ công bố.' },
    { title: 'Thanh toán cần kiểm tra', count: reviews.data?.filter((review) => review.reviewStatus === 'OPEN').length, query: reviews, to: '/system/console?view=payments', link: 'Kiểm tra thanh toán', description: 'Các giao dịch chưa có kết luận rà soát.' },
  ];
  const noWork = work.every((item) => item.query.isSuccess && item.count === 0);
  const invitationCounts = [
    { title: 'Đang chờ chấp nhận', status: 'PENDING' },
    { title: 'Hết hạn', status: 'EXPIRED' },
    { title: 'Đã chấp nhận', status: 'ACCEPTED' },
  ];
  return <div className="system-screen">
    <PageHeader title="Tổng quan hệ thống" />
    <section className="system-metrics" aria-label="Thống kê quản trị">
      {metrics.map((metric) => <article className="workspace-card system-metric" key={metric.title}>
        <h2>{metric.title}</h2>
        <div className="system-metric-value"><OverviewCount title={metric.title} count={metric.count} query={metric.query} />{metric.supporting ? <small className="muted-copy">{metric.supporting}</small> : null}</div>
        <Link to={metric.to}>{metric.link}</Link>
      </article>)}
    </section>
    {accounts.isError ? <Alert type="error" title="Không thể tải thống kê tài khoản." /> : null}
    {documents.isError ? <Alert type="error" title="Không thể tải thống kê tài liệu." /> : null}
    <section className="workspace-card system-section" aria-label="Công việc cần xử lý">
      <h2>Công việc cần xử lý</h2>
      {noWork ? <div className="system-compact-empty"><p>Không có công việc đang chờ xử lý</p><small className="muted-copy">Chưa ghi nhận tài liệu hoặc giao dịch cần quản trị viên xử lý.</small></div> : <ul className="system-work-list">{work.filter((item) => !item.query.isSuccess || item.count !== 0).map((item) => <li key={item.title}>
        <div><h3>{item.title}</h3><p className="muted-copy">{item.description}</p></div>
        <OverviewCount title={item.title} count={item.count} query={item.query} />
        <Link to={item.to}>{item.link}</Link>
      </li>)}</ul>}
      {documents.isError ? <Alert type="error" title="Không thể tải số tài liệu chờ duyệt." /> : null}
      {reviews.isError ? <Alert type="error" title="Không thể tải số thanh toán cần kiểm tra." /> : null}
    </section>
    <section className="workspace-card system-section" aria-label="Lời mời nhà cung cấp">
      <div className="section-heading"><h2>Lời mời nhà cung cấp</h2><Link to="/system/console?view=users#provider-invitations">Quản lý lời mời</Link></div>
      {invitations.isPending ? <div role="status" aria-label="Đang tải lời mời"><Skeleton active title={false} paragraph={{ rows: 1 }} /></div> : invitations.isError ? <Alert type="error" title="Không thể tải lời mời nhà cung cấp." action={<Button loading={invitations.isFetching} onClick={() => void invitations.refetch()}>Thử lại</Button>} /> : <>
        {invitations.data.length ? <dl className="system-invitation-counts">{invitationCounts.map((item) => { const count = invitations.data.filter((invitation) => invitation.status === item.status).length; return <div key={item.status}><dt>{item.title}</dt><dd aria-label={`${item.title}: ${count}`}>{count}</dd></div>; })}</dl> : null}
        {!invitations.data.some((invitation) => invitation.status === 'PENDING') ? <p className="system-compact-empty">Chưa có lời mời đang chờ.</p> : null}
      </>}
    </section>
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
