import type { Redis } from 'ioredis';
import type { AuthPrincipal } from '../identity-access/identity.types.js';
import type { IdentityService } from '../identity-access/identity.service.js';
import type { ActivationEnvelopePort } from '../blockchain/application/ports/activation-envelope.port.js';
import type { LicenseProjectionRepository } from '../blockchain/infrastructure/license-projection.repository.js';
import type { LicenseCommandConfig, LicensingRepository } from './infrastructure/licensing.repository.js';
import type { ActivateDeviceDto, ActivationKeyRecoveryDto, ActivationChallengeDto, LicenseLifecycleDto, RevokeDeviceDto, RemoteRevokeDeviceDto, RotateActivationKeyDto, LicensingActionVerificationDto } from './licensing.dto.js';
export declare class LicensingService {
    private readonly repository;
    private readonly projection;
    private readonly envelopes;
    private readonly redis;
    private readonly jwtSecret;
    private readonly chain;
    private readonly identity?;
    constructor(repository: LicensingRepository, projection: LicenseProjectionRepository, envelopes: ActivationEnvelopePort, redis: Redis, jwtSecret: Uint8Array, chain: LicenseCommandConfig, identity?: IdentityService | undefined);
    resolveActionVerification(actor: AuthPrincipal, token: string): Promise<{
        action: string;
        deviceId: string | null;
        licenseId: string;
        expiresAt: string;
    }>;
    requestActionVerification(actor: AuthPrincipal, dto: LicensingActionVerificationDto): Promise<{
        accepted: boolean;
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
    challenge(actor: AuthPrincipal | null, dto: ActivationChallengeDto): Promise<{
        bindingGeneration: number;
        challenge: string;
        expiresAt: string;
        keyVersion: number;
        licenseId: string;
        purpose: "ACTIVATE_DEVICE" | "SELF_REVOKE_DEVICE" | "ISSUE_ENTITLEMENT" | "REFRESH_ENTITLEMENT";
    }>;
    private issueChallenge;
    activate(actor: AuthPrincipal | null, dto: ActivateDeviceDto): Promise<{
        activatedAt: string;
        bindingGeneration: number;
        deviceRef: string;
        id: string;
        licenseId: string;
        revokedAt: null;
        status: string;
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
    issueEntitlement(actor: AuthPrincipal | null, dto: import('./licensing.dto.js').EntitlementRefreshDto): Promise<{
        token: string;
        expiresAt: string;
        licenseId: string;
        deviceId: string;
        entitlementVersion: number;
    }>;
    refreshEntitlement(actor: AuthPrincipal | null, dto: import('./licensing.dto.js').EntitlementRefreshDto): Promise<{
        token: string;
        expiresAt: string;
        licenseId: string;
        deviceId: string;
        entitlementVersion: number;
    }>;
    verifyEntitlement(actor: AuthPrincipal | null, dto: import('./licensing.dto.js').EntitlementVerifyDto): Promise<{
        bindingGeneration: number;
        deviceId: string;
        entitlementVersion: number;
        expiresAt: string;
        keyVersion: number;
        licenseId: string;
        rights: Record<string, unknown>;
        valid: true;
    }>;
    private signEntitlement;
    private invalidActivationCredential;
    private verifyBearerKey;
    private verifyDeviceProof;
    private consumeActionToken;
    private verifyPasswordReauth;
    private opaqueDeviceRef;
    private challengeKey;
    private requireCustomer;
    private requireActive;
    private notFound;
    private translate;
}
