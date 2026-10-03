import type { AuthPrincipal } from '../identity-access/identity.types.js';
import { ActivateDeviceDto, ActivationChallengeDto, EntitlementRefreshDto, EntitlementVerifyDto, LicenseLifecycleDto, RevokeDeviceDto, RemoteRevokeDeviceDto, ActivationKeyRecoveryDto, RotateActivationKeyDto, LicensingActionVerificationDto, ResolveLicensingActionDto } from './licensing.dto.js';
import { LicensingService } from './licensing.service.js';
export declare class LicensingController {
    private readonly service;
    constructor(service: LicensingService);
    challenge(actor: AuthPrincipal | undefined, dto: ActivationChallengeDto): Promise<{
        bindingGeneration: number;
        challenge: string;
        expiresAt: string;
        keyVersion: number;
        licenseId: string;
        purpose: "ACTIVATE_DEVICE" | "SELF_REVOKE_DEVICE" | "ISSUE_ENTITLEMENT" | "REFRESH_ENTITLEMENT";
    }>;
    activate(actor: AuthPrincipal | undefined, dto: ActivateDeviceDto): Promise<{
        activatedAt: string;
        bindingGeneration: number;
        deviceRef: string;
        id: string;
        licenseId: string;
        revokedAt: null;
        status: string;
    }>;
    requestActionVerification(actor: AuthPrincipal, dto: LicensingActionVerificationDto): Promise<{
        accepted: boolean;
    }>;
    resolveActionVerification(actor: AuthPrincipal, dto: ResolveLicensingActionDto): Promise<{
        action: string;
        deviceId: string | null;
        licenseId: string;
        expiresAt: string;
    }>;
    commandStatus(actor: AuthPrincipal, commandId: string): Promise<{
        commandId: string;
        commandType: string;
        confirmedAt: string | null;
        deviceId: string | null;
        licenseId: string;
        status: string;
        transactionHash: string | null;
    }>;
    revokeDevice(actor: AuthPrincipal, licenseId: string, deviceId: string, dto: RevokeDeviceDto): Promise<{
        activatedAt: string | null;
        bindingGeneration: number;
        deviceRef: string;
        id: string;
        licenseId: string;
        revokedAt: string;
        status: string;
    }>;
    remoteRevokeDevice(actor: AuthPrincipal, licenseId: string, deviceId: string, dto: RemoteRevokeDeviceDto): Promise<{
        activatedAt: string | null;
        bindingGeneration: number;
        deviceRef: string;
        id: string;
        licenseId: string;
        revokedAt: string;
        status: string;
    }>;
    rotate(actor: AuthPrincipal, licenseId: string, dto: RotateActivationKeyDto): Promise<{
        commandId: string;
        deviceId: string | null;
        licenseId: string;
        status: string;
    }>;
    recoverActivationKey(actor: AuthPrincipal, licenseId: string, dto: ActivationKeyRecoveryDto): Promise<{
        commandId: string;
        deviceId: string | null;
        licenseId: string;
        status: string;
    }>;
    lifecycle(actor: AuthPrincipal, licenseId: string, dto: LicenseLifecycleDto): Promise<import("./infrastructure/licensing.repository.js").LicenseCommandResult>;
    issueEntitlement(actor: AuthPrincipal | undefined, dto: EntitlementRefreshDto): Promise<{
        token: string;
        expiresAt: string;
        licenseId: string;
        deviceId: string;
        entitlementVersion: number;
    }>;
    refreshEntitlement(actor: AuthPrincipal | undefined, dto: EntitlementRefreshDto): Promise<{
        token: string;
        expiresAt: string;
        licenseId: string;
        deviceId: string;
        entitlementVersion: number;
    }>;
    verifyEntitlement(actor: AuthPrincipal | undefined, dto: EntitlementVerifyDto): Promise<{
        bindingGeneration: number;
        deviceId: string;
        entitlementVersion: number;
        expiresAt: string;
        keyVersion: number;
        licenseId: string;
        rights: Record<string, unknown>;
        valid: true;
    }>;
}
