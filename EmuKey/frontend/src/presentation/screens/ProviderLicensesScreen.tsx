import { LoadingOverlay } from '../components/WorkspacePrimitives';
import { Alert, Button, Empty, Input, Modal, Select, Table } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { describeApiError } from '../../application/auth/authContext';
import { licenseStatusLabel, finalityLabel, useLicenseLifecycle, usePhase6Command, useProviderLicenses } from '../../application/licenses/licenseQueries';
import { CopyableId, PageLoading, PageHeader, StatusChip, useDebouncedValue } from '../components/WorkspacePrimitives';

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
  const queryClient = useQueryClient();
  const refreshedCommand = useRef<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  useEffect(() => setPage(1), [search, statusFilter]);
  const lifecycle = useLicenseLifecycle();
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<{ licenseId: string; action: 'SUSPEND_LICENSE' | 'RESUME_LICENSE' | 'REVOKE_LICENSE' } | null>(null);
  const [command, setCommand] = useState<{ commandId: string; status: string; licenseId: string } | null>(null);
  const commandStatus = usePhase6Command(command?.commandId);
  const [errorByLicense, setErrorByLicense] = useState<Record<string, { message: string; action: NonNullable<typeof selected>['action']; reason: string } | undefined>>({});

  useEffect(() => {
    if (command?.commandId && commandStatus.data?.status === 'CONFIRMED' && refreshedCommand.current !== command.commandId) {
      refreshedCommand.current = command.commandId;
      void queryClient.invalidateQueries({ queryKey: ['licenses', 'provider'] });
    }
  }, [command?.commandId, commandStatus.data?.status, queryClient]);

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
          setErrorByLicense((errors) => ({ ...errors, [current.licenseId]: undefined }));
        },
        onError: (cause) => setErrorByLicense((errors) => ({ ...errors, [current.licenseId]: { message: describeApiError(cause, 'Không thể gửi yêu cầu thay đổi trạng thái.'), action: current.action, reason: note } })),
      },
    );
  };

  if (licenses.isLoading) return <PageLoading />;

  return (
    <>
      <PageHeader title="Bản quyền nhà cung cấp" />
      <div className="inline-filter"><Input.Search aria-label="Tìm bản quyền" placeholder="Tên sản phẩm hoặc mã tra cứu" value={search} onChange={(event) => setSearch(event.target.value)} /><Select aria-label="Lọc trạng thái bản quyền" value={statusFilter} onChange={setStatusFilter} options={['', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'PENDING_ONCHAIN'].map((value) => ({ value, label: value ? licenseStatusLabel(value) : 'Tất cả trạng thái' }))} /></div>

      {licenses.isError ? <Alert showIcon type="error" message="Không thể tải danh sách license." action={<Button onClick={() => void licenses.refetch()}>Thử lại</Button>} /> : null}
      {commandStatus.isError ? <Alert showIcon type="error" title="Không thể tải trạng thái yêu cầu" action={<Button disabled={commandStatus.isFetching} onClick={() => void commandStatus.refetch()}>Thử lại</Button>} /> : null}
      {!licenses.isPending && !licenses.isError && licenses.data?.length === 0 ? <Empty description="Chưa có license." /> : null}
      {command ? (
        <Alert
          showIcon
          type={commandStatus.data?.status === 'CONFIRMED' ? 'success' : commandStatus.data?.status === 'DEAD_LETTER' ? 'error' : 'info'}
          title={commandLabels[commandStatus.data?.status ?? command.status] ?? 'Đang xử lý'}
          description={<><p>{commandStatus.data?.status === 'CONFIRMED' ? 'Bản quyền đã được cập nhật.' : 'Bản quyền sẽ được cập nhật sau khi blockchain xác nhận.'}</p><details><summary>Chi tiết kỹ thuật</summary><p>Mã yêu cầu: {command.commandId}</p>{commandStatus.data?.transactionHash ? <p>Giao dịch: {commandStatus.data.transactionHash}</p> : null}</details></>}
        />
      ) : null}
      <Table
        rowKey="id"
        scroll={{ x: 900 }}
        pagination={{ current: page, onChange: setPage, pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
        locale={{ emptyText: 'Không có bản quyền phù hợp.' }}
        dataSource={(licenses.data ?? []).filter((license) => (!statusFilter || license.status === statusFilter) && `${license.productName} ${license.publicLicenseId} ${license.plan.name}`.toLocaleLowerCase('vi').includes(debouncedSearch.trim().toLocaleLowerCase('vi')))}
        columns={[
          { title: 'Sản phẩm / mã tra cứu', render: (_, license) => <><strong>{license.productName}</strong><CopyableId value={license.publicLicenseId} /></> },
          { title: 'Gói / thời hạn', render: (_, license) => <>{license.plan.name} v{license.plan.version}<p>Hết hạn {new Date(license.expiresAt).toLocaleDateString('vi-VN')}</p></> },
          { title: 'Thiết bị', render: (_, license) => <>Thiết bị đang dùng: {license.activeDeviceCount}/{license.maxActiveDevices}</> },
          { title: 'Trạng thái', render: (_, license) => <><StatusChip tone={license.status === 'ACTIVE' ? 'success' : license.status === 'REVOKED' ? 'error' : 'warning'}>{licenseStatusLabel(license.status)}</StatusChip><p>{finalityLabel(license.finality)} ({license.confirmationCount})</p></> },
          { title: 'Thao tác', render: (_, license) => {
            const rowPending = lifecycle.isPending && selected?.licenseId === license.id;
            const failure = errorByLicense[license.id];
            return <>{failure ? <Alert type="error" title={failure.message} action={<Button disabled={lifecycle.isPending} onClick={() => { setReason(failure.reason); setSelected({ licenseId: license.id, action: failure.action }); }}>Thử lại</Button>} /> : null}
              <div className="table-actions">
                {license.status === 'ACTIVE' ? <><Button  disabled={(lifecycle.isPending) || (rowPending)} onClick={() => { setReason(''); setSelected({ licenseId: license.id, action: 'SUSPEND_LICENSE' }); }}>Tạm ngưng</Button><LoadingOverlay active={rowPending} label="Đang xử lý yêu cầu: Tạm ngưng" /></> : null}
                {license.status === 'SUSPENDED' ? <><Button  disabled={(lifecycle.isPending) || (rowPending)} onClick={() => { setReason(''); setSelected({ licenseId: license.id, action: 'RESUME_LICENSE' }); }}>Tiếp tục</Button><LoadingOverlay active={rowPending} label="Đang xử lý yêu cầu: Tiếp tục" /></> : null}
                {license.status === 'ACTIVE' || license.status === 'SUSPENDED' ? <><Button danger  disabled={(lifecycle.isPending) || (rowPending)} onClick={() => { setReason(''); setSelected({ licenseId: license.id, action: 'REVOKE_LICENSE' }); }}>Thu hồi</Button><LoadingOverlay active={rowPending} label="Đang xử lý yêu cầu: Thu hồi" /></> : null}
              </div>
            </>;
          } },
        ]}
      />
      <Modal
        destroyOnHidden
        open={Boolean(selected)}
        title={selected?.action === 'REVOKE_LICENSE' ? 'Xác nhận thu hồi bản quyền' : selected?.action === 'SUSPEND_LICENSE' ? 'Xác nhận tạm ngưng bản quyền' : 'Xác nhận tiếp tục bản quyền'}
        okText="Xác nhận"
        cancelText="Hủy"

        okButtonProps={{ ...({ disabled: selected?.action !== 'RESUME_LICENSE' && reason.trim().length < 3 }), disabled: (selected?.action !== 'RESUME_LICENSE' && reason.trim().length < 3) || (lifecycle.isPending) }}
        onCancel={() => { if (!lifecycle.isPending) { setSelected(null); setReason(''); } }}
        onOk={run}
      >
        <LoadingOverlay active={Boolean(selected) && (lifecycle.isPending)} />
        <p>Thao tác chỉ áp dụng cho license đã chọn và sẽ được cập nhật sau khi blockchain xác nhận.</p>
        <Input.TextArea aria-label="Lý do thay đổi trạng thái license" placeholder="Lý do (ít nhất 3 ký tự)" value={reason} onChange={(event) => setReason(event.target.value)} />
      </Modal>
    </>
  );
}
