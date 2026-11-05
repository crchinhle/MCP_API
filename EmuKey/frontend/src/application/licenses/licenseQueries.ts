import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ActivateDeviceDto,
  ActivationChallengeDto,
  ActivationKeyDto,
  DeviceChallengeDto,
  LicenseDeviceDto,
  EntitlementDto,
  EntitlementValidationDto,
  LicenseProjectionDto,
  LicensingActionResolutionDto,
  Phase6CommandDto,
  Phase6CommandStatusDto,
  PublicLicenseVerificationDto,
  RevokeDeviceDto,
  RotateActivationKeyDto,
} from '../../infrastructure/api/generated';
import { requestJson, useAuth, type ApiRequestError } from '../auth/authContext';

export function providerLicenseReady(license: LicenseProjectionDto): boolean {
  return license.fulfillmentMode!=='PROVIDER_HANDOFF' || (license.providerDeliveryStatus==='DELIVERED' &&
    license.status==='ACTIVE' && license.activationKeyTrustStatus==='TRUSTED' && ['CONFIRMED','CHAIN_CONFIRMED'].includes(license.finality) && Date.parse(license.expiresAt)>Date.now());
}

/** Customer-facing progress; authorization and delivery admission stay on the API. */
export function providerHandoffStatus(license: LicenseProjectionDto): {
  stage: 'blockchain' | 'review' | 'handoff' | 'failed' | 'delivered' | 'received' | 'inactive';
  label: string;
  description: string;
  tone: 'info' | 'warning' | 'success';
} | null {
  if (license.fulfillmentMode !== 'PROVIDER_HANDOFF') return null;
  if (['SUSPENDED', 'REVOKED', 'EXPIRED'].includes(license.status) || (license.status !== 'PENDING_ONCHAIN' && Date.parse(license.expiresAt) <= Date.now())) {
    return { stage: 'inactive', label: license.status === 'SUSPENDED' ? 'Bản quyền tạm ngưng' : license.status === 'REVOKED' ? 'Bản quyền đã thu hồi' : 'Bản quyền đã hết hạn',
      description: 'Quyền sử dụng do nhà cung cấp thực thi theo trạng thái và thời hạn hiện tại. Kiểm tra chi tiết bản quyền hoặc liên hệ hỗ trợ.', tone: 'warning' };
  }
  if (['UNTRUSTED_REORG', 'PROJECTION_STALE', 'REORGED'].includes(license.activationKeyTrustStatus) || ['PROJECTION_STALE', 'UNTRUSTED_REORG', 'REORGED'].includes(license.finality)) {
    return { stage: 'review', label: 'Đang xác minh lại blockchain', description: 'Bằng chứng blockchain đang được kiểm tra lại. Chưa thể nhận mã; bạn không cần thanh toán lại.', tone: 'warning' };
  }
  if (license.status === 'PENDING_ONCHAIN' || license.activationKeyTrustStatus !== 'TRUSTED' || !['CONFIRMED', 'CHAIN_CONFIRMED'].includes(license.finality)) {
    return { stage: 'blockchain', label: 'Đang xác nhận blockchain', description: 'Thanh toán đã được ghi nhận. Hệ thống đang chờ blockchain xác nhận trước khi bàn giao bản quyền cho nhà cung cấp. Không thanh toán lại.', tone: 'info' };
  }
  if (license.providerDeliveryStatus === 'FAILED') {
    return { stage: 'failed', label: 'Bàn giao bản quyền cần xử lý', description: 'Thanh toán và blockchain đã được xác nhận. Chưa nhận được xác nhận lưu từ nhà cung cấp; không thanh toán lại. Liên hệ hỗ trợ theo đơn hàng.', tone: 'warning' };
  }
  if (license.providerDeliveryStatus !== 'DELIVERED') {
    return { stage: 'handoff', label: 'Đang bàn giao cho nhà cung cấp', description: 'Blockchain đã được xác nhận. Mã sẽ sẵn sàng sau khi hệ thống nhà cung cấp xác nhận đã lưu. Bạn có thể quay về đơn hàng và kiểm tra lại sau.', tone: 'info' };
  }
  if (license.activationKeyAvailable === false) {
    return { stage: 'received', label: 'Mã bản quyền đã được nhận', description: 'Nhà cung cấp đã nhận bản quyền và mã đã được giao cho bạn. Nếu mất mã, mở quản lý bản quyền để khôi phục qua email.', tone: 'success' };
  }
  return { stage: 'delivered', label: 'Nhà cung cấp đã nhận bản quyền', description: 'Bản quyền đã được bàn giao. Bạn có thể nhận mã một lần và lưu an toàn để dùng trong sản phẩm của nhà cung cấp.', tone: 'success' };
}

