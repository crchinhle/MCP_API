import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { LicenseQueryService } from '../application/license-query.service.js';
export declare class LicenseController {
    private readonly service;
    constructor(service: LicenseQueryService);
    list(actor: AuthPrincipal): Promise<{
        blockNumber: number | null;
        confirmationCount: number;
        createdAt: unknown;
        entitlementVersion: number;
        expiresAt: unknown;
        finality: {};
        id: unknown;
        keyVersion: number;
        activationKeyTrustStatus: string;
        activeDeviceCount: number;
        deviceStateVersion: number;
        maxActiveDevices: number;
        originOrderId: string;
        periodStart: unknown;
        plan: {
            commitment: string;
            name: string;
            version: number;
        };
        productName: string;
        provider: {
            displayName: string;
            organizationName: string | null;
        };
        publicLicenseId: string;
        status: unknown;
        transactionHash: unknown;
        updatedAt: unknown;
    }[]>;
    find(actor: AuthPrincipal, id: string): Promise<{
        blockNumber: number | null;
        confirmationCount: number;
        createdAt: unknown;
        entitlementVersion: number;
        expiresAt: unknown;
        finality: {};
        id: unknown;
        keyVersion: number;
        activationKeyTrustStatus: string;
        activeDeviceCount: number;
        deviceStateVersion: number;
        maxActiveDevices: number;
        originOrderId: string;
        periodStart: unknown;
        plan: {
            commitment: string;
            name: string;
            version: number;
        };
        productName: string;
        provider: {
            displayName: string;
            organizationName: string | null;
        };
        publicLicenseId: string;
        status: unknown;
        transactionHash: unknown;
        updatedAt: unknown;
    }>;
    listDevices(actor: AuthPrincipal, id: string): Promise<{
        activatedAt: unknown;
        bindingGeneration: number;
        deviceRef: string;
        id: string;
        revokedAt: unknown;
        status: string;
    }[]>;
    retrieve(actor: AuthPrincipal, id: string): Promise<{
        activationKey: `0x${string}`;
        keyVersion: number;
    }>;
}
export declare class PublicLicenseController {
    private readonly service;
    constructor(service: LicenseQueryService);
    verify(publicId: string, requester: string): Promise<{
        blockNumber: number | null;
        confirmationCount: number;
        expiresAt: unknown;
        finality: {};
        licenseId: unknown;
        plan: {
            commitment: string;
            name: unknown;
            version: number;
        };
        productName: unknown;
        provider: {
            displayName: unknown;
            organizationName: unknown;
        };
        state: string;
        status: string;
        transactionHash: string | null;
    } | {
        state: string;
    }>;
}
