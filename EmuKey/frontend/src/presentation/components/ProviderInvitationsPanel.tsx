import { paginationTextControls } from '../theme';
import { Alert, Button, Drawer, Form, Input, Modal, Table } from 'antd';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiRequestError, describeApiError, requestJson } from '../../application/auth/authContext';
import { useProviderInvitations } from '../../application/auth/identityQueries';
import type { InviteProviderDto, ProviderInvitationDto } from '../../infrastructure/api/generated/types.gen';
import { FactList, StatusChip } from './WorkspacePrimitives';

const invitationKey = ['identity', 'provider-invitations'] as const;
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa xác nhận';
const statusLabel = (row: ProviderInvitationDto) => row.status === 'ACCEPTED' ? 'Đã chấp nhận' : row.status === 'EXPIRED' ? 'Hết hạn' : row.sentAt ? 'Đang chờ chấp nhận' : 'Chưa xác nhận gửi email';

export function ProviderInvitationsPanel({ open: controlledOpen, onOpenChange }: { readonly open?: boolean; readonly onOpenChange?: (open: boolean) => void } = {}) {
  const queryClient = useQueryClient();
  const [localOpen, setLocalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const submitting = useRef(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (value: boolean) => { setLocalOpen(value); onOpenChange?.(value); };
  const [form] = Form.useForm<Pick<InviteProviderDto, 'email'>>();
  const invitations = useProviderInvitations();
  const selected = invitations.data?.find((row) => row.id === selectedId);
  const invite = useMutation({
    mutationFn: (values: Pick<InviteProviderDto, 'email'>) => requestJson<ProviderInvitationDto>('/auth/provider-invitations', { method: 'POST', body: JSON.stringify({ email: values.email.trim().toLowerCase() }) }),
    onSuccess: async () => {
      setOpen(false); form.resetFields();
      await queryClient.invalidateQueries({ queryKey: invitationKey });
    },
    onError: () => { void queryClient.invalidateQueries({ queryKey: invitationKey }); },
    onSettled: () => { submitting.current = false; },
  });
  const submit = (values: Pick<InviteProviderDto, 'email'>) => {
    if (submitting.current) return;
    submitting.current = true;
    invite.mutate(values);
  };
  const cancel = () => { if (!submitting.current) { setOpen(false); form.resetFields(); invite.reset(); } };
  const error = invite.error instanceof ApiRequestError && invite.error.code === 'INVITATION_EMAIL_FAILED'
    ? 'Lời mời đã lưu nhưng chưa xác nhận gửi email thành công. Hãy kiểm tra danh sách và gửi lại.'
    : describeApiError(invite.error, 'Không thể gửi lời mời. Vui lòng thử lại.');

  return <section id="provider-invitations" tabIndex={-1} aria-label="Lời mời nhà cung cấp" className="workspace-card system-section spaced-card">
    <div className="section-heading">
      <h2 className="section-title">Lời mời nhà cung cấp</h2>
      {controlledOpen === undefined ? <Button type="primary" onClick={() => { invite.reset(); form.resetFields(); setOpen(true); }}>Mời nhà cung cấp</Button> : null}
    </div>
    <p className="muted-copy">Nhà cung cấp tự thiết lập tài khoản và thông tin tổ chức. Gửi lại lời mời sẽ vô hiệu hóa liên kết cũ.</p>
    {invite.isSuccess ? <Alert showIcon type="success" title={invite.data.sentAt ? 'Đã gửi email mời nhà cung cấp.' : 'Lời mời đã được tạo; chưa có xác nhận gửi email.'} /> : null}
    {invite.isError && !open ? <Alert role="alert" showIcon type="error" title={error} /> : null}
    {invitations.isError ? <Alert type="error" title="Không thể tải lời mời." action={<Button loading={invitations.isFetching} onClick={() => void invitations.refetch()}>Thử lại</Button>} /> : null}
    {invitations.isPending ? <p role="status">Đang tải lời mời…</p> : invitations.data?.length ? <Table<ProviderInvitationDto> pagination={paginationTextControls} rowKey="id" dataSource={invitations.data} scroll={{ x: 740 }} columns={[
      { title: 'Email', dataIndex: 'email' },
      { title: 'Ngày gửi', dataIndex: 'sentAt', render: formatDate },
      { title: 'Hết hạn', dataIndex: 'expiresAt', render: formatDate },
      { title: 'Trạng thái', render: (_, row) => <StatusChip tone={row.status === 'ACCEPTED' ? 'success' : row.status === 'EXPIRED' ? 'neutral' : 'warning'}>{statusLabel(row)}</StatusChip> },
      { title: 'Thao tác', render: (_, row) => <div className="table-actions"><Button onClick={() => setSelectedId(row.id)}>Xem chi tiết</Button>{row.status !== 'ACCEPTED' ? <Button disabled={invite.isPending} onClick={() => { invite.reset(); submit({ email: row.email }); }}>Gửi lại lời mời</Button> : null}</div> },
    ]} /> : !invitations.isError ? <p>Chưa có lời mời nhà cung cấp.</p> : null}
    <Drawer className="system-drawer" title="Chi tiết lời mời" size={480} open={Boolean(selected)} onClose={() => setSelectedId(undefined)}>
      {selected ? <FactList facts={[{ label: 'Email', value: selected.email }, { label: 'Trạng thái', value: statusLabel(selected) }, { label: 'Ngày tạo', value: formatDate(selected.createdAt) }, { label: 'Ngày gửi', value: formatDate(selected.sentAt) }, { label: 'Hết hạn', value: formatDate(selected.expiresAt) }]} /> : null}
    </Drawer>
    <Modal className="provider-invitation-modal" title="Mời nhà cung cấp" width={480} open={open} footer={null} mask={{ closable: !invite.isPending }} closable={!invite.isPending} onCancel={cancel}>
      <p>Gửi lời mời để nhà cung cấp thiết lập tài khoản và thông tin tổ chức.</p>
      <Form form={form} name="invite-provider" layout="vertical" disabled={invite.isPending} onFinish={submit}>
        {invite.isError ? <Alert showIcon role="alert" type="error" title={error} /> : null}
        <Form.Item label="Email nhà cung cấp" name="email" extra="Người được mời sẽ nhận email hướng dẫn thiết lập tài khoản." rules={[{ required: true, message: 'Vui lòng nhập email nhà cung cấp.' }, { type: 'email', max: 254, message: 'Email chưa đúng định dạng.' }]} normalize={(value: string) => value.trim()}><Input autoComplete="email" inputMode="email" placeholder="name@company.com" maxLength={254} /></Form.Item>
        <div className="provider-invitation-actions"><Button disabled={invite.isPending} onClick={cancel}>Hủy</Button><Button type="primary" htmlType="submit" loading={invite.isPending}>Gửi lời mời</Button></div>
      </Form>
    </Modal>
  </section>;
}
