import { Pool } from 'pg';
import { AuditWriter } from '../../../platform/audit/audit-writer.js';
import type { ChainReceipt, PreparedChainTransaction } from '../application/ports/chain-relayer.port.js';
export type ChainCommandStatus = 'PENDING' | 'SUBMITTED' | 'SUBMITTED_UNKNOWN' | 'CONFIRMED' | 'RETRYABLE_FAILED' | 'DEAD_LETTER' | 'ABANDONED' | 'SUPERSEDED';
export interface ChainCommandRecord {
    attemptCount: number;
    chainId: number;
    commandId: string;
    commandType: string;
    contractAddress: string;
    licenseId: string;
    network: string;
    payload: Record<string, unknown>;
    payloadHash: string;
    nonce: number | null;
    receiptStatus: 'PENDING' | 'REVERTED' | 'SUCCESS' | null;
    relayerAddress: string | null;
    signedTransaction: string | null;
    status: ChainCommandStatus;
    transactionHash: string | null;
}
export declare class ChainCommandRepository {
    private readonly pool;
    private readonly audit;
    constructor(pool: Pool, audit?: AuditWriter);
    claimNext(workerId: string): Promise<ChainCommandRecord | null>;
    markPending(id: string, workerId: string): Promise<void>;
    recoverDeadLetter(commandId: string, mode: 'REQUEUE_NO_SUBMISSION' | 'RECONCILE_SAME_RAW' | 'ABANDON_REVERTED' | 'ABANDON_NO_EFFECT', reason: string, evidence?: Record<string, unknown>, actor?: {
        userId: string;
        role: string;
    }): Promise<ChainCommandRecord>;
    claimUnknown(workerId: string): Promise<ChainCommandRecord | null>;
    claimSubmitted(workerId: string): Promise<ChainCommandRecord | null>;
    getLicenseCommitment(licenseId: string): Promise<{
        commitment: string;
        keyVersion: number;
    } | null>;
    getRotationCommitment(licenseId: string): Promise<{
        commitment: string;
        keyVersion: number;
    } | null>;
    findRecoverableIssue(commandId: string, licenseId: string): Promise<ChainCommandRecord | null>;
    rotatePendingActivation(command: ChainCommandRecord, commitment: string, keyVersion: number, payload: Record<string, unknown>, payloadHash: string): Promise<ChainCommandRecord>;
    reserveNonce(id: string, relayerAddress: string, suggestedNonce: number): Promise<number>;
    markPrepared(id: string, transaction: PreparedChainTransaction): Promise<ChainCommandRecord>;
    markSubmitted(id: string): Promise<void>;
    markUnknown(id: string, transactionHash?: string): Promise<void>;
    markReceipt(id: string, receipt: ChainReceipt): Promise<void>;
    markReverted(id: string, receipt: ChainReceipt): Promise<void>;
    markFailure(id: string, attemptCount: number, message: string): Promise<void>;
    releaseUnknown(id: string): Promise<void>;
    releaseSubmitted(id: string): Promise<void>;
    private claimStatus;
    private transaction;
}
