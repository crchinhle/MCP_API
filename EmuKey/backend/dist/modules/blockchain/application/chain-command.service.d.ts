import type { ActivationEnvelopePort } from './ports/activation-envelope.port.js';
import { type ChainRelayerPort } from './ports/chain-relayer.port.js';
import type { ChainCommandRepository } from '../infrastructure/chain-command.repository.js';
import type { ChainCommandRecord } from '../infrastructure/chain-command.repository.js';
import type { ActivationEnvelopeRecoveryService } from './activation-envelope-recovery.service.js';
export declare class ChainCommandService {
    private readonly repository;
    private readonly relayer;
    private readonly envelopes;
    private readonly recovery?;
    constructor(repository: ChainCommandRepository, relayer: ChainRelayerPort, envelopes: ActivationEnvelopePort, recovery?: ActivationEnvelopeRecoveryService | undefined);
    processNext(workerId: string): Promise<string | null>;
    reconcileUnknown(workerId: string): Promise<string | null>;
    reconcileReceipt(workerId: string): Promise<string | null>;
    recoverDeadLetter(commandId: string, mode: 'REQUEUE_NO_SUBMISSION' | 'RECONCILE_SAME_RAW' | 'ABANDON_REVERTED' | 'ABANDON_NO_EFFECT', reason: string, evidence?: Record<string, unknown>, actor?: {
        userId: string;
        role: string;
    }): Promise<ChainCommandRecord>;
    private input;
    private prepareTransaction;
    private requirePrepared;
    private toPrepared;
}
