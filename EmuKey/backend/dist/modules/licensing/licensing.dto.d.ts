export declare class ActivateDeviceDto {
    /** Deprecated client hint retained for one compatibility window; authorization always resolves from activationKey. */
    licenseId?: string;
    activationKey: `0x${string}`;
    challenge: string;
    deviceRef: string;
    devicePublicKey: `0x${string}`;
    proof: `0x${string}`;
}
export declare class RevokeDeviceDto {
    actionToken: string;
    activationKey: `0x${string}`;
    challenge: string;
    proof: `0x${string}`;
}
export declare class RemoteRevokeDeviceDto {
    actionToken: string;
    currentPassword: string;
}
export declare class ActivationKeyRecoveryDto {
    actionToken: string;
    currentPassword: string;
}
export declare class RotateActivationKeyDto {
    actionToken: string;
    currentKey: `0x${string}`;
}
export declare class ResolveLicensingActionDto {
    actionToken: string;
}
export declare class LicensingActionResolutionDto {
    action: string;
    licenseId: string;
    deviceId: string | null;
    expiresAt: string;
}
export declare class LicensingActionVerificationDto {
    action: 'ROTATE_KEY' | 'REVOKE_DEVICE' | 'REMOTE_REVOKE_DEVICE' | 'KEY_RECOVERY';
    licenseId: string;
    deviceId?: string;
}
export declare class ActivationChallengeDto {
    licenseId?: string;
    activationKey?: `0x${string}`;
    purpose: 'ACTIVATE_DEVICE' | 'SELF_REVOKE_DEVICE' | 'ISSUE_ENTITLEMENT' | 'REFRESH_ENTITLEMENT';
    deviceRef: string;
    deviceId?: string;
}
export declare class LicenseLifecycleDto {
    command: 'SUSPEND_LICENSE' | 'RESUME_LICENSE' | 'REVOKE_LICENSE';
    reason?: string;
}
export declare class EntitlementDto {
    token: string;
    expiresAt: string;
    licenseId: string;
    deviceId: string;
    entitlementVersion: number;
}
export declare class EntitlementVerifyDto {
    token: string;
}
export declare class EntitlementValidationDto {
    bindingGeneration: number;
    valid: true;
    expiresAt: string;
    licenseId: string;
    deviceId: string;
    entitlementVersion: number;
    keyVersion: number;
    rights: Record<string, unknown>;
}
export declare class EntitlementRefreshDto {
    licenseId: string;
    deviceId: string;
    challenge: string;
    proof: `0x${string}`;
}
export declare class DeviceChallengeDto {
    licenseId: string;
    challenge: string;
    expiresAt: string;
    bindingGeneration: number;
    keyVersion: number;
    purpose: string;
}
export declare class Phase6CommandDto {
    commandId: string;
    status: string;
    licenseId: string;
    deviceId: string | null;
}
export declare class Phase6CommandStatusDto extends Phase6CommandDto {
    commandType: string;
    confirmedAt: string | null;
    transactionHash: string | null;
}
