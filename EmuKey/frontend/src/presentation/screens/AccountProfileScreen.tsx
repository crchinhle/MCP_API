import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Form, Input, Modal, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  describeApiError,
  requestJson,
  type ProfileInput,
  useAuth,
} from '../../application/auth/authContext';
import { FactList, PageHeader } from '../components/WorkspacePrimitives';

const roleLabels: Record<string, string> = {
  CUSTOMER: 'Người mua',
  PROVIDER_ADMIN: 'Nhà cung cấp',
  SUPPORT_STAFF: 'Hỗ trợ',
  SYSTEM_ADMIN: 'Quản trị hệ thống',
};

const strongPasswordRules = [
  { min: 12, message: 'Mật khẩu phải có ít nhất 12 ký tự.' },
  { max: 128, message: 'Mật khẩu không được quá 128 ký tự.' },
  { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).+$/, message: 'Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt.' },
];

export function AccountProfileScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout, updateProfile, user } = useAuth();
  const [form] = Form.useForm<ProfileInput>();
  const profileValues = Form.useWatch([], form);
  const [passwordForm] = Form.useForm<{ currentPassword: string; password: string; confirm: string }>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(searchParams.get('password') === 'change');
  useEffect(() => {
    if (searchParams.get('password') === 'change') {
      setPasswordOpen(true);
      setSearchParams((previous) => { const next = new URLSearchParams(previous); next.delete('password'); return next; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    form.setFieldsValue({
      address: user?.address ?? '',
      displayName: user?.displayName ?? '',
      organizationName: user?.organizationName ?? '',
      phone: user?.phone ?? '',
    });
  }, [form, user]);

  if (!user) return null;
  const isSystem = user.role === 'SYSTEM_ADMIN';
  const dirty = (['displayName', 'phone', 'address', ...(user.role === 'PROVIDER_ADMIN' ? ['organizationName'] : [])] as (keyof ProfileInput)[]).some((key) => (profileValues?.[key] ?? '').trim() !== (user[key] ?? '').trim());
  const statusLabel = ({ ACTIVE: 'Đang hoạt động', LOCKED: 'Đã khóa', DISABLED: 'Đã vô hiệu hóa', PENDING_EMAIL_VERIFICATION: 'Chờ xác minh email' } as Record<string, string>)[user.status] ?? 'Chưa xác định';

  const submit = async (values: ProfileInput) => {
    if (isSystem && (!dirty || saving)) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateProfile({
        displayName: values.displayName.trim(),
        phone: values.phone?.trim() ?? '',
        address: values.address?.trim() ?? '',
        ...(user.role === 'PROVIDER_ADMIN'
          ? { organizationName: values.organizationName?.trim() ?? '' }
          : {}),
      });
      setSaved(true);
    } catch (cause) {
      setError(
        describeApiError(cause, 'Không thể cập nhật hồ sơ. Vui lòng thử lại.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const submitPassword = async (values: { currentPassword: string; password: string; confirm: string }) => {
    setPasswordError(null);
    setPasswordSaved(false);
    setPasswordSaving(true);
    try {
      await requestJson<void>('/auth/password', {
        body: JSON.stringify({ currentPassword: values.currentPassword, password: values.password }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      });
      setPasswordSaved(true);
      setPasswordOpen(false);
      passwordForm.resetFields();
      await logout();
    } catch (cause) {
      setPasswordError(describeApiError(cause, 'Không thể đổi mật khẩu. Vui lòng thử lại.'));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Hồ sơ tài khoản"
        action={!isSystem ? <Tag color={user.status === 'ACTIVE' ? 'green' : 'orange'}>{statusLabel}</Tag> : undefined}
      />
      <div className="workspace-two-column profile-layout">
        <section className="workspace-card section-card">
          <h2>{isSystem ? 'Thông tin cá nhân' : 'Thông tin hồ sơ'}</h2>
          <p className="muted-copy">{isSystem ? 'Cập nhật thông tin cá nhân và liên hệ.' : 'Cập nhật thông tin liên hệ và tổ chức.'}</p>
          <Form
            form={form}
            initialValues={{
              address: user.address ?? '',
              displayName: user.displayName,
              organizationName: user.organizationName ?? '',
              phone: user.phone ?? '',
            }}
            layout="vertical"
            onFinish={(values) => void submit(values)}
          >
            <Form.Item
              label="Tên hiển thị"
              name="displayName"
              rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên hiển thị.' }, { max: 255 }]}
            >
              <Input autoComplete="name" />
            </Form.Item>
            <Form.Item label="Số điện thoại" name="phone" rules={[{ max: 30 }]}>
              <Input autoComplete="tel" />
            </Form.Item>
            <Form.Item label="Địa chỉ" name="address" rules={[{ max: 500 }]}>
              <Input.TextArea autoComplete="street-address" rows={3} />
            </Form.Item>
            {user.role === 'PROVIDER_ADMIN' ? (
              <Form.Item
                label="Tên tổ chức"
                name="organizationName"
                rules={[{ max: 255 }]}
              >
                <Input autoComplete="organization" />
              </Form.Item>
            ) : null}
            {saved ? <Alert showIcon type="success" message="Đã cập nhật hồ sơ." /> : null}
            {error ? <Alert showIcon role="alert" type="error" message={error} /> : null}
            <><Button htmlType="submit" loading={saving} disabled={saving || (isSystem && !dirty)} type="primary">
              Lưu thay đổi
            </Button><LoadingOverlay active={saving} label="Đang xử lý yêu cầu: Lưu thay đổi" /></>
          </Form>
        </section>
        <aside className={isSystem ? 'system-profile-aside' : 'workspace-card section-card profile-summary'}>
          <section className={isSystem ? 'workspace-card section-card profile-summary' : undefined}>
          <h2>Tài khoản</h2>
          <FactList facts={[{ label: 'Email', value: user.email }, { label: 'Vai trò', value: roleLabels[user.role] ?? 'Chưa xác định' }, { label: 'Trạng thái', value: statusLabel }]} />
          <small>
            Email và vai trò được bảo vệ bởi hệ thống xác thực, không thay đổi tại màn hình này.
          </small>
          </section>
          <section className={isSystem ? 'workspace-card section-card' : undefined}>
          {isSystem ? <h2>Bảo mật</h2> : <h3>Bảo mật</h3>}
          {isSystem ? <p className="muted-copy">Sau khi đổi mật khẩu, bạn cần đăng nhập lại.</p> : null}
          <Button onClick={() => { setPasswordError(null); setPasswordOpen(true); }} type="default">Đổi mật khẩu</Button>
          </section>
          <Modal
            className="account-password-modal"
            destroyOnHidden
            footer={null}
            onCancel={() => { if (!passwordSaving) setPasswordOpen(false); }}
            open={passwordOpen}
            title="Đổi mật khẩu"
          >
              <Form
                form={passwordForm}
                layout="vertical"
                onFinish={(values) => void submitPassword(values)}
                validateTrigger="onBlur"
              >
                <Form.Item
                  label="Mật khẩu hiện tại"
                  name="currentPassword"
                  rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại.' }]}
                >
                  <Input.Password autoComplete="current-password" />
                </Form.Item>
                <Form.Item
                  label="Mật khẩu mới"
                  name="password"
                  rules={[{ required: true, message: 'Vui lòng nhập mật khẩu mới.' }, ...strongPasswordRules]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
                <Form.Item
                  dependencies={['password']}
                  label="Xác nhận mật khẩu mới"
                  name="confirm"
                  rules={[
                    { required: true, message: 'Vui lòng xác nhận mật khẩu mới.' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) return Promise.resolve();
                        return Promise.reject(new Error('Mật khẩu xác nhận không khớp.'));
                      },
                    }),
                  ]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
                {passwordSaved ? <Alert showIcon message="Đã đổi mật khẩu. Vui lòng đăng nhập lại." type="success" /> : null}
                {passwordError ? <Alert message={passwordError} role="alert" showIcon type="error" /> : null}
                <><Button htmlType="submit" disabled={passwordSaving} type="primary">Đổi mật khẩu</Button><LoadingOverlay active={passwordSaving} label="Đang xử lý yêu cầu: Đổi mật khẩu" /></>
              </Form>
          </Modal>
        </aside>
      </div>
    </>
  );
}
