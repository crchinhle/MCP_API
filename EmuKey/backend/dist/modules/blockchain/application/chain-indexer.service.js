export class ChainIndexerService {
    repository;
    requiredConfirmations;
    constructor(repository, requiredConfirmations) {
        this.repository = repository;
        this.requiredConfirmations = requiredConfirmations;
    }
    async ingest(event) {
        const result = await this.repository.ingest(event);
        if (event.confirmationCount >= this.requiredConfirmations) {
            await this.confirm(result.id, event.confirmationCount, event.blockHash);
        }
        return result;
    }
    async confirm(eventId, confirmations, canonicalBlockHash) {
        if (confirmations < this.requiredConfirmations) {
            throw new Error('INSUFFICIENT_CONFIRMATIONS');
        }
        const confirmed = await this.repository.confirm(eventId, confirmations, canonicalBlockHash);
        if (!confirmed) {
            await this.repository.markReorged(eventId);
            throw new Error('NON_CANONICAL_BLOCK');
        }
    }
    markReorged(eventId) {
        return this.repository.markReorged(eventId);
    }
}
//# sourceMappingURL=chain-indexer.service.js.map