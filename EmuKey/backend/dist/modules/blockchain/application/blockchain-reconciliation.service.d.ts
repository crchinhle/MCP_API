import { Pool } from 'pg';
import { AuditWriter } from '../../../platform/audit/audit-writer.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { ChainCommandService } from './chain-command.service.js';
import type { ChainRpcIndexerPort } from './rpc-chain-indexer.service.js';
import type { ChainEventRepository } from '../infrastructure/chain-event.repository.js';
export declare class BlockchainReconciliationService {
    private readonly pool;
    private readonly commands;
    private readonly indexer;
    private readonly projections;
    private readonly audit;
    constructor(pool: Pool, commands: ChainCommandService, indexer: ChainRpcIndexerPort, projections: Pick<ChainEventRepository, 'reconcileCanonicalProjections' | 'deriveExpiredFromCanonicalChain'>, audit: AuditWriter);
    run(actor: AuthPrincipal): Promise<{
        health: {
            active_without_finality: number;
            pending_events: number;
            reorged_events: number;
            unknown_commands: number;
        } | undefined;
        indexedEvents: number;
        canonicalTime: string;
        expiredLicenseIds: string[];
        processed: boolean;
        projection: import("../infrastructure/chain-event.repository.js").CanonicalProjectionRepairReport;
        reconciledCommandIds: string[];
    }>;
    runAutomatic(workerId: string): Promise<{
        health: {
            active_without_finality: number;
            pending_events: number;
            reorged_events: number;
            unknown_commands: number;
        } | undefined;
        indexedEvents: number;
        canonicalTime: string;
        expiredLicenseIds: string[];
        processed: boolean;
        projection: import("../infrastructure/chain-event.repository.js").CanonicalProjectionRepairReport;
        reconciledCommandIds: string[];
    }>;
    recoverDeadLetter(actor: AuthPrincipal, commandId: string, request: {
        evidence?: Record<string, unknown>;
        mode: 'REQUEUE_NO_SUBMISSION' | 'RECONCILE_SAME_RAW' | 'ABANDON_REVERTED' | 'ABANDON_NO_EFFECT';
        reason: string;
    }): Promise<import("../infrastructure/chain-command.repository.js").ChainCommandRecord>;
    private reconcile;
}