export function useResolveLicensingAction(token: string) {
  return useQuery({
    queryKey: ['licenses', 'action-resolution', token],
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    queryFn: () => requestJson<LicensingActionResolutionDto>('/licenses/action-verification/resolve', {
      method: 'POST', body: JSON.stringify({ actionToken: token }),
    }),
  });
}

export function publicVerificationError(error: unknown): { message: string; retryable: boolean } {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number((error as ApiRequestError).status);
    const retryAfter = Number((error as ApiRequestError).retryAfterSeconds ?? 0);
    if (status === 400) return { message: 'Mã xác thực không đúng định dạng. Vui lòng kiểm tra và thử lại.', retryable: false };
    if (status === 404) return { message: 'Không tìm thấy License phù hợp với mã xác thực.', retryable: false };
    if (status === 429) return { message: retryAfter ? `Hệ thống đang giới hạn yêu cầu. Vui lòng thử lại sau ${retryAfter} giây.` : 'Hệ thống đang giới hạn yêu cầu. Vui lòng thử lại sau ít phút.', retryable: true };
  }
  return { message: 'Không thể xác minh lúc này. Vui lòng kiểm tra kết nối và thử lại.', retryable: true };
}

export function publicVerificationErrorLabel(error: unknown): string {
  return publicVerificationError(error).message;
}

export function activationKeyErrorLabel(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number((error as ApiRequestError).status);
    const code = 'code' in error ? String((error as ApiRequestError).code ?? '') : '';
    if (status === 404 || ['ACTIVATION_KEY_UNAVAILABLE', 'ACTIVATION_KEY_ALREADY_RETRIEVED', 'KEY_DELIVERY_EXPIRED', 'KEY_ALREADY_DELIVERED', 'KEY_UNAVAILABLE'].includes(code)) return 'Mã bản quyền đã được nhận hoặc hiện không còn sẵn sàng. Nếu bạn đã mất mã, hãy dùng quy trình khôi phục mã.';
    if (status === 409) return 'Mã bản quyền chưa thể nhận ở trạng thái hiện tại. Hãy kiểm tra lại trạng thái bản quyền.';
    if (status === 403) return 'Bạn không có quyền nhận mã bản quyền này.';
    if (status === 429) return 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.';
  }
  return 'Không thể nhận mã bản quyền lúc này. Vui lòng thử lại khi bản quyền vẫn đang sẵn sàng.';
}

export function licenseStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Hoạt động',
    PENDING_ONCHAIN: 'Đang chờ xác nhận',
    SUSPENDED: 'Tạm ngưng',
    EXPIRED: 'Đã hết hạn',
    REVOKED: 'Đã thu hồi',
  };
  return labels[status] ?? status;
}

export function deviceStatusLabel(status: string): string {
  return status === 'ACTIVE' ? 'Đang sử dụng' : status === 'REVOKED' ? 'Đã thu hồi' : status;
}

export function finalityLabel(finality: string | null | undefined): string {
  switch (finality) {
    case 'CHAIN_CONFIRMED': return 'Đã xác nhận trên blockchain';
    case 'PENDING_FINALITY': return 'Đang chờ finality';
    case 'UNTRUSTED_REORG': return 'Chưa tin cậy — blockchain có reorg';
    case 'PROJECTION_STALE': return 'Dữ liệu đang đồng bộ lại';
    case 'REORGED': return 'Đang xác minh lại sau reorg';
    default: return finality ?? 'Chưa rõ trạng thái';
  }
}

