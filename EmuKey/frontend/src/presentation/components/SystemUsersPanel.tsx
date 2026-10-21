import { Alert, Button, Drawer, Dropdown, Input, Modal, Select, Skeleton, Table } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { describeApiError, requestJson, useAuth, type AuthUser } from '../../application/auth/authContext';
import { paginationTextControls } from '../theme';
import { FactList, PageHeader, StatusChip, useDebouncedValue } from './WorkspacePrimitives';
import { ProviderInvitationsPanel } from './ProviderInvitationsPanel';
import { useSystemUsers } from '../../application/auth/identityQueries';

export const accountRoleLabels: Record<string, string> = { SYSTEM_ADMIN: 'Quản trị hệ thống', PROVIDER_ADMIN: 'Quản trị nhà cung cấp', SUPPORT_STAFF: 'Nhân viên hỗ trợ', CUSTOMER: 'Người mua' };
export const accountStatusLabels: Record<string, string> = { ACTIVE: 'Đang hoạt động', LOCKED: 'Đã khóa', DISABLED: 'Đã vô hiệu hóa', PENDING_EMAIL_VERIFICATION: 'Chờ xác minh email' };
type AccountAction = 'lock' | 'unlock' | 'disable';
const actionLabels = { lock: 'Khóa', unlock: 'Mở khóa', disable: 'Vô hiệu hóa' };

