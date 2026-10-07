import { Alert, Button, Input, Popconfirm, Table } from 'antd';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { describeApiError, requestJson, useAuth, type AuthUser } from '../../application/auth/authContext';
import { useAssistanceHealth, useBlockchainReconciliation, usePlatformReadiness } from '../../application/operations/operationsQueries';
import { usePaymentHistory } from '../../application/orders/orderQueries';

import { PaymentReviewPanel } from '../components/PaymentReviewPanel';
import { AuditLogPanel } from '../components/AuditLogPanel';
import { PageLoading, FactList, PageHeader } from '../components/WorkspacePrimitives';

export function SystemConsoleScreen() {
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const permitted = user?.role === 'SYSTEM_ADMIN';
  const readiness = usePlatformReadiness();
  const assistance = useAssistanceHealth(permitted);
  const payments = usePaymentHistory();
  const reconciliation = useBlockchainReconciliation();
  const view = new URLSearchParams(location.search).get('view');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const accounts = useQuery({ queryKey: ['identity', 'users', userQuery], queryFn: () => requestJson<Array<{ id: string; email: string; displayName: string; role: string; status: string }>>(`/auth/users${userQuery.trim() ? `?q=${encodeURIComponent(userQuery.trim())}` : ''}`), enabled: permitted });
  const detail = useQuery({ queryKey: ['identity', 'user', accountId], queryFn: () => requestJson<AuthUser>(`/auth/users/${accountId}`), enabled: permitted && Boolean(accountId) });
  const stateMutation = useMutation({ mutationFn: async ({ id, action }: { id: string; action: 'lock' | 'unlock' | 'disable' }) => requestJson(`/auth/users/${id}/${action}`, { method: 'POST', body: JSON.stringify({ reason: `System console: ${action}` }) }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['identity'] }); } });
  if (readiness.isLoading || (permitted && assistance.isLoading) || (view === 'users' && accounts.isLoading) || (view === 'payments' && payments.isLoading)) return <PageLoading />;

  return (
    <>
      <PageHeader
        title={view === 'users' ? 'Quản lý người dùng' : view === 'payments' ? 'Lịch sử thanh toán' : view === 'audit' ? 'Nhật ký hệ thống' : view === 'blockchain' ? 'Đối soát blockchain' : 'Tổng quan hệ thống'}
      />
      <section aria-label="Sức khỏe hệ thống" className="metric-grid metric-grid--four">
        <article className="metric-card"><span className="status-chip status-chip--info">API</span><strong>{readiness.data?.status ?? (readiness.isLoading ? '...' : '—')}</strong><small>Tình trạng dịch vụ</small></article>
        <article className="metric-card"><span className="status-chip status-chip--success">PostgreSQL</span><strong>{readiness.data?.dependencies.postgres ?? '—'}</strong><small>Kết nối dịch vụ</small></article>
        <article className="metric-card"><span className="status-chip status-chip--info">Redis</span><strong>{readiness.data?.dependencies.redis ?? '—'}</strong><small>Kết nối dịch vụ</small></article>
        <article className="metric-card"><span className="status-chip status-chip--warning">Support</span><strong>{assistance.data?.conversations.waitingSupport ?? '—'}</strong><small>Đang chờ hỗ trợ</small></article>
      </section>
      {readiness.isError ? <Alert showIcon type="warning" message="Một số dịch vụ đang gián đoạn hoặc chưa thể kiểm tra." /> : null}
      {assistance.isError && permitted ? <Alert showIcon type="warning" message="Không thể tải tình trạng thông báo và hỗ trợ." /> : null}
      <nav aria-label="Bộ lọc nhật ký" className="system-tabs">
        {[
          ['all', 'Tổng quan'],
          ['users', 'Người dùng'],
          ['payments', 'Thanh toán'],
          ['blockchain', 'Blockchain'],
          ['audit', 'Nhật ký'],
        ].map(([value, label]) => (
          <a className={new URLSearchParams(location.search).get('view') === value || (value === 'all' && !new URLSearchParams(location.search).get('view')) ? 'active' : ''} href={value === 'all' ? '/system/console' : `/system/console?view=${value}`} key={value}>{label}</a>
        ))}
      </nav>
      <section className="workspace-card table-card spaced-card">
        {view === 'users' ? <>
          {!permitted ? <Alert message="Bạn không có quyền quản lý tài khoản." type="warning" /> : null}
           {accounts.isError ? <Alert message={describeApiError(accounts.error, 'Không thể tải danh sách tài khoản.')} type="error" /> : null}
           {stateMutation.isError ? <Alert message={describeApiError(stateMutation.error, 'Không thể cập nhật trạng thái tài khoản.')} type="error" /> : null}
           <Input allowClear aria-label="Tìm người dùng" onChange={(event) => setUserQuery(event.target.value)} placeholder="Tìm theo tên hoặc email" style={{ marginBottom: 16, maxWidth: 420 }} value={userQuery} />
          <Table dataSource={accounts.data ?? []} loading={accounts.isLoading} rowKey="id" scroll={{ x: 900 }} onRow={(record) => ({ onClick: () => setAccountId(record.id) })} columns={[{ title: 'Tên', dataIndex: 'displayName' }, { title: 'Email', dataIndex: 'email' }, { title: 'Vai trò', dataIndex: 'role' }, { title: 'Trạng thái', dataIndex: 'status' }, { title: 'Thao tác', render: (_: unknown, record) => <span className="table-actions"><Button disabled={!permitted || stateMutation.isPending || record.status === 'DISABLED'} onClick={(event) => { event.stopPropagation(); stateMutation.mutate({ id: record.id, action: record.status === 'LOCKED' ? 'unlock' : 'lock' }); }}>{record.status === 'LOCKED' ? 'Mở khóa' : record.status === 'DISABLED' ? 'Đã vô hiệu hóa' : 'Khóa'}</Button>{record.status !== 'DISABLED' ? <Popconfirm title="Vô hiệu hóa tài khoản?" description="Người dùng sẽ không thể tiếp tục sử dụng tài khoản." okText="Vô hiệu hóa" cancelText="Giữ lại" onConfirm={() => stateMutation.mutate({ id: record.id, action: 'disable' })}><Button danger disabled={!permitted || stateMutation.isPending} onClick={(event) => event.stopPropagation()}>Vô hiệu hóa</Button></Popconfirm> : null}</span> }]} />
          {accountId ? <div role="region" aria-label="Chi tiết tài khoản">{detail.isLoading ? <span>Đang tải chi tiết...</span> : detail.isError ? <Alert message="Không thể tải chi tiết tài khoản." type="error" /> : <FactList facts={[{ label: 'Họ tên', value: String(detail.data?.displayName ?? '—') }, { label: 'Email', value: String(detail.data?.email ?? '—') }, { label: 'Vai trò', value: String(detail.data?.role ?? '—') }, { label: 'Trạng thái', value: String(detail.data?.status ?? '—') }]} />}</div> : null}
        </> : view === 'payments' ? <>
          {permitted ? <PaymentReviewPanel /> : null}
          {payments.isError ? <Alert type="error" message="Không thể tải lịch sử thanh toán." /> : null}
          <Table dataSource={payments.data ?? []} loading={payments.isLoading} rowKey="transactionId" scroll={{ x: 900 }} columns={[
            { title: 'Mã đơn', dataIndex: 'orderNumber' },
            { title: 'Sản phẩm', dataIndex: 'productNameSnapshot' },
            { title: 'Số tiền', dataIndex: 'amountVnd', render: (value: number) => `${value.toLocaleString('vi-VN')} ₫` },
            { title: 'Phân loại', dataIndex: 'classification' },
          ]} />
        </> : view === 'blockchain' ? <>
          <div className="section-heading"><h2 className="section-title">Đối soát blockchain</h2><Button loading={reconciliation.isPending} disabled={!permitted} onClick={() => reconciliation.mutate()}>Chạy đối soát</Button></div>
          {reconciliation.isError ? <Alert type="error" message="Không thể chạy đối soát blockchain." /> : null}
          {reconciliation.data ? <div className="stack-list"><p>Sự kiện đã ghi nhận: {reconciliation.data.indexedEvents}</p><p>Yêu cầu chưa rõ kết quả: {reconciliation.data.health.unknown_commands}</p><p>Sự kiện đang chờ: {reconciliation.data.health.pending_events}</p><p>Bản ghi đã đồng bộ lại: {reconciliation.data.projection.licenseRepairs + reconciliation.data.projection.commandRepairs}</p></div> : <div className="empty-state"><strong>Chưa chạy đối soát</strong><p>Đối chiếu dữ liệu hệ thống với các sự kiện blockchain để phát hiện và xử lý sai lệch.</p></div>}
        </> : view === 'audit' && permitted ? <AuditLogPanel /> : <div className="empty-state"><h2>Theo dõi hệ thống</h2><p>Xem tình trạng các dịch vụ phía trên. Chọn Người dùng, Thanh toán hoặc Blockchain để kiểm tra chi tiết.</p><p><a href="/system/console?view=audit">Tra cứu nhật ký hệ thống</a></p></div>}
      </section>
    </>
  );
}
