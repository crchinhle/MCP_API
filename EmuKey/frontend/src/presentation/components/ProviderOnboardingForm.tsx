import { Alert, Button, Form, Input, Skeleton } from 'antd';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ApiRequestError, describeApiError, requestJson } from '../../application/auth/authContext';
import type { AcceptProviderInvitationDto, ProviderInvitationPreviewDto } from '../../infrastructure/api/generated';
import { passwordComplexityRule } from './AuthForms';

type RecipientProfile = Pick<AcceptProviderInvitationDto, 'displayName' | 'organizationName' | 'password'>;

export function AcceptProviderInvitationForm({ token, onLogin, onActivated }: { readonly token: string; readonly onLogin: () => Promise<void>; readonly onActivated: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [completedToken, setCompletedToken] = useState<string>();
  const submitting = useRef(false);
  const validFormat = /^[A-Za-z0-9_-]{43}$/.test(token);
  const invitation = useQuery({
    queryKey: ['identity', 'provider-invitation-preview', token],
    enabled: validFormat && completedToken !== token,
    retry: false,
    staleTime: 60_000,
    queryFn: () => requestJson<ProviderInvitationPreviewDto>('/auth/provider-invitations/inspect', { method: 'POST', body: JSON.stringify({ token }) }),
  });
  if (completedToken && (!token || completedToken === token)) return <div className="provider-onboarding-success">
    <Alert showIcon type="success" title="Tài khoản nhà cung cấp đã được tạo. Bạn có thể đăng nhập." />
    <Button block type="primary" loading={loading} onClick={() => {
      if (submitting.current) return;
      submitting.current = true; setLoading(true); setError(null);
      void onLogin().catch((cause: unknown) => setError(describeApiError(cause, 'Không thể chuyển sang đăng nhập. Vui lòng thử lại.'))).finally(() => { submitting.current = false; setLoading(false); });
    }}>Đăng nhập</Button>
    {error ? <Alert showIcon role="alert" type="error" title={error} /> : null}
  </div>;
  if (!validFormat) return <Alert showIcon type="error" title="Liên kết mời không hợp lệ." description="Vui lòng liên hệ quản trị hệ thống để được gửi lại lời mời." />;
  if (invitation.isPending) return <div role="status" aria-label="Đang kiểm tra lời mời"><Skeleton active paragraph={{ rows: 3 }} /></div>;
  if (invitation.isError) {
    const invalid = invitation.error instanceof ApiRequestError && invitation.error.code === 'INVALID_OR_EXPIRED_INVITATION';
    return <Alert showIcon role="alert" type="error" title={invalid ? 'Lời mời không hợp lệ, đã hết hạn hoặc đã được sử dụng.' : 'Không thể kiểm tra lời mời.'} description={invalid ? 'Vui lòng liên hệ quản trị hệ thống để nhận lời mời mới.' : describeApiError(invitation.error, 'Vui lòng thử lại.')} action={!invalid ? <Button loading={invitation.isFetching} onClick={() => void invitation.refetch()}>Thử lại</Button> : undefined} />;
  }
  return <Form key={token} className="provider-onboarding" name="accept-provider-invitation" layout="vertical" disabled={loading} onFinish={(values: RecipientProfile) => {
    if (submitting.current) return;
    submitting.current = true; setLoading(true); setError(null);
    void requestJson('/auth/provider-invitations/accept', { method: 'POST', body: JSON.stringify({ token, password: values.password, displayName: values.displayName.trim(), organizationName: values.organizationName.trim() }) })
      .then(() => { setCompletedToken(token); onActivated(); })
      .catch((cause: unknown) => setError(cause instanceof ApiRequestError && cause.code === 'INVALID_OR_EXPIRED_INVITATION'
        ? 'Lời mời đã hết hạn hoặc đã được sử dụng. Vui lòng liên hệ quản trị hệ thống để nhận lời mời mới.'
        : describeApiError(cause, 'Không thể hoàn tất đăng ký. Vui lòng thử lại.')))
      .finally(() => { submitting.current = false; setLoading(false); });
  }}>
    {error ? <Alert showIcon role="alert" type="error" title={error} /> : null}
    <fieldset><legend>Thông tin cá nhân</legend>
      <Form.Item label="Email" htmlFor="provider-invitation-email"><Input id="provider-invitation-email" readOnly value={invitation.data.email} autoComplete="email" /></Form.Item>
      <Form.Item label="Tên người đại diện" name="displayName" normalize={(value: string) => value.trimStart()} rules={[{ required: true, whitespace: true, max: 255, message: 'Nhập tên người đại diện, tối đa 255 ký tự.' }]}><Input autoComplete="name" maxLength={255} /></Form.Item>
    </fieldset>
    <fieldset><legend>Thông tin tổ chức</legend>
      <Form.Item label="Tên tổ chức" name="organizationName" normalize={(value: string) => value.trimStart()} rules={[{ required: true, whitespace: true, max: 255, message: 'Nhập tên tổ chức, tối đa 255 ký tự.' }]}><Input autoComplete="organization" maxLength={255} /></Form.Item>
    </fieldset>
    <fieldset><legend>Bảo mật tài khoản</legend>
      <Form.Item label="Mật khẩu" name="password" extra="12–128 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt." rules={[{ required: true, min: 12, max: 128 }, passwordComplexityRule]}><Input.Password autoComplete="new-password" maxLength={128} /></Form.Item>
      <Form.Item label="Xác nhận mật khẩu" name="passwordConfirmation" dependencies={['password']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, value) => !value || value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('Mật khẩu xác nhận không khớp.')) })]}><Input.Password autoComplete="new-password" maxLength={128} /></Form.Item>
    </fieldset>
    <Button block htmlType="submit" type="primary" loading={loading}>Hoàn tất đăng ký</Button>
  </Form>;
}
