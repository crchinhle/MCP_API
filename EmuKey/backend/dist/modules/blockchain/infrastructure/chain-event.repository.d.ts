import { Pool } from 'pg';
import { AuditWriter } from '../../../platform/audit/audit-writer.js';
export type ChainEventType = 'LICENSE_ISSUED' | 'LICENSE_RENEWED' | 'LICENSE_SUSPENDED' | 'LICENSE_RESUMED' | 'LICENSE_REVOKED' | 'KEY_ROTATED' | 'ACTIVE_DEVICE_COUNT_SYNCED';
export interface ObservedChainEvent {
    blockHash: string;
    blockNumber: number;
    chainCommandId: string;
    chainId: number;
    confirmationCount: number;
    contractAddress: string;
    eventType: ChainEventType;
    licenseDeviceId?: string;
    licenseId: string;
    logIndex: number;
    network: string;
    payload: Record<string, unknown>;
    providerUserId: string;
    transactionHash: string;
}
export interface CanonicalProjectionRepairReport {
    commandRepairs: number;
    licenseIds: string[];
    licenseRepairs: number;
    remainingMismatches: number;
}
export declare class ChainEventRepository {
    private readonly pool;
    private readonly audit;
    constructor(pool: Pool, audit?: AuditWriter);
    ingest(event: ObservedChainEvent): Promise<{
        created: boolean;
        id: string;
    }>;
    confirm(eventId: string, confirmations: number, canonicalBlockHash: string): Promise<boolean>;
    markReorged(eventId: string): Promise<void>;
    reconcileCanonicalProjections(limit?: number): Promise<CanonicalProjectionRepairReport>;
    deriveExpiredFromCanonicalChain(canonicalTime: Date): Promise<string[]>;
    private applyEvent;
    private rebuildProjection;
    private rebuildProjectionWithoutKeyReset;
    private projectionMismatches;
    private transaction;
}
