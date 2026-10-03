import { Pool, type PoolClient } from 'pg';

import { AuditWriter } from '../../../platform/audit/audit-writer.js';
import type {
  ChainReceipt,
  PreparedChainTransaction,
} from '../application/ports/chain-relayer.port.js';

export type ChainCommandStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'SUBMITTED_UNKNOWN'
  | 'CONFIRMED'
  | 'RETRYABLE_FAILED'
  | 'DEAD_LETTER'
  | 'ABANDONED'
  | 'SUPERSEDED';

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

function mapCommand(row: Record<string, unknown>): ChainCommandRecord {
  const hash = row.payload_hash;
  if (!Buffer.isBuffer(hash)) throw new Error('INVALID_COMMAND_HASH');
  return {
    attemptCount: Number(row.attempt_count),
    chainId: Number(row.chain_id),
    commandId: String(row.id),
    commandType: String(row.command_type),
    contractAddress: String(row.contract_address),
    licenseId: String(row.license_id),
    network: String(row.network),
    payload: row.payload as Record<string, unknown>,
    payloadHash: `0x${hash.toString('hex')}`,
    nonce: row.nonce === null ? null : Number(row.nonce),
    receiptStatus:
      typeof row.receipt_status === 'string'
        ? (row.receipt_status as ChainCommandRecord['receiptStatus'])
        : null,
    relayerAddress:
      typeof row.relayer_address === 'string' ? row.relayer_address : null,
    signedTransaction:
      typeof row.signed_transaction === 'string'
        ? row.signed_transaction
        : null,
    status: row.status as ChainCommandStatus,
    transactionHash:
      typeof row.transaction_hash === 'string' ? row.transaction_hash : null,
  };
}

export class ChainCommandRepository {
  constructor(
    private readonly pool: Pool,
    private readonly audit = new AuditWriter(),
  ) {}

  async claimNext(workerId: string): Promise<ChainCommandRecord | null> {
    return this.transaction(async (client) => {
      const result = await client.query<Record<string, unknown>>(
        `WITH candidate AS (
           SELECT id FROM chain_commands
           WHERE status IN ('PENDING', 'RETRYABLE_FAILED')
             AND (next_attempt_at IS NULL OR next_attempt_at <= now())
             AND (locked_at IS NULL OR locked_at < now() - interval '2 minutes')
           ORDER BY created_at
           FOR UPDATE SKIP LOCKED LIMIT 1
         )
         UPDATE chain_commands c
         SET locked_by = $1, locked_at = now(), attempt_count = attempt_count + 1,
             updated_at = now()
         FROM candidate WHERE c.id = candidate.id
         RETURNING c.*`,
        [workerId],
      );
      return result.rows[0] ? mapCommand(result.rows[0]) : null;
    });
  }

  async markPending(id: string, workerId: string): Promise<void> {
    await this.transaction(async (client) => {
      const result = await client.query(
        `UPDATE chain_commands
         SET status='PENDING', next_attempt_at=NULL, locked_by=$2, locked_at=now(),
             last_error=NULL, updated_at=now()
         WHERE id=$1 AND status='RETRYABLE_FAILED' AND locked_by=$2
         RETURNING id`,
        [id, workerId],
      );
      if (result.rows[0]) {
        await this.audit.write(client, {
          action: 'CHAIN_COMMAND_REOPENED_FOR_RETRY',
          targetId: id,
          targetType: 'CHAIN_COMMAND',
        });
      } else {
        throw new Error('CHAIN_RETRY_CLAIM_LOST');
      }
    });
  }

