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
import { requestJson, type ApiRequestError } from '../auth/authContext';

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
    if (status === 404 || code === 'ACTIVATION_KEY_UNAVAILABLE' || code === 'ACTIVATION_KEY_ALREADY_RETRIEVED') return 'Mã bản quyền đã được nhận hoặc hiện không còn sẵn sàng. Nếu bạn đã mất mã, hãy dùng quy trình khôi phục mã.';
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
export function useLicenses() {
  return useQuery({
    queryKey: ['licenses'],
    queryFn: () => requestJson<LicenseProjectionDto[]>('/licenses'),
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
        license.activationKeyTrustStatus === 'TRUSTED'
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
  return useMutation({
    retry: false,
    mutationFn: ({ id }: { id: string }) =>
      requestJson<ActivationKeyDto>(
        `/licenses/${encodeURIComponent(id)}/activation-key/retrieve`,
        { method: 'POST' },
      ),
  });
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
