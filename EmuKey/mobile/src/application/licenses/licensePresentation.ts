import { MobileApiError, type MobileLicense } from '../../infrastructure/api/client';
import type { SemanticTone } from '../../presentation/theme/tokens';

export function licenseStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING_ONCHAIN':
      return 'Đang phát hành';
    case 'ACTIVE':
      return 'Đang hoạt động';
    case 'SUSPENDED':
      return 'Tạm ngưng';
    case 'EXPIRED':
      return 'Đã hết hạn';
    case 'REVOKED':
      return 'Đã thu hồi';
    default:
      return 'Chưa xác định';
  }
}

export function licenseStatusTone(status: string): SemanticTone {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING_ONCHAIN':
      return 'info';
    case 'SUSPENDED':
      return 'warning';
    case 'EXPIRED':
    case 'REVOKED':
      return 'error';
    default:
      return 'neutral';
  }
}

export function finalityLabel(finality: string | null | undefined): string {
  switch (finality) {
    case 'CHAIN_CONFIRMED':
    case 'CONFIRMED':
      return 'Đã xác nhận trên chuỗi';
    case 'PENDING_FINALITY':
      return 'Đang chờ xác nhận cuối';
    case 'UNTRUSTED_REORG':
      return 'Đang kiểm tra lại do phân nhánh chuỗi';
    case 'PROJECTION_STALE':
      return 'Đang đồng bộ lại dữ liệu';
    case 'REORGED':
      return 'Đang xác minh lại giao dịch chuỗi';
    default:
      return finality ?? 'Chưa xác định';
  }
}

export function activationKeyTrustLabel(status: string | null | undefined): string {
  switch (status) {
    case 'TRUSTED':
      return 'Đáng tin cậy';
    case 'PENDING_FINALITY':
      return 'Đang chờ xác nhận cuối';
    case 'UNTRUSTED_REORG':
    case 'REORGED':
      return 'Đang kiểm tra lại do phân nhánh chuỗi';
    case 'PROJECTION_STALE':
      return 'Đang đồng bộ lại dữ liệu';
    default:
      return 'Chưa xác định';
  }
}

export function verificationEventStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'CONFIRMED':
    case 'CHAIN_CONFIRMED':
    case 'COMPLETED':
    case 'SUCCESS':
      return 'Đã xác nhận';
    case 'PENDING':
    case 'PENDING_FINALITY':
      return 'Đang chờ xác nhận';
    case 'FAILED':
      return 'Không thành công';
    case 'REORGED':
    case 'UNTRUSTED_REORG':
      return 'Đang kiểm tra lại';
    default:
      return status ? 'Đã ghi nhận' : 'Chưa xác định';
  }
}

export function licenseKeyStatusText(license: MobileLicense): string {
  if (license.activationKeyLast4) {
    return `•••• ${license.activationKeyLast4}`;
  }
  if (
    ['UNTRUSTED_REORG', 'PROJECTION_STALE', 'REORGED'].includes(license.activationKeyTrustStatus) ||
    ['UNTRUSTED_REORG', 'PROJECTION_STALE', 'REORGED'].includes(license.finality)
  ) {
    return 'Đang xác minh lại giao dịch';
  }
  if (
    license.status === 'PENDING_ONCHAIN' ||
    license.activationKeyTrustStatus !== 'TRUSTED' ||
    !['CONFIRMED', 'CHAIN_CONFIRMED'].includes(license.finality)
  ) {
    return 'Đang chờ cấp mã';
  }
  if (license.fulfillmentMode === 'PROVIDER_HANDOFF' && license.providerDeliveryStatus !== 'DELIVERED') {
    return license.providerDeliveryStatus === 'FAILED'
      ? 'Chờ xử lý bàn giao'
      : 'Đang chờ nhà cung cấp xác nhận';
  }
  if (license.status !== 'ACTIVE') {
    return 'Tạm khóa theo trạng thái bản quyền';
  }
  if (license.activationKeyAvailable === false) {
    return 'Đã nhận trước đó · không còn bản mới';
  }
  return 'Chưa nhận mã (đã sẵn sàng)';
}