  async recoverDeadLetter(
    commandId: string,
    mode: 'REQUEUE_NO_SUBMISSION' | 'RECONCILE_SAME_RAW' | 'ABANDON_REVERTED' | 'ABANDON_NO_EFFECT',
    reason: string,
    evidence?: Record<string, unknown>,
    actor?: { userId: string; role: string },
  ): Promise<ChainCommandRecord> {
    return this.transaction(async (client) => {
      const locked = await client.query<Record<string, unknown>>(
        `SELECT * FROM chain_commands WHERE id=$1 FOR UPDATE`,
        [commandId],
      );
      const current = locked.rows[0] ? mapCommand(locked.rows[0]) : null;
      if (!current) throw new Error('CHAIN_COMMAND_NOT_FOUND');
      if (current.status !== 'DEAD_LETTER') throw new Error('CHAIN_COMMAND_NOT_DEAD_LETTER');
      const detail = await client.query<Record<string, unknown>>(
        `SELECT receipt_status, signed_transaction, transaction_hash, nonce,
                relayer_address, resolution_evidence_type
         FROM chain_commands WHERE id=$1`,
        [commandId],
      );
      const row = detail.rows[0]!;
      const hasRaw = row.signed_transaction !== null || row.transaction_hash !== null;
      let query: string;
      let values: unknown[];
      if (mode === 'REQUEUE_NO_SUBMISSION') {
        // A reserved nonce is not a submitted transaction. Keep that reservation
        // unchanged so prepareTransaction retries the same nonce, never a new one.
        if (hasRaw) throw new Error('DEAD_LETTER_SUBMISSION_EVIDENCE_EXISTS');
        query = `UPDATE chain_commands
                 SET status='PENDING', next_attempt_at=NULL, last_error=NULL,
                     locked_by=NULL, locked_at=NULL, updated_at=now()
                 WHERE id=$1 AND status='DEAD_LETTER' RETURNING *`;
        values = [commandId];
      } else if (mode === 'RECONCILE_SAME_RAW') {
        if (row.signed_transaction === null || row.transaction_hash === null) {
          throw new Error('DEAD_LETTER_RAW_EVIDENCE_REQUIRED');
        }
        if (row.receipt_status === 'REVERTED') throw new Error('DEAD_LETTER_REVERTED_IS_FINAL');
        query = `UPDATE chain_commands
                 SET status='SUBMITTED_UNKNOWN', locked_by=NULL, locked_at=NULL,
                     last_error='MANUAL_SAME_RAW_RECONCILIATION', updated_at=now()
                 WHERE id=$1 AND status='DEAD_LETTER' RETURNING *`;
        values = [commandId];
      } else if (mode === 'ABANDON_REVERTED') {
        if (row.receipt_status !== 'REVERTED') throw new Error('DEAD_LETTER_REVERTED_RECEIPT_REQUIRED');
        query = `UPDATE chain_commands
                 SET status='ABANDONED', resolution_reason=$2,
                     resolution_evidence_type='RECEIPT_REVERTED',
                     resolution_evidence=jsonb_build_object(
                       'rpcSource', $3::text,
                       'checkedAt', to_char(statement_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
                     locked_by=NULL, locked_at=NULL, updated_at=now()
                 WHERE id=$1 AND status='DEAD_LETTER' RETURNING *`;
        values = [commandId, reason, typeof evidence?.rpcSource === 'string' ? evidence.rpcSource : 'manual-operator'];
      } else {
        if (!hasRaw || row.receipt_status !== null) throw new Error('DEAD_LETTER_NO_EFFECT_EVIDENCE_INVALID');
        const noEffect = evidence ?? {};
        for (const key of ['rpcSource', 'finalizedBlockNumber', 'finalizedBlockHash', 'observedNonce', 'consumingTransactionHash']) {
          if (noEffect[key] === undefined) throw new Error('DEAD_LETTER_NO_EFFECT_EVIDENCE_REQUIRED');
        }
        if (noEffect.contractStateNoEffect !== true) throw new Error('DEAD_LETTER_NO_EFFECT_PROOF_REQUIRED');
        query = `UPDATE chain_commands
                 SET status='ABANDONED', resolution_reason=$2,
                     resolution_evidence_type='RAW_TX_IRREVOCABLE_NO_EFFECT',
                     resolution_evidence=$3::jsonb,
                     locked_by=NULL, locked_at=NULL, updated_at=now()
                 WHERE id=$1 AND status='DEAD_LETTER' RETURNING *`;
        values = [
          commandId,
          reason,
          JSON.stringify({ ...noEffect, checkedAt: noEffect.checkedAt ?? new Date().toISOString() }),
        ];
      }
      const updated = await client.query<Record<string, unknown>>(query, values);
      if (!updated.rows[0]) throw new Error('CHAIN_COMMAND_RECOVERY_CONFLICT');
      await this.audit.write(client, {
        action: 'CHAIN_COMMAND_DEAD_LETTER_RECOVERED',
        ...(actor ? { actorRole: actor.role, actorUserId: actor.userId } : {}),
        metadata: { mode, evidenceType: mode === 'ABANDON_REVERTED' ? 'RECEIPT_REVERTED' : mode === 'ABANDON_NO_EFFECT' ? 'RAW_TX_IRREVOCABLE_NO_EFFECT' : null },
        reason,
        targetId: commandId,
        targetType: 'CHAIN_COMMAND',
      });
      return mapCommand(updated.rows[0]);
    });
  }