// Provider copy is intentionally separate from Customer and System Admin views.
export const providerLicenseLabels = {
  PENDING_ONCHAIN: 'Đang phát hành',
  ACTIVE: 'Có hiệu lực',
  SUSPENDED: 'Tạm ngưng',
  EXPIRED: 'Hết hạn',
  REVOKED: 'Đã thu hồi',
} satisfies Record<LicenseProjectionDto['status'], string>;

export const providerFinalityLabels: Record<string, string> = {
  PENDING: 'Chưa ghi nhận xác nhận',
  PENDING_FINALITY: 'Chờ đủ xác nhận',
  CONFIRMED: 'Đã ghi nhận trên blockchain',
  CHAIN_CONFIRMED: 'Đã ghi nhận trên blockchain',
  PROJECTION_STALE: 'Đang chờ đồng bộ dữ liệu',
  REORGED: 'Cần kiểm tra ghi nhận blockchain',
  UNTRUSTED_REORG: 'Cần kiểm tra độ tin cậy',
};

export function providerFinalityLabel(finality: string): string {
  return providerFinalityLabels[finality] ?? 'Chưa có thông tin xác nhận';
}

export type ProviderLifecycleAction = 'SUSPEND_LICENSE' | 'RESUME_LICENSE' | 'REVOKE_LICENSE';
export const providerActionLabels: Record<ProviderLifecycleAction, string> = {
  SUSPEND_LICENSE: 'Tạm ngưng', RESUME_LICENSE: 'Tiếp tục', REVOKE_LICENSE: 'Thu hồi',
};

export function providerLicenseActions(license: LicenseProjectionDto): ProviderLifecycleAction[] {
  // Mirrors createLifecycleCommand; the server still enforces ownership/state.
  if (license.status === 'ACTIVE') {
    return Date.parse(license.expiresAt) > Date.now() ? ['SUSPEND_LICENSE', 'REVOKE_LICENSE'] : ['REVOKE_LICENSE'];
  }
  return license.status === 'SUSPENDED' ? ['RESUME_LICENSE', 'REVOKE_LICENSE'] : [];
}

export function providerLicenseDate(value: string): string {
  return Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa có thông tin';
}

export function useLicenses() {
  return useQuery({
    queryKey: ['licenses'],
    queryFn: () => requestJson<LicenseProjectionDto[]>('/licenses'),
    refetchInterval:(query)=>query.state.data?.some((license)=>license.fulfillmentMode==='PROVIDER_HANDOFF' && !['DELIVERED','FAILED'].includes(license.providerDeliveryStatus ?? ''))?5000:false,
  });
}

export function useOrderLicense(
  orderId: string,
  enabled: boolean,
  licenseId?: string | null,
  continuePollingAfterReady = false,
  requiredExpiresAt?: string | null,
) {
  return useQuery({
    enabled: Boolean(orderId) && enabled,
    queryKey: ['licenses', 'order', orderId, licenseId ?? null, requiredExpiresAt ?? null],
    queryFn: async () => {
      if (licenseId) {
        return requestJson<LicenseProjectionDto>(
          `/licenses/${encodeURIComponent(licenseId)}`,
        );
      }
      const licenses = await requestJson<LicenseProjectionDto[]>('/licenses');
      return licenses.find((license) => license.originOrderId === orderId) ?? null;
    },
    refetchInterval: (query) => {
      const license = query.state.data;
      // Chain timestamps are whole seconds; command payloads may retain milliseconds.
      const expiryUpdated = !requiredExpiresAt || (license &&
        Math.floor(Date.parse(license.expiresAt) / 1000) >= Math.floor(Date.parse(requiredExpiresAt) / 1000));
      if (
        !continuePollingAfterReady && expiryUpdated &&
        license?.status === 'ACTIVE' &&
        license.activationKeyTrustStatus === 'TRUSTED' && providerLicenseReady(license)
      ) return false;
      if (!continuePollingAfterReady && expiryUpdated && license && ['SUSPENDED', 'EXPIRED', 'REVOKED'].includes(license.status)) return false;
      return 2_000;
    },
    refetchIntervalInBackground: true,
  });
}

