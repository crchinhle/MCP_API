import { Alert, Button, Input, Popconfirm } from 'antd';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePhase6Command, useRecoverActivationKey, useRequestLicensingActionVerification, useRetrieveActivationKey } from '../../application/licenses/licenseQueries';

export function LicenseRecoveryPanel({ licenseId, initialToken, onKey }: {
  readonly licenseId: string;
  readonly initialToken: string;
  readonly onKey: (licenseId: string, key: string) => void;
}) {
  const [params, setParams] = useSearchParams();
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [command, setCommand] = useState<{ commandId: string; licenseId: string } | undefined>(() => {
    const id = params.get('recoveryCommand');
    return id && params.get('recoveryLicense') === licenseId ? { commandId: id, licenseId } : undefined;
  });
  const [received, setReceived] = useState(false);
  const [error, setError] = useState('');
  const email = useRequestLicensingActionVerification();
  const recover = useRecoverActivationKey();
  const retrieve = useRetrieveActivationKey();
  const status = usePhase6Command(command?.commandId);
  const submit = async () => {
    setError('');
    try {
      const result = await recover.mutateAsync({ licenseId, input: { actionToken: token.trim(), currentPassword: password } });
      setCommand(result);
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('actionToken');
        next.set('recoveryCommand', result.commandId);
        next.set('recoveryLicense', result.licenseId);
        next.set('licenseId', result.licenseId);
        next.set('recover', '1');
        return next;
      }, { replace: true });
      setPassword(''); setToken(''); setReceived(false);
    } catch {
      setError('Không thể khôi phục. Kiểm tra đúng bản quyền, mật khẩu và mã email còn hạn; nếu yêu cầu trước bị mất kết nối, kiểm tra trạng thái trước khi gửi lại.');
    } finally { recover.reset(); }
  };
  return <section className="buyer-license-action-panel" aria-label="Khôi phục mã bản quyền">
    <h3>Khôi phục mã bị mất</h3>
    <p>Khôi phục sẽ thay thế mã cũ. Chỉ nhận mã mới sau khi blockchain xác nhận. Chọn đúng bản quyền trước khi gửi yêu cầu.</p>
    {!command ? <>
      <Button loading={email.isPending} onClick={() => email.mutate({ licenseId, action: 'KEY_RECOVERY' })}>Gửi email khôi phục</Button>
      {email.isSuccess ? <Alert type="success" title="Đã gửi email. Dán mã xác nhận trong email vào ô bên dưới." /> : null}
      {email.isError ? <Alert type="error" title="Không thể gửi email khôi phục. Vui lòng thử lại." /> : null}
      <Input aria-label="Mã xác nhận khôi phục" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Mã xác nhận từ email" />
      <Input.Password aria-label="Mật khẩu xác nhận khôi phục" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mật khẩu hiện tại" />
      <Popconfirm title="Thay thế mã bản quyền cũ?" description="Mã cũ sẽ không còn dùng được sau khi giao dịch được xác nhận." okText="Khôi phục" cancelText="Giữ lại" onConfirm={() => void submit()}>
        <Button danger loading={recover.isPending} disabled={!token.trim() || !password}>Xác nhận khôi phục</Button>
      </Popconfirm>
    </> : <>
      <Alert type={status.data?.status === 'CONFIRMED' ? 'success' : 'info'} title={`Yêu cầu ${command.commandId}: ${status.data?.status ?? 'Đang kiểm tra'}`} description="Bạn có thể giữ mã yêu cầu này để liên hệ hỗ trợ khi cần." />
      {status.isError ? <Alert type="error" title="Không thể tải trạng thái yêu cầu" action={<Button onClick={() => void status.refetch()}>Thử lại</Button>} /> : null}
      {['DEAD_LETTER', 'ABANDONED', 'SUPERSEDED'].includes(status.data?.status ?? '') ? <Alert type="warning" title="Yêu cầu cần được kiểm tra" description={<a href="/buyer/support">Liên hệ hỗ trợ, không tự tạo thêm yêu cầu.</a>} /> : null}
      {status.data?.status === 'CONFIRMED' ? <Button type="primary" disabled={received} loading={retrieve.isPending} onClick={() => retrieve.mutate({ id: command.licenseId }, { onSuccess: (result) => { onKey(command.licenseId, result.activationKey); setReceived(true); } })}>Nhận mã khôi phục</Button> : null}
      {retrieve.isError ? <Alert type="error" title="Không thể nhận mã mới. Mã có thể đã được nhận; vui lòng kiểm tra trước khi thử lại." /> : null}
      {received ? <Alert type="success" title="Mã mới đã hiển thị trong phần Mã bản quyền. Hãy sao chép và lưu an toàn." /> : null}
    </>}
    {error ? <Alert type="error" title={error} /> : null}
  </section>;
}
