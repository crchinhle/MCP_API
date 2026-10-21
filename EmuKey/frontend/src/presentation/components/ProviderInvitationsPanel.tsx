import { paginationTextControls } from '../theme';
import { Alert, Button, Form, Input, Modal, Table } from 'antd';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiRequestError, describeApiError, requestJson } from '../../application/auth/authContext';
import type { InviteProviderDto, ProviderInvitationDto } from '../../infrastructure/api/generated/types.gen';

const invitationKey = ['identity', 'provider-invitations'] as const;

export function ProviderInvitationsPanel({ open: controlledOpen, onOpenChange }: { readonly open?: boolean; readonly onOpenChange?: (open: boolean) => void } = {}) {
  const queryClient = useQueryClient();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (value: boolean) => { setLocalOpen(value); onOpenChange?.(value); };
  const [form] = Form.useForm<InviteProviderDto>();
  const invitations = useQuery({ queryKey: invitationKey, queryFn: () => requestJson<ProviderInvitationDto[]>('/auth/provider-invitations') });
  const invite = useMutation({
    mutationFn: (values: InviteProviderDto) => requestJson<ProviderInvitationDto>('/auth/provider-invitations', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: async () => {
      setOpen(false); form.resetFields();
      await queryClient.invalidateQueries({ queryKey: invitationKey });
    },
    onError: () => { void queryClient.invalidateQueries({ queryKey: invitationKey }); },
  });
  const error = invite.error instanceof ApiRequestError && invite.error.code === 'INVITATION_EMAIL_FAILED'
    ? 'Lời mời đã lưu nhưng chưa xác nhận gửi email thành công. Hãy kiểm tra danh sách và gửi lại.'
    : describeApiError(invite.error, 'Không thể gửi lời mời. Vui lòng thử lại.');

  return <section aria-label="Lời mời nhà cung cấp" className="workspace-card system-section spaced-card">
    <div className="section-heading">
      <h2 className="section-title">Lời mời nhà cung cấp</h2>
      {controlledOpen === undefined ? <Button type="primary" onClick={() => { invite.reset(); form.resetFields(); setOpen(true); }}>Mời nhà cung cấp</Button> : null}
    </div>
    <p className="muted-copy">Nhà cung cấp tự đặt mật khẩu qua email. Liên kết có hiệu lực 24 giờ; gửi lại sẽ vô hiệu hóa liên kết cũ.</p>
    {invite.isSuccess ? <Alert showIcon type="success" title="Đã gửi email mời nhà cung cấp." /> : null}
    {invite.isError && !open ? <Alert role="alert" showIcon type="error" title={error} /> : null}
    {invitations.isError ? <Alert type="error" title="Không thể tải lời mời." action={<Button onClick={() => void invitations.refetch()}>Thử lại</Button>} /> : null}
    {invitations.isPending ? <p role="status">Đang tải lời mời…</p> : invitations.data?.length ? <Table<ProviderInvitationDto> pagination={paginationTextControls} rowKey="id" dataSource={invitations.data} scroll={{ x: 750 }} columns={[
      { title: 'Email', dataIndex: 'email' },
      { title: 'Tổ chức', dataIndex: 'organizationName' },
      { title: 'Trạng thái', render: (_, row) => row.status === 'ACCEPTED' ? 'Đã kích hoạt' : row.status === 'EXPIRED' ? 'Hết hạn' : row.sentAt ? 'Chờ chấp nhận' : 'Chưa xác nhận gửi email' },
      { title: 'Ngày gửi', dataIndex: 'sentAt', render: (value: string | null) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa xác nhận' },
      { title: 'Hết hạn', dataIndex: 'expiresAt', render: (value: string) => new Date(value).toLocaleString('vi-VN') },
      { title: 'Thao tác', render: (_, row) => row.status !== 'ACCEPTED' ? <Button disabled={invite.isPending} onClick={() => {
        invite.reset();
        invite.mutate({ email: row.email, displayName: row.displayName, organizationName: row.organizationName, providerChainAddress: row.providerChainAddress, providerChainNamespace: row.providerChainNamespace });
      }}>Gửi lại lời mời</Button> : null },
    ]} /> : !invitations.isError ? <p>Chưa có lời mời nhà cung cấp.</p> : null}
    <Modal title="Mời nhà cung cấp" open={open} footer={null} mask={{ closable: !invite.isPending }} closable={!invite.isPending} onCancel={() => { if (!invite.isPending) { setOpen(false); form.resetFields(); invite.reset(); } }}>
      <Form form={form} name="invite-provider" layout="vertical" disabled={invite.isPending} onFinish={(values) => invite.mutate(values)}>
        {invite.isError ? <Alert showIcon role="alert" type="error" title={error} /> : null}
        <Form.Item label="Email nhà cung cấp" name="email" rules={[{ required: true, type: 'email', max: 254 }]} normalize={(value: string) => value.trim()}><Input autoComplete="email" maxLength={254} /></Form.Item>
        <Form.Item label="Tên người đại diện" name="displayName" rules={[{ required: true, whitespace: true, max: 255 }]}><Input autoComplete="name" maxLength={255} /></Form.Item>
        <Form.Item label="Tên tổ chức" name="organizationName" rules={[{ required: true, whitespace: true, max: 255 }]}><Input autoComplete="organization" maxLength={255} /></Form.Item>
        <Form.Item label="Địa chỉ EVM công khai" name="providerChainAddress" extra="Địa chỉ công khai định danh nhà cung cấp; không nhập private key." rules={[{ required: true }, { pattern: /^0x[0-9a-fA-F]{40}$/, message: 'Nhập địa chỉ EVM gồm 0x và 40 ký tự hex.' }, { pattern: /^(?!0x0{40}$)/, message: 'Không sử dụng địa chỉ zero.' }]}><Input maxLength={42} /></Form.Item>
        <Form.Item label="Namespace nhà cung cấp" name="providerChainNamespace" extra="Định danh duy nhất, ví dụ: cong-ty-abc." rules={[{ required: true, max: 100 }, { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: 'Dùng chữ thường, số và dấu gạch nối giữa các từ.' }]}><Input maxLength={100} /></Form.Item>
        <Button block type="primary" htmlType="submit" loading={invite.isPending}>Gửi lời mời</Button>
      </Form>
    </Modal>
  </section>;
}