export function SystemUsersPanel() {
  const { user } = useAuth();
  const permitted = user?.role === 'SYSTEM_ADMIN';
  const client = useQueryClient();
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const role = Object.hasOwn(accountRoleLabels, params.get('role') ?? '') ? params.get('role')! : '';
  const status = Object.hasOwn(accountStatusLabels, params.get('status') ?? '') ? params.get('status')! : '';
  const setFilter = (key: 'role' | 'status', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };
  useEffect(() => {
    if (location.hash !== '#provider-invitations' || !permitted) return;
    const panel = document.getElementById('provider-invitations');
    panel?.scrollIntoView?.({ block: 'start' });
    panel?.focus({ preventScroll: true });
  }, [location.hash, permitted]);
  const [accountId, setAccountId] = useState<string>();
  const [confirmation, setConfirmation] = useState<{ account: AuthUser; action: AccountAction }>();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const accounts = useSystemUsers(search, permitted);
  const detail = useQuery({ queryKey: ['identity', 'user', accountId], queryFn: () => requestJson<AuthUser>(`/auth/users/${encodeURIComponent(accountId!)}`), enabled: permitted && Boolean(accountId) });
  const mutation = useMutation({
    mutationFn: ({ account, action }: { account: AuthUser; action: AccountAction }) => requestJson(`/auth/users/${encodeURIComponent(account.id)}/${action}`, { method: 'POST' }),
    onSuccess: async () => { setConfirmation(undefined); await client.invalidateQueries({ queryKey: ['identity'] }); },
    onError: () => setConfirmation(undefined),
  });
  const refresh = async () => {
    setRefreshing(true);
    try { await client.refetchQueries({ queryKey: ['identity'], type: 'active' }, { throwOnError: true }); mutation.reset(); }
    catch { /* Keep the uncertain-result notice until a successful refresh. */ }
    finally { setRefreshing(false); }
  };
  const visible = accounts.data?.filter((account) => (!role || account.role === role) && (!status || account.status === status));
  const actions = (account: AuthUser) => {
    const allowed: AccountAction[] = account.status === 'ACTIVE' ? ['lock', 'disable'] : account.status === 'LOCKED' ? ['unlock', 'disable'] : [];
    if (!allowed.length) return null;
    return <Dropdown trigger={['click']} menu={{ items: allowed.map((action) => ({ key: action, label: actionLabels[action], danger: action !== 'unlock', disabled: account.id === user?.id || mutation.isPending || mutation.isError })), onClick: ({ key }) => setConfirmation({ account, action: key as AccountAction }) }}><Button aria-label={`Thao tác tài khoản ${account.email}`} title={account.id === user?.id ? 'Không thay đổi trạng thái tài khoản đang sử dụng.' : undefined}>Thao tác</Button></Dropdown>;
  };
  return <div className="system-screen">
    <PageHeader title="Quản lý người dùng" />
    <section className="workspace-card system-section" aria-label="Danh sách người dùng">
      <div className="section-heading"><h2>Danh sách người dùng</h2><Button type="primary" disabled={!permitted} onClick={() => setInviteOpen(true)}>Mời nhà cung cấp</Button></div>
      <div className="system-toolbar">
        <Input allowClear aria-label="Tìm người dùng" placeholder="Tìm theo tên hoặc email" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select aria-label="Lọc vai trò" value={role} onChange={(value) => setFilter('role', value)} options={[{ value: '', label: 'Tất cả vai trò' }, ...Object.entries(accountRoleLabels).map(([value, label]) => ({ value, label }))]} />
        <Select aria-label="Lọc trạng thái tài khoản" value={status} onChange={(value) => setFilter('status', value)} options={[{ value: '', label: 'Tất cả trạng thái' }, ...Object.entries(accountStatusLabels).map(([value, label]) => ({ value, label }))]} />
      </div>
      {accounts.isError ? <Alert showIcon type="error" title="Không thể tải danh sách người dùng." description={describeApiError(accounts.error, 'Vui lòng thử lại.')} action={<Button loading={accounts.isFetching} onClick={() => void accounts.refetch()}>Thử lại</Button>} /> : null}
      {mutation.isError ? <Alert showIcon type="error" title={describeApiError(mutation.error, 'Không thể cập nhật trạng thái tài khoản.')} description="Kết quả thao tác có thể chưa rõ. Hãy tải lại trạng thái tài khoản trước khi quyết định thao tác tiếp theo." action={<Button loading={refreshing} onClick={() => void refresh()}>Làm mới trạng thái</Button>} /> : null}
      {mutation.isSuccess ? <p role="status">Đã cập nhật trạng thái tài khoản.</p> : null}
      {!accounts.isError ? <Table<AuthUser> loading={accounts.isLoading} rowKey="id" dataSource={visible ?? []} scroll={{ x: 800 }} pagination={{ ...paginationTextControls, pageSize: 10, showSizeChanger: false }} locale={{ emptyText: accounts.isLoading ? 'Đang tải người dùng…' : query || role || status ? 'Không có người dùng phù hợp với bộ lọc.' : 'Chưa có tài khoản người dùng.' }} columns={[
        { title: 'Người dùng', render: (_, account) => <><strong>{account.displayName}</strong><small>{account.email}</small></> },
        { title: 'Vai trò', dataIndex: 'role', render: (value: string) => accountRoleLabels[value] ?? 'Vai trò chưa xác định' },
        { title: 'Trạng thái', dataIndex: 'status', render: (value: string) => <StatusChip tone={value === 'ACTIVE' ? 'success' : 'neutral'}>{accountStatusLabels[value] ?? 'Trạng thái chưa xác định'}</StatusChip> },
        { title: 'Thao tác', render: (_, account) => <div className="table-actions"><Button onClick={() => setAccountId(account.id)}>Xem chi tiết</Button>{actions(account)}</div> },
      ]} /> : null}
    </section>
    {permitted ? <ProviderInvitationsPanel open={inviteOpen} onOpenChange={setInviteOpen} /> : null}
    <Drawer className="system-drawer" title="Chi tiết tài khoản" size={520} open={Boolean(accountId)} onClose={() => setAccountId(undefined)}>
      {detail.isLoading ? <Skeleton active /> : detail.isError ? <Alert type="error" title="Không thể tải chi tiết tài khoản." action={<Button loading={detail.isFetching} onClick={() => void detail.refetch()}>Thử lại</Button>} /> : detail.data ? <><FactList facts={[
        { label: 'Họ tên', value: detail.data.displayName }, { label: 'Email', value: detail.data.email },
        { label: 'Vai trò', value: accountRoleLabels[detail.data.role] ?? 'Chưa xác định' }, { label: 'Trạng thái', value: accountStatusLabels[detail.data.status] ?? 'Chưa xác định' },
        { label: 'Số điện thoại', value: detail.data.phone ?? 'Chưa cung cấp' }, { label: 'Địa chỉ', value: detail.data.address ?? 'Chưa cung cấp' }, { label: 'Mã tài khoản', value: detail.data.id },
      ]} />{actions(detail.data)}</> : null}
    </Drawer>
    <Modal title={confirmation ? `${actionLabels[confirmation.action]} tài khoản?` : 'Xác nhận'} open={Boolean(confirmation)} confirmLoading={mutation.isPending} okText={confirmation ? actionLabels[confirmation.action] : 'Xác nhận'} cancelText="Hủy" okButtonProps={{ danger: confirmation?.action !== 'unlock' }} onCancel={() => { if (!mutation.isPending) setConfirmation(undefined); }} onOk={() => { if (confirmation && !mutation.isPending) mutation.mutate(confirmation); }}>
      <p>{confirmation?.account.email}</p>
      <p>{confirmation?.action === 'lock' ? 'Người dùng sẽ không thể đăng nhập và các phiên hiện tại mất hiệu lực. Có thể mở khóa lại tài khoản.' : confirmation?.action === 'unlock' ? 'Cho phép tài khoản đăng nhập trở lại. Người dùng cần đăng nhập lại.' : 'Người dùng sẽ không thể đăng nhập và các phiên hiện tại mất hiệu lực. Hệ thống hiện chưa hỗ trợ kích hoạt lại tài khoản đã vô hiệu hóa.'}</p>
    </Modal>
  </div>;
}
