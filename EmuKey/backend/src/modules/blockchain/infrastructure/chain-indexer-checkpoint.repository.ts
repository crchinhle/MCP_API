import { Pool } from 'pg';

export interface ClaimedBlockRange {
  fromBlock: number;
  toBlock: number;
}

export interface IndexedEventIdentity {
  blockHash: string;
  id: string;
  logIndex: number;
  transactionHash: string;
}

export interface ChainCommandEventContext {
  commandId: string;
  licenseDeviceId?: string;
  licenseId: string;
  providerUserId: string;
}

export interface CheckpointOwner {
  chainId: number;
  contractAddress: string;
  network: string;
}

export class ChainIndexerCheckpointRepository {
  constructor(private readonly pool: Pool) {}

  async claimRange(
    owner: CheckpointOwner,
    workerId: string,
    deploymentBlock: number,
    latestBlock: number,
    batchSize: number,
    overlap: number,
  ): Promise<ClaimedBlockRange | null> {
    await this.pool.query(
      `INSERT INTO chain_indexer_checkpoints
         (network, chain_id, contract_address, next_block)
       VALUES ($1, $2, lower($3), $4)
       ON CONFLICT DO NOTHING`,
      [owner.network, owner.chainId, owner.contractAddress, deploymentBlock],
    );
    const result = await this.pool.query<{ next_block: string }>(
      `UPDATE chain_indexer_checkpoints
       SET locked_by=$4, locked_at=now(), updated_at=now()
       WHERE network=$1 AND chain_id=$2 AND contract_address=lower($3)
         AND (locked_at IS NULL OR locked_at < now() - interval '2 minutes')
       RETURNING next_block`,
      [owner.network, owner.chainId, owner.contractAddress, workerId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const nextBlock = Number(row.next_block);
    const fromBlock = Math.max(deploymentBlock, nextBlock - overlap);
    return {
      fromBlock,
      toBlock: Math.min(latestBlock, fromBlock + batchSize - 1),
    };
  }

  async completeRange(
    owner: CheckpointOwner,
    workerId: string,
    range: ClaimedBlockRange,
    blockHash: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE chain_indexer_checkpoints
       SET next_block=GREATEST(next_block,$5), last_scanned_block=$6,
           last_scanned_block_hash=$7, locked_by=NULL, locked_at=NULL,
           updated_at=now()
       WHERE network=$1 AND chain_id=$2 AND contract_address=lower($3)
         AND locked_by=$4`,
      [
        owner.network,
        owner.chainId,
        owner.contractAddress,
        workerId,
        range.toBlock + 1,
        range.toBlock,
        blockHash,
      ],
    );
  }

  async release(owner: CheckpointOwner, workerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE chain_indexer_checkpoints SET locked_by=NULL, locked_at=NULL,
         updated_at=now()
       WHERE network=$1 AND chain_id=$2 AND contract_address=lower($3)
         AND locked_by=$4`,
      [owner.network, owner.chainId, owner.contractAddress, workerId],
    );
  }

  async eventIdentities(
    owner: CheckpointOwner,
    fromBlock: number,
    toBlock: number,
  ): Promise<IndexedEventIdentity[]> {
    const result = await this.pool.query<{
      block_hash: string;
      id: string;
      log_index: number;
      transaction_hash: string;
    }>(
      `SELECT id, block_hash, transaction_hash, log_index
       FROM chain_events
       WHERE network=$1 AND chain_id=$2 AND lower(contract_address)=lower($3)
         AND block_number BETWEEN $4 AND $5 AND finality_status <> 'REORGED'`,
      [owner.network, owner.chainId, owner.contractAddress, fromBlock, toBlock],
    );
    return result.rows.map((row) => ({
      blockHash: row.block_hash,
      id: row.id,
      logIndex: Number(row.log_index),
      transactionHash: row.transaction_hash,
    }));
  }

  async commandContext(
    commandId: string,
  ): Promise<ChainCommandEventContext | null> {
    const result = await this.pool.query<{
      id: string;
      license_device_id: string | null;
      license_id: string;
      provider_user_id: string;
    }>(
      `SELECT id, provider_user_id, license_id, license_device_id
       FROM chain_commands WHERE id=$1`,
      [commandId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      commandId: row.id,
      ...(row.license_device_id
        ? { licenseDeviceId: row.license_device_id }
        : {}),
      licenseId: row.license_id,
      providerUserId: row.provider_user_id,
    };
  }
}
