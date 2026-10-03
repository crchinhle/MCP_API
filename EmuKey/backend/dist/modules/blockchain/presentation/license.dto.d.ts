export declare class LicensePlanDto {
    commitment: string;
    name: string;
    version: number;
}
export declare class LicenseProviderDto {
    displayName: string;
    organizationName: string | null;
}
export declare class LicenseProjectionDto {
    activationKeyAvailable?: boolean;
    blockNumber: number | null;
    confirmationCount: number;
    activeDeviceCount: number;
    deviceStateVersion: number;
    createdAt: string;
    entitlementVersion: number;
    expiresAt: string;
    finality: string;
    id: string;
    keyVersion: number;
    activationKeyTrustStatus: string;
    maxActiveDevices: number;
    originOrderId: string;
    periodStart: string;
    plan: LicensePlanDto;
    productName: string;
    provider: LicenseProviderDto;
    publicLicenseId: string;
    status: string;
    transactionHash: string | null;
    updatedAt: string;
}
export declare class ActivationKeyDto {
    activationKey: string;
    keyVersion: number;
}
export declare class LicenseDeviceDto {
    id: string;
    deviceRef: string;
    status: string;
    bindingGeneration: number;
    activatedAt: string | null;
    revokedAt: string | null;
}
export declare class PublicLicenseVerificationDto {
    blockNumber?: number | null;
    confirmationCount?: number;
    expiresAt?: string;
    finality?: string;
    licenseId?: string;
    plan?: LicensePlanDto;
    productName?: string;
    provider?: LicenseProviderDto;
    state: string;
    status?: string;
    transactionHash?: string | null;
}
