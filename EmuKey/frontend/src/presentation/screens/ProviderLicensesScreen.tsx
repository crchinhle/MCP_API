import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Pagination,
  Select,
  Skeleton,
  Table,
  Tooltip,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { LicenseProjectionDto } from '../../infrastructure/api/generated';
import { describeApiError } from '../../application/auth/authContext';
import {
  providerActionLabels,
  providerFinalityLabels,
  providerLicenseActions,
  providerLicenseDate,
  providerLicenseLabels,
  useLicenseLifecycle,
  usePhase6Command,
  useProviderLicenses,
  type ProviderLifecycleAction,
} from '../../application/licenses/licenseQueries';
import {
  PageHeader,
  useDebouncedValue,
} from '../components/WorkspacePrimitives';
import {
  ProviderLicenseActions,
  ProviderLicenseId,
  ProviderLicenseStatus,
} from '../components/ProviderLicenseSummary';
import { ProviderLicenseDetailsDrawer } from '../components/ProviderLicenseDetailsDrawer';
import { paginationTextControls } from '../theme';

const mobileQuery = '(max-width: 767px)';
const subscribeMobile = (notify: () => void) => {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const commandMessages: Record<string, [string, string]> = {
  PENDING: ['Đang chờ xử lý', 'Hệ thống đang xử lý và chờ xác nhận.'],
  SUBMITTED: [
    'Yêu cầu đang được xử lý',
    'Yêu cầu đã được gửi lên blockchain và đang chờ xác nhận.',
  ],
  SUBMITTED_UNKNOWN: [
    'Đang kiểm tra kết quả yêu cầu',
    'Hệ thống đang đối soát kết quả. Vui lòng kiểm tra trạng thái trước khi thực hiện lại.',
  ],
  CONFIRMED: [
    'Đã xác nhận',
    'Yêu cầu đã được xác nhận. Đang cập nhật trạng thái bản quyền.',
  ],
  RETRYABLE_FAILED: [
    'Yêu cầu chưa hoàn tất',
    'Vui lòng kiểm tra trạng thái trước khi thực hiện lại.',
  ],
  DEAD_LETTER: [
    'Yêu cầu cần được kiểm tra thêm',
    'Vui lòng liên hệ bộ phận hỗ trợ.',
  ],
  ABANDONED: [
    'Đã dừng theo dõi yêu cầu',
    'Vui lòng kiểm tra trạng thái bản quyền mới nhất trước khi thực hiện lại.',
  ],
  SUPERSEDED: [
    'Yêu cầu đã được thay thế',
    'Vui lòng kiểm tra trạng thái bản quyền mới nhất.',
  ],
};
const targetStatuses = {
  SUSPEND_LICENSE: 'SUSPENDED',
  RESUME_LICENSE: 'ACTIVE',
  REVOKE_LICENSE: 'REVOKED',
};

export function ProviderLicensesScreen() {
  const licenses = useProviderLicenses();
  const queryClient = useQueryClient();
  const isMobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const debouncedSearch = useDebouncedValue(search);
  const requestedStatus = params.get('status') ?? '';
  const status = Object.hasOwn(providerLicenseLabels, requestedStatus)
    ? requestedStatus
    : '';
  const requestedFinality = params.get('finality') ?? '';
  const finality = Object.hasOwn(providerFinalityLabels, requestedFinality)
    ? requestedFinality
    : '';
  const setFilter = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        return next;
      },
      { replace: key === 'q' },
    );
  const clearFilters = () =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      ['q', 'status', 'finality', 'page'].forEach((key) => next.delete(key));
      return next;
    });
  const rows = (licenses.data ?? []).filter(
    (license) =>
      (!status || license.status === status) &&
      (!finality || license.finality === finality) &&
      `${license.productName} ${license.publicLicenseId} ${license.plan.name}`
        .toLocaleLowerCase('vi')
        .includes(debouncedSearch.trim().toLocaleLowerCase('vi')),
  );
  const requestedPage = Number(params.get('page') ?? 1);
  const page = Math.min(
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1,
    Math.max(1, Math.ceil(rows.length / 10)),
  );
  const detailId = params.get('licenseId');
  const setDetailId = (id: string | null) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    if (id) next.set('licenseId', id);
    else next.delete('licenseId');
    return next;
  });
  const detail = licenses.data?.find((license) => license.id === detailId);
  const lifecycle = useLicenseLifecycle();
  const sending = useRef(false);
  const refreshedCommand = useRef<string | undefined>(undefined);
  const [selected, setSelected] = useState<{
    licenseId: string;
    action: ProviderLifecycleAction;
  } | null>(null);
  const selectedLicense = licenses.data?.find(
    (license) => license.id === selected?.licenseId,
  );
  const [reason, setReason] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [command, setCommand] = useState<{
    commandId: string;
    status: string;
    licenseId: string;
    action: ProviderLifecycleAction;
  } | null>(null);
  const commandStatus = usePhase6Command(command?.commandId);
  const currentCommandStatus =
    commandStatus.data?.status ?? command?.status ?? '';
  const commandProjection = licenses.data?.find(
    (license) => license.id === command?.licenseId,
  );
  const projectionUpdated = Boolean(
    command && commandProjection?.status === targetStatuses[command.action],
  );
  const commandUnresolved = Boolean(
    command &&
    !['CONFIRMED', 'DEAD_LETTER', 'ABANDONED', 'SUPERSEDED'].includes(
      currentCommandStatus,
    ),
  );
  const disabledFor = (id: string) =>
    licenses.isError ||
    lifecycle.isPending ||
    commandUnresolved ||
    Boolean(
      command?.licenseId === id &&
      !(currentCommandStatus === 'CONFIRMED' && projectionUpdated),
    );

  useEffect(() => {
    if (!command || currentCommandStatus !== 'CONFIRMED') return;
    if (refreshedCommand.current !== command.commandId) {
      refreshedCommand.current = command.commandId;
      void queryClient.invalidateQueries({
        queryKey: ['licenses', 'provider'],
      });
    }
    if (projectionUpdated) return;
    const timer = window.setInterval(() => {
      void queryClient.invalidateQueries({
        queryKey: ['licenses', 'provider'],
      });
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [command, currentCommandStatus, projectionUpdated, queryClient]);

  const selectAction = (
    license: LicenseProjectionDto,
    action: ProviderLifecycleAction,
  ) => {
    if (
      disabledFor(license.id) ||
      !providerLicenseActions(license).includes(action)
    )
      return;
    setReason('');
    setMutationError('');
    setSelected({ licenseId: license.id, action });
  };
  const validReason =
    selected?.action === 'RESUME_LICENSE' || reason.trim().length >= 3;
  const run = () => {
    if (
      !selected ||
      !selectedLicense ||
      !validReason ||
      sending.current ||
      disabledFor(selected.licenseId) ||
      !providerLicenseActions(selectedLicense).includes(selected.action)
    )
      return;
    sending.current = true;
    setMutationError('');
    const current = selected;
    const note = reason.trim();
    lifecycle.mutate(
      {
        licenseId: current.licenseId,
        command: current.action,
        ...(note ? { reason: note } : {}),
      },
      {
        onSuccess: (result) => {
          setCommand({
            ...current,
            commandId: result.commandId,
            status: result.status,
          });
          setSelected(null);
          setReason('');
        },
        onError: (cause) =>
          setMutationError(
            describeApiError(
              cause,
              'Không thể gửi yêu cầu thay đổi trạng thái. Vui lòng thử lại.',
            ),
          ),
        onSettled: () => {
          sending.current = false;
        },
      },
    );
  };
  const renderActions = (license: LicenseProjectionDto) => (
    <div className="provider-license-actions">
      <Button type="link" onClick={() => setDetailId(license.id)}>
        Xem chi tiết
      </Button>
      <ProviderLicenseActions
        license={license}
        disabled={disabledFor(license.id)}
        pending={lifecycle.isPending && selected?.licenseId === license.id}
        onAction={(action) => selectAction(license, action)}
      />
    </div>
  );
  const identity = (license: LicenseProjectionDto) => (
    <div className="provider-license-cell">
      <button
        type="button"
        className="provider-license-product"
        onClick={() => setDetailId(license.id)}
      >
        {license.productName}
      </button>
      <ProviderLicenseId value={license.publicLicenseId} />
    </div>
  );
  const plan = (license: LicenseProjectionDto) => (
    <div className="provider-license-cell">
      <span>
        {license.plan.name}{' '}
        <span className="provider-license-meta">v{license.plan.version}</span>
      </span>
      <span className="provider-license-meta">
        {Number.isFinite(Date.parse(license.expiresAt))
          ? `Hết hạn ${providerLicenseDate(license.expiresAt)}`
          : 'Chưa có thông tin'}
      </span>
    </div>
  );
  const devices = (license: LicenseProjectionDto) => (
    <Tooltip title="Số thiết bị đang kích hoạt / giới hạn thiết bị cho phép">
      <span className="provider-license-devices">
        {license.activeDeviceCount}/{license.maxActiveDevices}
      </span>
    </Tooltip>
  );
  const commandMessage = commandMessages[currentCommandStatus] ?? [
    'Đang kiểm tra yêu cầu',
    'Vui lòng tải lại trạng thái để kiểm tra thông tin mới nhất.',
  ];
  const actionLabel = selected
    ? providerActionLabels[selected.action].toLocaleLowerCase('vi')
    : '';

  return (
    <div className="provider-licenses-screen">
      {licenses.isSuccess && detailId && !detail ? <Alert showIcon type="warning" title="Không tìm thấy bản quyền trong danh sách của bạn." action={<Button onClick={() => setDetailId(null)}>Đóng</Button>} /> : null}
      <PageHeader
        title="Bản quyền"
      />
      <div className="provider-license-toolbar">
        <Input
          className="provider-license-search"
          prefix={<SearchOutlined />}
          aria-label="Tìm bản quyền"
          placeholder="Tìm tên sản phẩm hoặc mã bản quyền"
          allowClear
          value={search}
          onChange={(event) => setFilter('q', event.target.value)}
        />
        <Select
          aria-label="Lọc trạng thái bản quyền"
          value={status}
          onChange={(value) => setFilter('status', value)}
          options={[
            { value: '', label: 'Tất cả trạng thái' },
            ...Object.entries(providerLicenseLabels).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <details
          className="provider-license-advanced"
          open={finality ? true : undefined}
        >
          <summary>Bộ lọc nâng cao{finality ? ' (1)' : ''}</summary>
          <Select
            aria-label="Lọc blockchain"
            value={finality}
            onChange={(value) => setFilter('finality', value)}
            options={[
              { value: '', label: 'Tất cả tình trạng blockchain' },
              ...Object.entries(providerFinalityLabels).map(
                ([value, label]) => ({
                  value,
                  label: value === 'CONFIRMED' ? 'Đã xác nhận' : label,
                }),
              ),
            ]}
          />
        </details>
      </div>
      {!licenses.isPending && !licenses.isError ? (
        <p className="provider-license-results" role="status">
          {rows.length} bản quyền
          {rows.some((license) => license.status === 'PENDING_ONCHAIN')
            ? ` · ${rows.filter((license) => license.status === 'PENDING_ONCHAIN').length} đang phát hành`
            : ''}
        </p>
      ) : null}
      {command ? (
        <Alert
          className="provider-license-command"
          showIcon
          type={
            currentCommandStatus === 'CONFIRMED'
              ? 'success'
              : currentCommandStatus === 'DEAD_LETTER'
                ? 'error'
                : ['RETRYABLE_FAILED', 'ABANDONED', 'SUPERSEDED'].includes(
                      currentCommandStatus,
                    )
                  ? 'warning'
                  : 'info'
          }
          title={commandMessage[0]}
          description={
            <>
              <p>
                {['PENDING', 'SUBMITTED', 'SUBMITTED_UNKNOWN'].includes(
                  currentCommandStatus,
                )
                  ? `Đã tiếp nhận yêu cầu ${providerActionLabels[command.action].toLocaleLowerCase('vi')}. `
                  : ''}
                {currentCommandStatus === 'CONFIRMED' && projectionUpdated
                  ? 'Yêu cầu đã được xác nhận. Trạng thái bản quyền đã được cập nhật.'
                  : commandMessage[1]}
              </p>
              <details className="provider-license-technical">
                <summary>Thông tin kỹ thuật</summary>
                <p>Mã yêu cầu: {command.commandId}</p>
                <p>Trạng thái yêu cầu: {currentCommandStatus}</p>
                {commandStatus.data?.transactionHash ? (
                  <p>Giao dịch: {commandStatus.data.transactionHash}</p>
                ) : null}
              </details>
            </>
          }
        />
      ) : null}
      {commandStatus.isError ? (
        <Alert
          showIcon
          type="error"
          title="Không thể tải trạng thái yêu cầu"
          action={
            <Button
              loading={commandStatus.isFetching}
              onClick={() => void commandStatus.refetch()}
            >
              Thử lại
            </Button>
          }
        />
      ) : null}
      {licenses.isPending ? (
        <div
          className="provider-license-skeleton"
          role="status"
          aria-label="Đang tải danh sách bản quyền"
          aria-busy="true"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <div className="provider-license-skeleton-row" key={index}>
              {Array.from({ length: isMobile ? 1 : 5 }, (_, cell) => (
                <Skeleton
                  key={cell}
                  active
                  title={false}
                  paragraph={{ rows: 2 }}
                />
              ))}
            </div>
          ))}
        </div>
      ) : licenses.isError ? (
        <Alert
          showIcon
          type="error"
          title="Không thể tải danh sách bản quyền"
          action={
            <Button
              loading={licenses.isFetching}
              onClick={() => void licenses.refetch()}
            >
              Thử lại
            </Button>
          }
        />
      ) : !rows.length ? (
        <div className="provider-license-empty">
          <Empty
            description={
              <>
                <strong>
                  {licenses.data?.length
                    ? 'Không tìm thấy bản quyền phù hợp'
                    : 'Chưa có bản quyền nào được phát hành'}
                </strong>
                <p>
                  {licenses.data?.length
                    ? 'Thử thay đổi từ khóa hoặc bộ lọc.'
                    : 'Các bản quyền sẽ xuất hiện tại đây khi khách hàng hoàn tất quy trình mua và hệ thống ghi nhận dữ liệu phát hành.'}
                </p>
              </>
            }
          />
          {search || status || finality ? (
            <Button onClick={clearFilters}>Xóa bộ lọc</Button>
          ) : null}
        </div>
      ) : (
        <>
          {isMobile ? (
            <ul className="provider-license-mobile-list">
              {rows.slice((page - 1) * 10, page * 10).map((license) => (
                <li key={license.id}>
                  {identity(license)}
                  <ProviderLicenseStatus license={license} />
                  {plan(license)}
                  <div>Thiết bị: {devices(license)}</div>
                  {renderActions(license)}
                </li>
              ))}
            </ul>
          ) : (
            <Table<LicenseProjectionDto>
              className="provider-license-table"
              rowKey="id"
              tableLayout="fixed"
              scroll={{ x: 860 }}
              pagination={false}
              dataSource={rows.slice((page - 1) * 10, page * 10)}
              columns={[
                {
                  title: 'Sản phẩm / mã bản quyền',
                  width: '30%',
                  render: (_, license) => identity(license),
                },
                {
                  title: 'Gói cấp phép',
                  width: '20%',
                  render: (_, license) => plan(license),
                },
                {
                  title: 'Trạng thái',
                  width: '24%',
                  render: (_, license) => (
                    <ProviderLicenseStatus license={license} />
                  ),
                },
                {
                  title: 'Thiết bị',
                  width: '10%',
                  render: (_, license) => devices(license),
                },
                {
                  title: 'Thao tác',
                  width: 164,
                  render: (_, license) => renderActions(license),
                },
              ]}
            />
          )}
          <Pagination
            className="provider-license-pagination"
            {...paginationTextControls}
            current={page}
            total={rows.length}
            pageSize={10}
            showSizeChanger={false}
            hideOnSinglePage
            onChange={(next) => setFilter('page', String(next))}
          />
        </>
      )}
      <ProviderLicenseDetailsDrawer
        fullScreen={isMobile}
        license={detail}
        onClose={() => setDetailId(null)}
        onRefresh={() => void licenses.refetch()}
        refreshing={licenses.isFetching}
        refreshError={licenses.isError}
        disabled={detail ? disabledFor(detail.id) : true}
        pending={lifecycle.isPending && selected?.licenseId === detailId}
        onAction={(action) => {
          if (detail) selectAction(detail, action);
        }}
        command={
          command?.licenseId === detailId
            ? {
                commandId: command.commandId,
                transactionHash: commandStatus.data?.transactionHash,
              }
            : undefined
        }
      />
      <Modal
        destroyOnHidden
        open={Boolean(selected)}
        title={`${selected ? providerActionLabels[selected.action] : ''} bản quyền?`}
        okText={`Xác nhận ${actionLabel}`}
        cancelText="Hủy"
        confirmLoading={lifecycle.isPending}
        okButtonProps={{
          danger: selected?.action === 'REVOKE_LICENSE',
          disabled:
            !validReason ||
            lifecycle.isPending ||
            !selectedLicense ||
            Boolean(selected && disabledFor(selected.licenseId)),
        }}
        cancelButtonProps={{ disabled: lifecycle.isPending }}
        keyboard={!lifecycle.isPending}
        mask={{ closable: !lifecycle.isPending }}
        onCancel={() => {
          if (!lifecycle.isPending) {
            setSelected(null);
            setMutationError('');
          }
        }}
        onOk={run}
      >
        <div className="provider-license-confirmation">
          <p>
            {selected?.action === 'REVOKE_LICENSE'
              ? 'Đây là thao tác có ảnh hưởng đến quyền sử dụng phần mềm. Vui lòng kiểm tra đúng bản quyền trước khi xác nhận.'
              : selected?.action === 'RESUME_LICENSE'
                ? 'Bạn đang yêu cầu chuyển bản quyền trở lại trạng thái hoạt động. Yêu cầu sẽ được xử lý và cập nhật theo quy trình blockchain của hệ thống.'
                : 'Yêu cầu tạm ngưng sẽ được xử lý và cập nhật trạng thái theo quy trình blockchain của hệ thống.'}
          </p>
          <strong>{selectedLicense?.productName}</strong>
          <code>{selectedLicense?.publicLicenseId}</code>
          {mutationError ? (
            <Alert showIcon type="error" title={mutationError} />
          ) : null}
          <label htmlFor="provider-license-reason">
            Lý do {actionLabel}
            {selected?.action === 'RESUME_LICENSE' ? ' (không bắt buộc)' : ''}
          </label>
          <Input.TextArea
            id="provider-license-reason"
            disabled={lifecycle.isPending}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            aria-describedby="provider-license-reason-help"
          />
          <span
            id="provider-license-reason-help"
            className="provider-license-meta"
          >
            {selected?.action === 'RESUME_LICENSE'
              ? 'Bạn có thể bổ sung lý do cho yêu cầu này.'
              : 'Nhập lý do có ít nhất 3 ký tự.'}
          </span>
        </div>
      </Modal>
    </div>
  );
}