  async claimUnknown(workerId: string): Promise<ChainCommandRecord | null> {
    return this.claimStatus(workerId, 'SUBMITTED_UNKNOWN');
  }

  async claimSubmitted(workerId: string): Promise<ChainCommandRecord | null> {
    return this.claimStatus(workerId, 'SUBMITTED', true);
  }

  async getLicenseCommitment(licenseId: string): Promise<{
    commitment: string;
    keyVersion: number;
  } | null> {
    const result = await this.pool.query<{
      activation_commitment: Buffer;
      activation_key_version: number;
    }>(
      `SELECT activation_commitment, activation_key_version FROM licenses
       WHERE id = $1 AND status = 'PENDING_ONCHAIN'`,
      [licenseId],
    );
    const row = result.rows[0];
    return row
      ? {
          commitment: `0x${row.activation_commitment.toString('hex')}`,
          keyVersion: Number(row.activation_key_version),
        }
      : null;
  }

  async getRotationCommitment(licenseId: string): Promise<{
    commitment: string;
    keyVersion: number;
  } | null> {
    const result = await this.pool.query<{
      pending_activation_commitment: Buffer | null;
      pending_activation_key_version: number | null;
    }>(
      `SELECT pending_activation_commitment, pending_activation_key_version
       FROM licenses WHERE id = $1`,
      [licenseId],
    );
    const row = result.rows[0];
    return row?.pending_activation_commitment && row.pending_activation_key_version
      ? {
          commitment: `0x${row.pending_activation_commitment.toString('hex')}`,
          keyVersion: Number(row.pending_activation_key_version),
        }
      : null;
  }

