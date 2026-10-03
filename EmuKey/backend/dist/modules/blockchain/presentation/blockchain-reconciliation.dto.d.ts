export declare class BlockchainHealthDto {
    active_without_finality: number;
    pending_events: number;
    reorged_events: number;
    unknown_commands: number;
}
export declare class BlockchainProjectionRepairDto {
    commandRepairs: number;
    licenseIds: string[];
    licenseRepairs: number;
    remainingMismatches: number;
}
export declare class BlockchainReconciliationDto {
    health: BlockchainHealthDto;
    indexedEvents: number;
    processed: boolean;
    projection: BlockchainProjectionRepairDto;
    reconciledCommandIds: string[];
}
export declare class DeadLetterRecoveryDto {
    evidence?: Record<string, unknown>;
    mode: 'REQUEUE_NO_SUBMISSION' | 'RECONCILE_SAME_RAW' | 'ABANDON_REVERTED' | 'ABANDON_NO_EFFECT';
    reason: string;
}
