import { type Hex } from 'viem';
import { Pool } from 'pg';
import { AuditWriter } from '../../../platform/audit/audit-writer.js';
import type { LicenseLifecycleCommand } from '../licensing.types.js';
export interface LicenseCommandConfig {
    chainId: number;
    contractAddress: string;
    network: string;
}
export interface LicenseCommandResult {
    commandId: string;
    deviceId: string | null;
    licenseId: string;
    status: string;
    reused?: boolean;
}
export interface LicenseSecurityRecord {
    activationCommitment: Hex;
    activationKeyVersion: number;
    customerUserId: string;
    expiresAt: Date;
    id: string;
    maxActiveDevices: number;
    providerUserId: string;
    status: string;
}
export declare class LicensingRepository {
    private readonly pool;
    private readonly audit;
    constructor(pool: Pool, audit?: AuditWriter);
    commandStatus(actorUserId: string, commandId: string): Promise<{
        commandId: string;
        commandType: string;
        confirmedAt: string | null;
        deviceId: string | null;
        licenseId: string;
        status: string;
        transactionHash: string | null;
    } | null>;
    findSecurity(licenseId: string, actorUserId?: string): Promise<LicenseSecurityRecord | null>;
    findActivationLicense(activationCommitment: Hex): Promise<LicenseSecurityRecord | null>;
    findDevice(licenseId: string, deviceRef: string): Promise<{
        id: string;
        status: string;
        devicePublicKey: string;
        bindingGeneration: number;
    } | null>;
    findDeviceById(licenseId: string, deviceId: string): Promise<{
        id: string;
        deviceRef: string;
        status: string;
        devicePublicKey: string;
        bindingGeneration: number;
        activatedAt: unknown;
        revokedAt: unknown;
    } | null>;
    createDeviceCommand(actorUserId: string | null, licenseId: string, deviceRef: string, devicePublicKey: string, deviceId: string, expectedBindingGeneration: number, config: LicenseCommandConfig): Promise<LicenseCommandResult>;
    createDeviceRevokeCommand(actorUserId: string, licenseId: string, deviceRef: string, deviceId: string, expectedBindingGeneration: number, config: LicenseCommandConfig): Promise<LicenseCommandResult>;
    createRotationCommand(actorUserId: string, licenseId: string, commitment: Hex, nextVersion: number, config: LicenseCommandConfig): Promise<LicenseCommandResult>;
    createLifecycleCommand(actorUserId: string, licenseId: string, commandType: LicenseLifecycleCommand, config: LicenseCommandConfig, reason?: string): Promise<LicenseCommandResult>;
    private lockLicense;
    private requireCustomer;
    private requireUsableLicense;
    private bumpDeviceState;
    private insertCommand;
    private transaction;
}
