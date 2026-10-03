import type { ChainCommandRepository } from '../infrastructure/chain-command.repository.js';
import type { ChainCommandRecord } from '../infrastructure/chain-command.repository.js';
import type { ActivationEnvelopePort } from './ports/activation-envelope.port.js';
export declare class ActivationEnvelopeRecoveryService {
    private readonly repository;
    private readonly envelopes;
    constructor(repository: ChainCommandRepository, envelopes: ActivationEnvelopePort);
    ensure(command: ChainCommandRecord): Promise<ChainCommandRecord>;
    recoverById(commandId: string, licenseId: string): Promise<ChainCommandRecord>;
    private recover;
}
