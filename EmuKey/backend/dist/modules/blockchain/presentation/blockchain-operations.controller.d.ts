import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { BlockchainReconciliationService } from '../application/blockchain-reconciliation.service.js';
import { DeadLetterRecoveryDto } from './blockchain-reconciliation.dto.js';
export declare class BlockchainOperationsController {
    private readonly reconciliation;
    constructor(reconciliation: BlockchainReconciliationService);
    reconcile(actor: AuthPrincipal): Promise<{
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
    recoverDeadLetter(actor: AuthPrincipal, commandId: string, dto: DeadLetterRecoveryDto): Promise<import("../infrastructure/chain-command.repository.js").ChainCommandRecord>;
}