export function useProviderLicenses() {
  return useQuery({
    queryKey: ['licenses', 'provider'],
    queryFn: () => requestJson<LicenseProjectionDto[]>('/licenses'),
    refetchInterval:(query)=>query.state.data?.some((license)=>license.fulfillmentMode==='PROVIDER_HANDOFF' && !['DELIVERED','FAILED'].includes(license.providerDeliveryStatus ?? ''))?5000:false,
  });
}

export function useLicenseLifecycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ licenseId, command, reason }: { licenseId: string; command: 'SUSPEND_LICENSE' | 'RESUME_LICENSE' | 'REVOKE_LICENSE'; reason?: string }) =>
      requestJson<Phase6CommandDto>(`/licenses/${encodeURIComponent(licenseId)}/lifecycle`, {
        body: JSON.stringify({ command, ...(reason ? { reason } : {}) }),
        method: 'POST',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['licenses', 'provider'] }),
  });
}

export function useRequestLicensingActionVerification() {
  return useMutation({
    mutationFn: ({ licenseId, action, deviceId }: { licenseId: string; action: 'ROTATE_KEY' | 'REVOKE_DEVICE' | 'REMOTE_REVOKE_DEVICE' | 'KEY_RECOVERY'; deviceId?: string }) =>
      requestJson<{ accepted: boolean }>('/licenses/action-verification', {
        body: JSON.stringify({ action, ...(deviceId ? { deviceId } : {}), licenseId }),
        method: 'POST',
      }),
  });
}

export function usePhase6Command(commandId: string | undefined) {
  return useQuery({
    enabled: Boolean(commandId),
    queryKey: ['phase6-command', commandId],
    queryFn: () => requestJson<Phase6CommandStatusDto>(`/commands/${encodeURIComponent(commandId!)}`),
    refetchInterval: (query) => ['CONFIRMED', 'DEAD_LETTER', 'ABANDONED', 'SUPERSEDED'].includes(query.state.data?.status ?? '') ? false : 2_000,
  });
}

export function useRetrieveActivationKey() {
  const { user } = useAuth();
  return useMutation({
    retry: false,
    mutationFn: async ({ id, keyVersion: observedVersion }: { id: string; keyVersion?: number }) => {
      const keyVersion = observedVersion ?? (await requestJson<LicenseProjectionDto>(`/licenses/${encodeURIComponent(id)}`)).keyVersion;
      const storageKey = `emukey-key-delivery:${user?.id}:${id}`;
      const previous = sessionStorage.getItem(storageKey);
      const receipt = previous ? JSON.parse(previous) as { deliveryId: string; keyVersion?: number } : null;
      const deliveryId = receipt?.keyVersion === keyVersion ? receipt.deliveryId : crypto.randomUUID();
      sessionStorage.setItem(storageKey, JSON.stringify({ deliveryId, keyVersion }));
      const result = await requestJson<ActivationKeyDto>(
        `/licenses/${encodeURIComponent(id)}/activation-key/retrieve`,
        { method: 'POST', body: JSON.stringify({ deliveryId }) },
      );
      sessionStorage.setItem(storageKey, JSON.stringify({ deliveryId, keyVersion: result.keyVersion }));
      return result;
    },
  });
}

export function useAcknowledgeActivationKey() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => {
    const key = `emukey-key-delivery:${user?.id}:${id}`;
    const receipt = JSON.parse(sessionStorage.getItem(key) ?? '{}') as { deliveryId?: string; keyVersion?: number };
    if (!receipt.deliveryId || !receipt.keyVersion) throw new Error('KEY_DELIVERY_NOT_FOUND');
    return requestJson(`/licenses/${encodeURIComponent(id)}/activation-key/ack`, { method: 'POST', body: JSON.stringify(receipt) });
  }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['licenses'] }) });
}

export function usePublicLicenseVerification() {
  return useMutation({
    mutationFn: (publicId: string) =>
      requestJson<PublicLicenseVerificationDto>(
        `/public/licenses/${encodeURIComponent(publicId)}/verify`,
      ),
  });
}

