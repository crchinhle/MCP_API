import { Alert, Button, Empty, Input, Modal, Spin } from 'antd';
import { useEffect, useState } from 'react';

import { describeApiError } from '../../application/auth/authContext';
import { licenseStatusLabel, finalityLabel, useLicenseLifecycle, usePhase6Command, useProviderLicenses } from '../../application/licenses/licenseQueries';
import { PageHeader, StatusChip } from '../components/WorkspacePrimitives';

const commandLabels: Record<string, string> = {
  PENDING: 'Đang chờ xử lý',
  SUBMITTED: 'Đã gửi lên blockchain',
  SUBMITTED_UNKNOWN: 'Chưa rõ kết quả, đang đối soát',
  CONFIRMED: 'Đã xác nhận',
  RETRYABLE_FAILED: 'Có thể thử lại',
  DEAD_LETTER: 'Cần kiểm tra thủ công',
  ABANDONED: 'Đã dừng theo dõi',
  SUPERSEDED: 'Đã thay thế',
};

export function ProviderLicensesScreen() {
  const licenses = useProviderLicenses();
  const lifecycle = useLicenseLifecycle();
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<{ licenseId: string; action: 'SUSPEND_LICENSE' | 'RESUME_LICENSE' | 'REVOKE_LICENSE' } | null>(null);
  const [command, setCommand] = useState<{ commandId: string; status: string; licenseId: string } | null>(null);
  const commandStatus = usePhase6Command(command?.commandId);
  const [errorByLicense, setErrorByLicense] = useState<Record<string, string>>({});

  useEffect(() => {
    if (commandStatus.data?.status === 'CONFIRMED') void licenses.refetch();
  }, [commandStatus.data?.status, licenses]);

  const run = () => {
    if (!selected) return;
    const current = selected;
    const note = reason.trim();
    lifecycle.mutate(
      { licenseId: current.licenseId, command: current.action, ...(note ? { reason: note } : {}) },
      {
        onSuccess: (result) => {
          setCommand({ commandId: result.commandId, status: result.status, licenseId: current.licenseId });
          setSelected(null);
          setReason('');
          setErrorByLicense((errors) => ({ ...errors, [current.licenseId]: '' }));
        },
        onError: (cause) => setErrorByLicense((errors) => ({ ...errors, [current.licenseId]: describeApiError(cause, 'Không thể gửi yêu cầu thay đổi trạng thái.') })),
      },
    );
  };

  return (
    <>
      <PageHeader title="Bản quyền nhà cung cấp" />
      {licenses.isPending ? <Spin aria-label="Đang tải license của nhà cung cấp" /> : null}
      {licenses.isError ? <Alert showIcon type="error" message="Không thể tải danh sách license." action={<Button onClick={() => void licenses.refetch()}>Thử lại</Button>} /> : null}
      {!licenses.isPending && !licenses.isError && licenses.data?.length === 0 ? <Empty description="Chưa có license." /> : null}
      {command ? (
        <Alert
          showIcon
          type={commandStatus.data?.status === 'CONFIRMED' ? 'success' : commandStatus.data?.status === 'DEAD_LETTER' ? 'error' : 'info'}
          message={`${commandLabels[commandStatus.data?.status ?? command.status] ?? 'Đang xử lý'} · ${command.commandId}`}
          description={commandStatus.data?.transactionHash ? `Transaction: ${commandStatus.data.transactionHash}` : 'Chưa cập nhật bản quyền cho đến khi blockchain xác nhận.'}
        />
      ) : null}
      <div className="stack-list">
        {(licenses.data ?? []).map((license) => {
          const rowPending = lifecycle.isPending && selected?.licenseId === license.id;
          return (
            <article className="workspace-card" key={license.id}>
              <div>
                <strong>{license.productName} · {license.publicLicenseId}</strong>
                <small>{license.plan.name} v{license.plan.version} · hết hạn {new Date(license.expiresAt).toLocaleDateString('vi-VN')}</small>
                <small>{finalityLabel(license.finality)} ({license.confirmationCount})</small>
              </div>
              <StatusChip tone={license.status === 'ACTIVE' ? 'success' : license.status === 'REVOKED' ? 'error' : 'warning'}>{licenseStatusLabel(license.status)}</StatusChip>
              {errorByLicense[license.id] ? <Alert type="error" showIcon message={errorByLicense[license.id]} /> : null}
              <div className="table-actions">
                {license.status === 'ACTIVE' ? <Button loading={rowPending} disabled={lifecycle.isPending} onClick={() => { setReason(''); setSelected({ licenseId: license.id, action: 'SUSPEND_LICENSE' }); }}>Tạm ngưng</Button> : null}
                {license.status === 'SUSPENDED' ? <Button loading={rowPending} disabled={lifecycle.isPending} onClick={() => { setReason(''); setSelected({ licenseId: license.id, action: 'RESUME_LICENSE' }); }}>Tiếp tục</Button> : null}
                {license.status === 'ACTIVE' || license.status === 'SUSPENDED' ? <Button danger loading={rowPending} disabled={lifecycle.isPending} onClick={() => { setReason(''); setSelected({ licenseId: license.id, action: 'REVOKE_LICENSE' }); }}>Thu hồi</Button> : null}
              </div>
            </article>
          );
        })}
      </div>
      <Modal
        open={Boolean(selected)}
        title={selected?.action === 'REVOKE_LICENSE' ? 'Xác nhận thu hồi bản quyền' : selected?.action === 'SUSPEND_LICENSE' ? 'Xác nhận tạm ngưng bản quyền' : 'Xác nhận tiếp tục bản quyền'}
        okText="Xác nhận"
        cancelText="Hủy"
        confirmLoading={lifecycle.isPending}
        okButtonProps={{ disabled: selected?.action !== 'RESUME_LICENSE' && reason.trim().length < 3 }}
        onCancel={() => { if (!lifecycle.isPending) { setSelected(null); setReason(''); } }}
        onOk={run}
      >
        <p>Thao tác chỉ áp dụng cho license đã chọn và sẽ được cập nhật sau khi blockchain xác nhận.</p>
        <Input.TextArea aria-label="Lý do thay đổi trạng thái license" placeholder="Lý do (ít nhất 3 ký tự)" value={reason} onChange={(event) => setReason(event.target.value)} />
      </Modal>
    </>
  );
}
