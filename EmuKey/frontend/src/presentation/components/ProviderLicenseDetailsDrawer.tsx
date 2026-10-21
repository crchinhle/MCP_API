import { Alert, Button, Descriptions, Drawer } from 'antd';
import type { LicenseProjectionDto } from '../../infrastructure/api/generated';
import {
  providerFinalityLabel,
  providerLicenseDate,
  providerLicenseLabels,
  type ProviderLifecycleAction,
} from '../../application/licenses/licenseQueries';
import {
  ProviderLicenseActions,
  ProviderLicenseId,
  ProviderLicenseStatus,
} from './ProviderLicenseSummary';

const currentSituation: Record<
  LicenseProjectionDto['status'],
  [string, string]
> = {
  PENDING_ONCHAIN: [
    'Đang hoàn tất phát hành bản quyền',
    'Hệ thống chưa ghi nhận đủ xác nhận blockchain để hoàn tất quá trình phát hành. Trạng thái này chưa đồng nghĩa với lỗi.',
  ],
  ACTIVE: [
    'Bản quyền đang có hiệu lực',
    'Bản quyền đã được ghi nhận theo trạng thái hiện tại của hệ thống.',
  ],
  SUSPENDED: [
    'Bản quyền đang tạm ngưng',
    'Bản quyền hiện bị tạm ngưng. Nhà cung cấp có thể yêu cầu tiếp tục sử dụng nếu điều kiện nghiệp vụ cho phép.',
  ],
  EXPIRED: [
    'Bản quyền đã hết hạn',
    'Thời hạn sử dụng đã kết thúc theo trạng thái hiện tại của hệ thống.',
  ],
  REVOKED: [
    'Bản quyền đã bị thu hồi',
    'Bản quyền không còn hiệu lực sử dụng theo trạng thái hiện tại.',
  ],
};

