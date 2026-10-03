import type {
  ChainEventRepository,
  ObservedChainEvent,
} from '../infrastructure/chain-event.repository.js';

export class ChainIndexerService {
  constructor(
    private readonly repository: ChainEventRepository,
    private readonly requiredConfirmations: number,
  ) {}

  async ingest(event: ObservedChainEvent) {
    const result = await this.repository.ingest(event);
    if (event.confirmationCount >= this.requiredConfirmations) {
      await this.confirm(result.id, event.confirmationCount, event.blockHash);
    }
    return result;
  }

  async confirm(
    eventId: string,
    confirmations: number,
    canonicalBlockHash: string,
  ) {
    if (confirmations < this.requiredConfirmations) {
      throw new Error('INSUFFICIENT_CONFIRMATIONS');
    }
    const confirmed = await this.repository.confirm(
      eventId,
      confirmations,
      canonicalBlockHash,
    );
    if (!confirmed) {
      await this.repository.markReorged(eventId);
      throw new Error('NON_CANONICAL_BLOCK');
    }
  }

  markReorged(eventId: string) {
    return this.repository.markReorged(eventId);
  }
}