export function useActivationChallenge() {
  return useMutation({
    mutationFn: (input: ActivationChallengeDto) =>
      requestJson<DeviceChallengeDto>('/activations/challenge', {
        body: JSON.stringify(input),
        method: 'POST',
      }),
  });
}

export function useLicenseDevices(licenseId: string | undefined) {
  return useQuery({
    enabled: Boolean(licenseId),
    queryKey: ['licenses', licenseId, 'devices'],
    queryFn: () => requestJson<LicenseDeviceDto[]>(`/licenses/${encodeURIComponent(licenseId!)}/devices`),
  });
}

export function useAllLicenseDevices(licenseIds: readonly string[]) {
  return useQueries({
    queries: licenseIds.map((licenseId) => ({
      enabled: Boolean(licenseId),
      queryKey: ['licenses', licenseId, 'devices'],
      queryFn: () => requestJson<LicenseDeviceDto[]>(`/licenses/${encodeURIComponent(licenseId)}/devices`),
    })),
  });
}

export function useActivateDevice() {
  return useMutation({
    mutationFn: (input: ActivateDeviceDto) =>
      requestJson<LicenseDeviceDto>('/activations', {
        body: JSON.stringify(input),
        method: 'POST',
      }),
  });
}

export function useRevokeDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ licenseId, deviceId, input }: { licenseId: string; deviceId: string; input: RevokeDeviceDto }) =>
       requestJson<LicenseDeviceDto>(
         `/licenses/${encodeURIComponent(licenseId)}/devices/${encodeURIComponent(deviceId)}/revoke`,
        { body: JSON.stringify(input), method: 'POST' },
      ),
    onSuccess: (_value, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['licenses', variables.licenseId, 'devices'] });
    },
  });
}

export function useRemoteRevokeDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ licenseId, deviceId, input }: { licenseId: string; deviceId: string; input: { actionToken: string; currentPassword: string } }) =>
       requestJson<LicenseDeviceDto>(
         `/licenses/${encodeURIComponent(licenseId)}/devices/${encodeURIComponent(deviceId)}/remote-revoke`,
        { body: JSON.stringify(input), method: 'POST' },
      ),
    onSuccess: (_value, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['licenses', variables.licenseId, 'devices'] });
    },
  });
}

export function useRotateActivationKey() {
  return useMutation({
    mutationFn: ({ licenseId, input }: { licenseId: string; input: RotateActivationKeyDto }) =>
      requestJson<Phase6CommandDto>(
        `/licenses/${encodeURIComponent(licenseId)}/activation-key/rotate`,
        { body: JSON.stringify(input), method: 'POST' },
      ),
  });
}

export function useRecoverActivationKey() {
  return useMutation({
    mutationFn: ({ licenseId, input }: { licenseId: string; input: { actionToken: string; currentPassword: string } }) =>
      requestJson<Phase6CommandDto>(
        `/licenses/${encodeURIComponent(licenseId)}/activation-key/recover`,
        { body: JSON.stringify(input), method: 'POST' },
      ),
  });
}

export function useIssueEntitlement() {
  return useMutation({
    mutationFn: ({ licenseId, deviceId, challenge, proof }: { licenseId: string; deviceId: string; challenge: string; proof: string }) =>
      requestJson<EntitlementDto>('/entitlements/issue', {
        body: JSON.stringify({ challenge, deviceId, licenseId, proof }),
        method: 'POST',
      }),
  });
}

export function useRefreshEntitlement() {
  return useMutation({
    mutationFn: ({ licenseId, deviceId, challenge, proof }: { licenseId: string; deviceId: string; challenge: string; proof: string }) =>
      requestJson<EntitlementDto>('/entitlements/refresh', {
        body: JSON.stringify({ challenge, deviceId, licenseId, proof }),
        method: 'POST',
      }),
  });
}

export function useVerifyEntitlement() {
  return useMutation({
    mutationFn: (token: string) =>
      requestJson<EntitlementValidationDto>('/entitlements/verify', {
        body: JSON.stringify({ token }),
        method: 'POST',
      }),
  });
}