export function ProviderLicenseDetailsDrawer({
  license,
  onClose,
  onRefresh,
  refreshing,
  refreshError,
  disabled,
  pending,
  onAction,
  command,
  fullScreen,
}: {
  readonly license: LicenseProjectionDto | undefined;
  readonly onClose: () => void;
  readonly onRefresh: () => void;
  readonly refreshing: boolean;
  readonly refreshError: boolean;
  readonly disabled: boolean;
  readonly pending: boolean;
  readonly onAction: (action: ProviderLifecycleAction) => void;
  readonly command:
    | { commandId: string; transactionHash: string | null | undefined }
    | undefined;
  readonly fullScreen: boolean;
}) {
  const situation = license ? currentSituation[license.status] : undefined;
  const needsSupport =
    license && ['REORGED', 'UNTRUSTED_REORG'].includes(license.finality);
  return (
    <Drawer
      rootClassName="provider-license-drawer"
      title="Chi tiết bản quyền"
      size={fullScreen ? '100vw' : 'min(580px, 100vw)'}
      open={Boolean(license)}
      onClose={onClose}
      destroyOnHidden
      onKeyDown={(event) => {
        // Keep Tab inside the panel, including the native technical-details summary.
        // Match RoleShell's boundary wrapping; the library otherwise allows focus on body.
        if (event.key !== 'Tab') return;
        const elements = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], [tabindex="0"], summary',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = elements[0];
        const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      {license && situation ? (
        <>
          <header className="provider-license-drawer-header">
            <h2>{license.productName}</h2>
            <ProviderLicenseId value={license.publicLicenseId} />
            <ProviderLicenseStatus license={license} secondary={false} />
          </header>
          <section className="provider-license-section">
            <h3>Tình trạng hiện tại</h3>
            <Alert
              showIcon
              type={
                license.status === 'PENDING_ONCHAIN'
                  ? 'info'
                  : license.status === 'ACTIVE'
                    ? 'success'
                    : 'warning'
              }
              title={situation[0]}
              description={situation[1]}
            />
            <p>
              Tình trạng ghi nhận: {providerFinalityLabel(license.finality)}
            </p>
            {needsSupport ? (
              <Alert
                showIcon
                type="warning"
                title="Cần kiểm tra dữ liệu blockchain"
                description="Vui lòng liên hệ bộ phận hỗ trợ để kiểm tra tình trạng ghi nhận. Trạng thái bản quyền phía trên được giữ theo dữ liệu hệ thống."
              />
            ) : null}
            {license.finality === 'PROJECTION_STALE' ? (
              <p>
                Dữ liệu đang được đồng bộ lại. Vui lòng tải lại trạng thái để
                kiểm tra thông tin mới nhất.
              </p>
            ) : null}
            {refreshError ? (
              <Alert
                type="error"
                showIcon
                title="Không thể tải lại trạng thái. Thông tin đang hiển thị có thể chưa cập nhật."
              />
            ) : null}
            <Button loading={refreshing} onClick={onRefresh}>
              Tải lại trạng thái
            </Button>
          </section>
          <section className="provider-license-section">
            <h3>Thông tin bản quyền</h3>
            <Descriptions
              column={1}
              items={[
                {
                  key: 'product',
                  label: 'Sản phẩm',
                  children: license.productName,
                },
                {
                  key: 'plan',
                  label: 'Gói cấp phép',
                  children: license.plan.name,
                },
                {
                  key: 'version',
                  label: 'Phiên bản gói',
                  children: license.plan.version,
                },
                {
                  key: 'id',
                  label: 'Mã bản quyền',
                  children: <ProviderLicenseId value={license.publicLicenseId} />,
                },
                {
                  key: 'created',
                  label: 'Ngày phát hành / tạo',
                  children: providerLicenseDate(license.createdAt),
                },
                {
                  key: 'expiry',
                  label: 'Ngày hết hạn',
                  children: providerLicenseDate(license.expiresAt),
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  children: providerLicenseLabels[license.status],
                },
              ]}
            />
          </section>
          <section className="provider-license-section">
            <h3>Thiết bị đang kích hoạt</h3>
            <p>
              <strong>
                {license.activeDeviceCount} / {license.maxActiveDevices} thiết
                bị
              </strong>
            </p>
            <p className="provider-license-meta">
              Giới hạn kích hoạt của gói bản quyền này.
            </p>
          </section>
          <section className="provider-license-section">
            <h3>Ghi nhận blockchain</h3>
            <Descriptions
              column={1}
              items={[
                {
                  key: 'finality',
                  label: 'Trạng thái',
                  children: providerFinalityLabel(license.finality),
                },
                {
                  key: 'confirmations',
                  label: 'Số xác nhận đã ghi nhận',
                  children: license.confirmationCount,
                },
              ]}
            />
            <details className="provider-license-technical">
              <summary>Thông tin kỹ thuật</summary>
              <dl>
                <dt>Finality gốc</dt>
                <dd>{license.finality}</dd>
                {command ? (
                  <>
                    <dt>Mã yêu cầu</dt>
                    <dd>{command.commandId}</dd>
                  </>
                ) : null}
                {license.transactionHash ? (
                  <>
                    <dt>Giao dịch bản quyền</dt>
                    <dd>{license.transactionHash}</dd>
                  </>
                ) : null}
                {command?.transactionHash ? (
                  <>
                    <dt>Giao dịch yêu cầu</dt>
                    <dd>{command.transactionHash}</dd>
                  </>
                ) : null}
                {license.blockNumber != null ? (
                  <>
                    <dt>Số block</dt>
                    <dd>{license.blockNumber}</dd>
                  </>
                ) : null}
              </dl>
            </details>
          </section>
          <ProviderLicenseActions
            license={license}
            disabled={disabled}
            pending={pending}
            onAction={onAction}
            inline
          />
        </>
      ) : null}
    </Drawer>
  );
}
