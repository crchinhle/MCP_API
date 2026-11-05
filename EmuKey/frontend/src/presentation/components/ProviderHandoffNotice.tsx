import { Alert } from 'antd';
import type { LicenseProjectionDto } from '../../infrastructure/api/generated';
import { providerHandoffStatus } from '../../application/licenses/licenseQueries';

export function ProviderHandoffNotice({
  license,
}: {
  readonly license: LicenseProjectionDto;
}) {
  const progress = providerHandoffStatus(license);
  if (!progress) return null;
  return (
    <Alert
      showIcon
      type={progress.tone}
      title={progress.label}
      description={progress.description}
    />
  );
}
