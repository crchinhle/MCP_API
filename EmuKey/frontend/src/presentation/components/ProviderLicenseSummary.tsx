import { MoreOutlined } from '@ant-design/icons';
import { Button, Dropdown, Tooltip, message } from 'antd';
import type { LicenseProjectionDto } from '../../infrastructure/api/generated';
import {
  providerActionLabels,
  providerFinalityLabel,
  providerLicenseActions,
  providerLicenseLabels,
  type ProviderLifecycleAction,
} from '../../application/licenses/licenseQueries';
import { StatusChip } from './WorkspacePrimitives';

export function ProviderLicenseId({ value }: { readonly value: string }) {
  const [messageApi, contextHolder] = message.useMessage();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      void messageApi.success('Đã sao chép mã bản quyền');
    } catch {
      void messageApi.error(
        'Không thể sao chép. Vui lòng sao chép mã thủ công.',
      );
    }
  };
  return (
    <span className="provider-license-id">
      {contextHolder}
      <Tooltip title={`${value} · Nhấn để sao chép`}>
        <button
          type="button"
          className="provider-license-id-button"
          aria-label={`Sao chép mã bản quyền ${value}`}
          onClick={() => void copy()}
        >
          <code>{value}</code>
        </button>
      </Tooltip>
    </span>
  );
}

export function ProviderLicenseStatus({
  license,
  secondary = true,
}: {
  readonly license: LicenseProjectionDto;
  readonly secondary?: boolean;
}) {
  return (
    <div className="provider-license-status">
      <StatusChip
        tone={
          license.status === 'ACTIVE'
            ? 'success'
            : license.status === 'REVOKED'
              ? 'error'
              : license.status === 'EXPIRED'
                ? 'neutral'
                : 'warning'
        }
      >
        {providerLicenseLabels[license.status] ?? 'Chưa có thông tin'}
      </StatusChip>
      {secondary ? (
        <span className="provider-license-meta">
          {providerFinalityLabel(license.finality)}
        </span>
      ) : null}
    </div>
  );
}

export function ProviderLicenseActions({
  license,
  disabled,
  pending,
  onAction,
  inline = false,
}: {
  readonly license: LicenseProjectionDto;
  readonly disabled: boolean;
  readonly pending: boolean;
  readonly onAction: (action: ProviderLifecycleAction) => void;
  readonly inline?: boolean;
}) {
  const actions = providerLicenseActions(license);
  if (!actions.length) return null;
  if (inline)
    return (
      <div className="provider-license-drawer-actions">
        {actions.map((action) => (
          <Button
            key={action}
            danger={action === 'REVOKE_LICENSE'}
            disabled={disabled}
            loading={pending}
            onClick={() => onAction(action)}
          >
            {providerActionLabels[action]}
          </Button>
        ))}
      </div>
    );
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: actions.flatMap((action, index) => [
          ...(action === 'REVOKE_LICENSE' && index > 0
            ? [{ type: 'divider' as const }]
            : []),
          {
            key: action,
            label: `${providerActionLabels[action]} bản quyền`,
            danger: action === 'REVOKE_LICENSE',
            onClick: () => onAction(action),
          },
        ]),
      }}
    >
      <Button
        aria-label={`Thao tác bản quyền ${license.productName}`}
        icon={<MoreOutlined />}
        disabled={disabled}
        loading={pending}
      />
    </Dropdown>
  );
}