export function licensePrimaryKeyActionLabel(license: MobileLicense): string {
  if (!canRetrieveActivationKey(license)) {
    return 'Kiểm tra trạng thái mã';
  }
  if (license.activationKeyAvailable === false) {
    return 'Xem hoặc khôi phục mã bản quyền';
  }
  return 'Nhận mã bản quyền';
}

export function providerLicenseReady(license: MobileLicense): boolean {
  return (
    license.fulfillmentMode !== 'PROVIDER_HANDOFF' ||
    (license.providerDeliveryStatus === 'DELIVERED' &&
      license.status === 'ACTIVE' &&
      license.activationKeyTrustStatus === 'TRUSTED' &&
      ['CONFIRMED', 'CHAIN_CONFIRMED'].includes(license.finality) &&
      Date.parse(license.expiresAt) > Date.now())
  );
}

export function canRetrieveActivationKey(license: MobileLicense): boolean {
  if (license.status !== 'ACTIVE') return false;
  if (license.fulfillmentMode !== 'PROVIDER_HANDOFF') {
    return (
      license.activationKeyTrustStatus === 'TRUSTED' &&
      ['CONFIRMED', 'CHAIN_CONFIRMED'].includes(license.finality)
    );
  }
  return providerLicenseReady(license);
}

export interface ProviderHandoffState {
  readonly stage:
    | 'blockchain'
    | 'review'
    | 'handoff'
    | 'failed'
    | 'delivered'
    | 'received'
    | 'inactive';
  readonly label: string;
  readonly description: string;
  readonly tone: SemanticTone;
}

export function providerHandoffStatus(license: MobileLicense): ProviderHandoffState | null {
  if (license.fulfillmentMode !== 'PROVIDER_HANDOFF') return null;

  if (
    license.status === 'SUSPENDED' ||
    license.status === 'REVOKED' ||
    license.status === 'EXPIRED' ||
    (license.status !== 'PENDING_ONCHAIN' && Date.parse(license.expiresAt) <= Date.now())
  ) {
    const label =
      license.status === 'SUSPENDED'
        ? 'Bản quyền tạm ngưng'
        : license.status === 'REVOKED'
          ? 'Bản quyền đã thu hồi'
          : 'Bản quyền đã hết hạn';
    return {
      stage: 'inactive',
      label,
      description:
        'Quyền sử dụng do nhà cung cấp thực thi theo trạng thái và thời hạn hiện tại. Kiểm tra chi tiết bản quyền hoặc liên hệ hỗ trợ.',
      tone: 'warning',
    };
  }

  if (
    ['UNTRUSTED_REORG', 'PROJECTION_STALE', 'REORGED'].includes(
      license.activationKeyTrustStatus,
    ) ||
    ['UNTRUSTED_REORG', 'PROJECTION_STALE', 'REORGED'].includes(license.finality)
  ) {
    return {
      stage: 'review',
      label: 'Đang xác minh lại blockchain',
      description:
        'Bằng chứng blockchain đang được kiểm tra lại. Chưa thể nhận mã; bạn không cần thanh toán lại.',
      tone: 'warning',
    };
  }

  if (
    license.status === 'PENDING_ONCHAIN' ||
    license.activationKeyTrustStatus !== 'TRUSTED' ||
    !['CONFIRMED', 'CHAIN_CONFIRMED'].includes(license.finality)
  ) {
    return {
      stage: 'blockchain',
      label: 'Đang xác nhận blockchain',
      description:
        'Thanh toán đã được ghi nhận. Hệ thống đang chờ blockchain xác nhận trước khi bàn giao bản quyền cho nhà cung cấp. Không thanh toán lại.',
      tone: 'info',
    };
  }

  if (license.providerDeliveryStatus === 'FAILED') {
    return {
      stage: 'failed',
      label: 'Bàn giao bản quyền cần xử lý. Không thanh toán lại.',
      description:
        'Thanh toán và blockchain đã được xác nhận. Chưa nhận được xác nhận lưu từ nhà cung cấp; không thanh toán lại. Liên hệ hỗ trợ theo đơn hàng.',
      tone: 'warning',
    };
  }

  if (license.providerDeliveryStatus !== 'DELIVERED') {
    return {
      stage: 'handoff',
      label: 'Đang bàn giao cho nhà cung cấp',
      description:
        'Blockchain đã được xác nhận. Mã sẽ sẵn sàng sau khi hệ thống nhà cung cấp xác nhận đã lưu. Bạn có thể quay về đơn hàng và kiểm tra lại sau.',
      tone: 'info',
    };
  }

  if (license.activationKeyAvailable === false) {
    return {
      stage: 'received',
      label: 'Mã bản quyền đã được nhận',
      description:
        'Mã đã được giao trước đó. Nếu mất mã, mở mục bên dưới để khôi phục qua email.',
      tone: 'success',
    };
  }

  return {
    stage: 'delivered',
    label: 'Nhà cung cấp đã nhận bản quyền',
    description: 'Mã đã sẵn sàng và chưa lưu trên thiết bị này.',
    tone: 'success',
  };
}

