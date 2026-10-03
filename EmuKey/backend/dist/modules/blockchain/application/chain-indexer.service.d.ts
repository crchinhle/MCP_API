import type { ChainEventRepository, ObservedChainEvent } from '../infrastructure/chain-event.repository.js';
export declare class ChainIndexerService {
    private readonly repository;
    private readonly requiredConfirmations;
    constructor(repository: ChainEventRepository, requiredConfirmations: number);
    ingest(event: ObservedChainEvent): Promise<{
        created: boolean;
        id: string;
    }>;
    confirm(eventId: string, confirmations: number, canonicalBlockHash: string): Promise<void>;
    markReorged(eventId: string): Promise<void>;
}