  async findRecoverableIssue(
    commandId: string,
    licenseId: string,
  ): Promise<ChainCommandRecord | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM chain_commands
        WHERE id = $1 AND license_id = $2 AND command_type IN ('ISSUE_LICENSE', 'ROTATE_KEY')
          AND status IN ('PENDING', 'RETRYABLE_FAILED', 'DEAD_LETTER')
         AND transaction_hash IS NULL AND signed_transaction IS NULL`,
      [commandId, licenseId],
    );
    return result.rows[0] ? mapCommand(result.rows[0]) : null;
  }

  async rotatePendingActivation(
    command: ChainCommandRecord,
    commitment: string,
    keyVersion: number,
    payload: Record<string, unknown>,
    payloadHash: string,
  ): Promise<ChainCommandRecord> {
    return this.transaction(async (client) => {
      const locked = await client.query<Record<string, unknown>>(
        `SELECT * FROM chain_commands
          WHERE id = $1 AND license_id = $2 AND command_type IN ('ISSUE_LICENSE', 'ROTATE_KEY')
           AND status IN ('PENDING', 'RETRYABLE_FAILED', 'DEAD_LETTER')
           AND transaction_hash IS NULL AND signed_transaction IS NULL
         FOR UPDATE`,
        [command.commandId, command.licenseId],
      );
      const current = locked.rows[0] ? mapCommand(locked.rows[0]) : null;
      if (!current) throw new Error('ACTIVATION_ROTATION_NOT_ALLOWED');
      if (current.payload.keyVersion !== command.payload.keyVersion) {
        throw new Error('ACTIVATION_RECOVERY_CONFLICT');
      }
      await client.query(
        `UPDATE licenses
          SET activation_commitment = CASE WHEN $4 = 'ISSUE_LICENSE' THEN decode($2, 'hex') ELSE activation_commitment END,
              activation_key_version = CASE WHEN $4 = 'ISSUE_LICENSE' THEN $3 ELSE activation_key_version END,
              pending_activation_commitment = CASE WHEN $4 = 'ROTATE_KEY' THEN decode($2, 'hex') ELSE NULL END,
              pending_activation_key_version = CASE WHEN $4 = 'ROTATE_KEY' THEN $3 ELSE NULL END,
              updated_at = now()
          WHERE id = $1`,
        [command.licenseId, commitment.slice(2), keyVersion, command.commandType],
      );
      const updated = await client.query<Record<string, unknown>>(
        `UPDATE chain_commands
         SET payload = $2, payload_hash = decode($3, 'hex'), updated_at = now()
         WHERE id = $1 RETURNING *`,
        [command.commandId, JSON.stringify(payload), payloadHash.slice(2)],
      );
      await this.audit.write(client, {
        action: 'ACTIVATION_ENVELOPE_RECOVERED',
        metadata: { keyVersion },
        targetId: command.commandId,
        targetType: 'CHAIN_COMMAND',
      });
      return mapCommand(updated.rows[0]!);
    });
  }

  async reserveNonce(
    id: string,
    relayerAddress: string,
    suggestedNonce: number,
  ): Promise<number> {
    if (!Number.isSafeInteger(suggestedNonce) || suggestedNonce < 0) {
      throw new Error('INVALID_RELAYER_NONCE');
    }
    return this.transaction(async (client) => {
      const lockKey = `chain-nonce:${relayerAddress.toLowerCase()}`;
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [lockKey],
      );
      const current = await client.query<{
        chain_id: string;
        network: string;
        nonce: string | null;
        relayer_address: string | null;
      }>(
        `SELECT network, chain_id, relayer_address, nonce
         FROM chain_commands WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const row = current.rows[0];
      if (!row) throw new Error('CHAIN_COMMAND_NOT_FOUND');
      if (
        row.relayer_address &&
        row.relayer_address.toLowerCase() !== relayerAddress.toLowerCase()
      ) {
        throw new Error('CHAIN_RELAYER_CHANGED_AFTER_NONCE_RESERVATION');
      }
      if (row.nonce !== null) return Number(row.nonce);
      const reserved = await client.query<{ nonce: string }>(
        `WITH next_nonce AS (
           SELECT GREATEST(
             $4::bigint,
             COALESCE(MAX(nonce) + 1, 0)
           ) AS value
           FROM chain_commands
           WHERE network = $2 AND chain_id = $3
             AND lower(relayer_address) = lower($5)
         )
         UPDATE chain_commands
         SET relayer_address = $5, nonce = next_nonce.value, updated_at = now()
         FROM next_nonce
         WHERE id = $1
         RETURNING nonce`,
        [id, row.network, row.chain_id, suggestedNonce, relayerAddress],
      );
      return Number(reserved.rows[0]!.nonce);
    });
  }

  async markPrepared(
    id: string,
    transaction: PreparedChainTransaction,
  ): Promise<ChainCommandRecord> {
    const result = await this.pool.query<Record<string, unknown>>(
      `UPDATE chain_commands
       SET signed_transaction = $2, transaction_hash = $3, updated_at = now()
       WHERE id = $1 AND nonce = $4 AND lower(relayer_address) = lower($5)
         AND signed_transaction IS NULL
       RETURNING *`,
      [
        id,
        transaction.rawTransaction,
        transaction.transactionHash,
        transaction.nonce,
        transaction.relayerAddress,
      ],
    );
    if (!result.rows[0]) {
      const existing = await this.pool.query<Record<string, unknown>>(
        'SELECT * FROM chain_commands WHERE id = $1',
        [id],
      );
      if (!existing.rows[0]) throw new Error('CHAIN_COMMAND_NOT_FOUND');
      const command = mapCommand(existing.rows[0]);
      if (
        command.nonce !== transaction.nonce ||
        command.relayerAddress?.toLowerCase() !==
          transaction.relayerAddress.toLowerCase() ||
        command.transactionHash !== transaction.transactionHash ||
        command.signedTransaction !== transaction.rawTransaction
      ) {
        throw new Error('CHAIN_TRANSACTION_PREPARATION_CONFLICT');
      }
      return command;
    }
    return mapCommand(result.rows[0]);
  }

  async markSubmitted(id: string): Promise<void> {
    await this.transaction(async (client) => {
      const result = await client.query<{
        chain_id: number;
        network: string;
        transaction_hash: string;
      }>(
        `UPDATE chain_commands SET status = 'SUBMITTED',
           submitted_at = COALESCE(submitted_at, now()), locked_by = NULL,
           locked_at = NULL, last_error = NULL, updated_at = now()
         WHERE id = $1 AND transaction_hash IS NOT NULL
           AND signed_transaction IS NOT NULL
         RETURNING network, chain_id, transaction_hash`,
        [id],
      );
      if (result.rows[0]) {
        await this.audit.write(client, {
          action: 'CHAIN_COMMAND_SUBMITTED',
          metadata: {
            chainId: Number(result.rows[0].chain_id),
            network: result.rows[0].network,
            transactionHash: result.rows[0].transaction_hash,
          },
          targetId: id,
          targetType: 'CHAIN_COMMAND',
        });
      }
    });
  }

  async markUnknown(id: string, transactionHash?: string): Promise<void> {
    await this.transaction(async (client) => {
      // Broadcast can lose its response before markSubmitted runs. Record the
      // attempted submission and uncertainty atomically, following the DB state
      // machine while retaining the persisted nonce, hash, and signed bytes.
      await client.query(
        `UPDATE chain_commands SET status = 'SUBMITTED',
           submitted_at = COALESCE(submitted_at, now()), updated_at = now()
         WHERE id = $1 AND status = 'PENDING'
           AND transaction_hash IS NOT NULL AND signed_transaction IS NOT NULL`,
        [id],
      );
      const result = await client.query(
        `UPDATE chain_commands SET status = 'SUBMITTED_UNKNOWN',
           transaction_hash = COALESCE($2, transaction_hash), locked_by = NULL,
           locked_at = NULL, last_error = 'RPC response unknown', updated_at = now()
         WHERE id = $1 RETURNING id`,
        [id, transactionHash ?? null],
      );
      if (result.rows[0]) {
        await this.audit.write(client, {
          action: 'CHAIN_COMMAND_SUBMISSION_UNKNOWN',
          metadata: { transactionHash: transactionHash ?? null },
          targetId: id,
          targetType: 'CHAIN_COMMAND',
        });
      }
    });
  }

  async markReceipt(id: string, receipt: ChainReceipt): Promise<void> {
    await this.pool.query(
      `UPDATE chain_commands
       SET receipt_status = $2,
           receipt_block_number = COALESCE($3, receipt_block_number),
           receipt_block_hash = COALESCE($4, receipt_block_hash),
           receipt_checked_at = now(), locked_by = NULL, locked_at = NULL,
           updated_at = now()
       WHERE id = $1 AND transaction_hash = $5`,
      [
        id,
        receipt.status,
        receipt.blockNumber ?? null,
        receipt.blockHash ?? null,
        receipt.transactionHash,
      ],
    );
  }

  async markReverted(id: string, receipt: ChainReceipt): Promise<void> {
    await this.transaction(async (client) => {
      const result = await client.query(
        `UPDATE chain_commands
         SET status = 'DEAD_LETTER', receipt_status = 'REVERTED',
             receipt_block_number = $2, receipt_block_hash = $3,
             receipt_checked_at = now(), last_error = 'CHAIN_TRANSACTION_REVERTED',
             locked_by = NULL, locked_at = NULL, updated_at = now()
         WHERE id = $1 AND transaction_hash = $4 RETURNING id`,
        [
          id,
          receipt.blockNumber ?? null,
          receipt.blockHash ?? null,
          receipt.transactionHash,
        ],
      );
      if (result.rows[0]) {
        await this.audit.write(client, {
          action: 'CHAIN_COMMAND_TRANSACTION_REVERTED',
          metadata: { transactionHash: receipt.transactionHash },
          outcome: 'FAILED',
          reason: 'CHAIN_TRANSACTION_REVERTED',
          targetId: id,
          targetType: 'CHAIN_COMMAND',
        });
      }
    });
  }

  async markFailure(
    id: string,
    attemptCount: number,
    message: string,
  ): Promise<void> {
    const terminal = attemptCount >= 5;
    const status = terminal ? 'DEAD_LETTER' : 'RETRYABLE_FAILED';
    const reason = message.slice(0, 500);
    await this.transaction(async (client) => {
      const result = await client.query(
        `UPDATE chain_commands SET status = $2::varchar, last_error = $3,
           next_attempt_at = CASE WHEN $2::varchar = 'RETRYABLE_FAILED'
             THEN now() + make_interval(secs => LEAST(300, power(2, $4)::int)) END,
           locked_by = NULL, locked_at = NULL, updated_at = now()
         WHERE id = $1 RETURNING id`,
        [id, status, reason, attemptCount],
      );
      if (result.rows[0]) {
        await this.audit.write(client, {
          action: terminal
            ? 'CHAIN_COMMAND_DEAD_LETTERED'
            : 'CHAIN_COMMAND_RETRY_SCHEDULED',
          metadata: { attemptCount, status },
          outcome: 'FAILED',
          reason,
          targetId: id,
          targetType: 'CHAIN_COMMAND',
        });
      }
    });
  }

  async releaseUnknown(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE chain_commands SET locked_by = NULL, locked_at = NULL,
         updated_at = now() WHERE id = $1`,
      [id],
    );
  }

  async releaseSubmitted(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE chain_commands SET locked_by = NULL, locked_at = NULL,
         receipt_checked_at = now(), updated_at = now() WHERE id = $1`,
      [id],
    );
  }

  private async claimStatus(
    workerId: string,
    status: ChainCommandStatus,
    excludeSuccessfulReceipt = false,
  ): Promise<ChainCommandRecord | null> {
    return this.transaction(async (client) => {
      const result = await client.query<Record<string, unknown>>(
        `WITH candidate AS (
           SELECT id FROM chain_commands WHERE status = $2
             AND (NOT $3::boolean OR receipt_status IS DISTINCT FROM 'SUCCESS')
             AND (locked_at IS NULL OR locked_at < now() - interval '2 minutes')
           ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 1
         )
         UPDATE chain_commands c SET locked_by = $1, locked_at = now(), updated_at = now()
         FROM candidate WHERE c.id = candidate.id RETURNING c.*`,
        [workerId, status, excludeSuccessfulReceipt],
      );
      return result.rows[0] ? mapCommand(result.rows[0]) : null;
    });
  }

  private async transaction<T>(
    work: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