export function providerHandoffLabel(license: MobileLicense): string {
  return providerHandoffStatus(license)?.label ?? '';
}

export function activationKeyErrorLabel(error: unknown): string {
  if (error instanceof MobileApiError || (error && typeof error === 'object' && 'status' in error)) {
    const status = Number((error as { status?: number }).status);
    const code = 'code' in error ? String((error as { code?: string }).code ?? '') : '';
    if (
      status === 404 ||
      [
        'ACTIVATION_KEY_UNAVAILABLE',
        'ACTIVATION_KEY_ALREADY_RETRIEVED',
        'KEY_DELIVERY_EXPIRED',
        'KEY_ALREADY_DELIVERED',
        'KEY_UNAVAILABLE',
      ].includes(code)
    ) {
      return 'Mã bản quyền đã được nhận hoặc hiện không còn sẵn sàng. Nếu bạn đã mất mã, hãy dùng quy trình khôi phục qua email.';
    }
    if (status === 409) {
      return 'Mã bản quyền chưa thể nhận ở trạng thái hiện tại. Hãy kiểm tra lại trạng thái bản quyền.';
    }
    if (status === 403) {
      return 'Bạn không có quyền nhận mã bản quyền này.';
    }
    if (status === 429) {
      return 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.';
    }
  }
  return 'Không thể nhận mã bản quyền lúc này. Nếu mã đã được nhận hoặc hết thời gian nhận, hãy khôi phục qua email.';
}

export function publicVerificationError(error: unknown): {
  readonly message: string;
  readonly retryable: boolean;
} {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number((error as { status?: number }).status);
    const retryAfter = Number((error as { retryAfterSeconds?: number }).retryAfterSeconds ?? 0);
    if (status === 400) {
      return {
        message: 'Mã xác thực không đúng định dạng. Vui lòng kiểm tra và thử lại.',
        retryable: false,
      };
    }
    if (status === 404) {
      return {
        message: 'Không tìm thấy bản quyền phù hợp với mã xác thực.',
        retryable: false,
      };
    }
    if (status === 429) {
      return {
        message: retryAfter
          ? `Hệ thống đang giới hạn yêu cầu. Vui lòng thử lại sau ${retryAfter} giây.`
          : 'Hệ thống đang giới hạn yêu cầu. Vui lòng thử lại sau ít phút.',
        retryable: true,
      };
    }
  }
  return {
    message: 'Không thể xác minh bản quyền lúc này. Vui lòng kiểm tra kết nối và thử lại.',
    retryable: true,
  };
}
