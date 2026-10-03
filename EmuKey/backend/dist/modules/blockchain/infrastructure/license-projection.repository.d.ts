import { Pool } from 'pg';
export declare class LicenseProjectionRepository {
    private readonly pool;
    constructor(pool: Pool);
    listProvider(providerUserId: string): Promise<{
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
    listCustomer(customerUserId: string): Promise<{
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
    findProvider(providerUserId: string, id: string): Promise<{
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
    } | null>;
    findCustomer(customerUserId: string, id: string): Promise<{
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
    } | null>;
    listCustomerDevices(customerUserId: string, licenseId: string): Promise<{
        activatedAt: unknown;
        bindingGeneration: number;
        deviceRef: string;
        id: string;
        revokedAt: unknown;
        status: string;
    }[]>;
    findPublic(publicId: string): Promise<{
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
    } | null>;
    activationCommand(customerUserId: string, id: string): Promise<{
        command_id: string;
        commitment: string;
        key_version: number;
        license_id: string;
    } | null>;
    entitlementContext(licenseId: string, deviceId: string): Promise<{
        bindingGeneration: number;
        deviceStatus: string;
        entitlementVersion: number;
        entitlements: Record<string, unknown>;
        expiresAt: Date;
        licenseFinality: string;
        keyVersion: number;
        status: string;
    } | null>;
    private map;
}
