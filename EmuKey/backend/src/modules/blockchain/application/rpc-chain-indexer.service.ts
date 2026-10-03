import type {
  ChainCommandEventContext,
  ChainIndexerCheckpointRepository,
  CheckpointOwner,
} from '../infrastructure/chain-indexer-checkpoint.repository.js';
import type {
  ChainEventRpcPort,
  RpcContractEvent,
} from '../infrastructure/viem-chain-event-source.js';
import type { ChainIndexerService } from './chain-indexer.service.js';
import type { ChainEventType } from '../infrastructure/chain-event.repository.js';

export const CHAIN_RPC_INDEXER = Symbol('CHAIN_RPC_INDEXER');

export interface ChainRpcIndexerPort {
  canonicalTime(): Promise<Date>;
  poll(workerId: string): Promise<number | null>;
}

export interface RpcChainIndexerOptions extends CheckpointOwner {
  batchSize: number;
  deploymentBlock: number;
  requiredConfirmations: number;
}

function bytes16ToUuid(value: unknown, name: string): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{32}$/.test(value)) {
    throw new Error(`CHAIN_EVENT_${name.toUpperCase()}_INVALID`);
  }
  const hex = value.slice(2).toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function eventType(log: RpcContractEvent): ChainEventType {
  switch (log.eventName) {
    case 'LicenseIssued':
      return 'LICENSE_ISSUED';
    case 'LicenseRenewed':
      return 'LICENSE_RENEWED';
    case 'ActivationKeyRotated':
      return 'KEY_ROTATED';
    case 'ActiveDeviceCountSynced':
      return 'ACTIVE_DEVICE_COUNT_SYNCED';
    case 'LicenseStatusChanged': {
      const status = Number(log.args.status);
      if (status === 1) return 'LICENSE_RESUMED';
      if (status === 2) return 'LICENSE_SUSPENDED';
      if (status === 3) return 'LICENSE_REVOKED';
      throw new Error('CHAIN_EVENT_LICENSE_STATUS_UNSUPPORTED');
    }
    default:
      throw new Error(`CHAIN_EVENT_${log.eventName}_UNSUPPORTED`);
  }
}

function eventPayload(log: RpcContractEvent): Record<string, unknown> {
  if (log.eventName === 'LicenseIssued') {
    return {
      activationCommitment: log.args.activationCommitment,
      expiresAt: new Date(Number(log.args.expiresAt) * 1_000).toISOString(),
      keyVersion: Number(log.args.activationKeyVersion),
      planCommitment: log.args.planCommitment,
      provider: log.args.provider,
    };
  }
  if (log.eventName === 'LicenseRenewed') {
    return {
      expiresAt: new Date(Number(log.args.expiresAt) * 1_000).toISOString(),
    };
  }
  if (log.eventName === 'ActivationKeyRotated') {
    return {
      activationCommitment: log.args.activationCommitment,
      keyVersion: Number(log.args.activationKeyVersion),
    };
  }
  if (log.eventName === 'ActiveDeviceCountSynced') {
    return {
      activeDeviceCount: Number(log.args.activeDeviceCount),
      deviceStateVersion: Number(log.args.deviceStateVersion),
    };
  }
  return {};
}

function identity(transactionHash: string, logIndex: number): string {
  return `${transactionHash.toLowerCase()}:${logIndex}`;
}

export class RpcChainIndexerService implements ChainRpcIndexerPort {
  private lastCompletedBlock: number | undefined;
  private rpcBlockRangeLimit: number | undefined;

  constructor(
    private readonly checkpoints: Pick<
      ChainIndexerCheckpointRepository,
      | 'claimRange'
      | 'commandContext'
      | 'completeRange'
      | 'eventIdentities'
      | 'release'
    >,
    private readonly indexer: Pick<
      ChainIndexerService,
      'ingest' | 'markReorged'
    >,
    private readonly rpc: ChainEventRpcPort,
    private readonly options: RpcChainIndexerOptions,
  ) {}

  async canonicalTime(): Promise<Date> {
    const latestBlock = await this.rpc.latestBlock();
    const finalizedBlock = latestBlock - this.options.requiredConfirmations + 1;
    if (finalizedBlock < this.options.deploymentBlock) {
      throw new Error('CHAIN_FINALIZED_HEAD_UNAVAILABLE');
    }
    return this.rpc.blockTimestamp(finalizedBlock);
  }

  async poll(workerId: string): Promise<number | null> {
    const latestBlock = await this.rpc.latestBlock();
    if (latestBlock < this.options.deploymentBlock) return null;
    if (
      this.lastCompletedBlock !== undefined &&
      latestBlock <= this.lastCompletedBlock
    ) {
      return null;
    }
    const range = await this.checkpoints.claimRange(
      this.options,
      workerId,
      this.options.deploymentBlock,
      latestBlock,
      this.options.batchSize,
      this.options.requiredConfirmations + 1,
    );
    if (!range) return null;
    try {
      const [logs, existing] = await Promise.all([
        this.contractEvents(range.fromBlock, range.toBlock),
        this.checkpoints.eventIdentities(
          this.options,
          range.fromBlock,
          range.toBlock,
        ),
      ]);
      const canonical = new Map(
        logs.map((log) => [
          identity(log.transactionHash, log.logIndex),
          log.blockHash.toLowerCase(),
        ]),
      );
      for (const stored of existing) {
        if (
          canonical.get(identity(stored.transactionHash, stored.logIndex)) !==
          stored.blockHash.toLowerCase()
        ) {
          await this.indexer.markReorged(stored.id);
        }
      }
      for (const log of logs) await this.ingest(log, latestBlock);
      await this.checkpoints.completeRange(
        this.options,
        workerId,
        range,
        await this.rpc.blockHash(range.toBlock),
      );
      this.lastCompletedBlock = range.toBlock;
      return logs.length;
    } catch (error) {
      await this.checkpoints.release(this.options, workerId);
      throw error;
    }
  }

  private async contractEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<RpcContractEvent[]> {
    if (this.rpcBlockRangeLimit !== undefined) {
      return this.contractEventsInChunks(
        fromBlock,
        toBlock,
        this.rpcBlockRangeLimit,
      );
    }
    try {
      return await this.rpc.contractEvents(fromBlock, toBlock);
    } catch (error) {
      const limit = this.providerBlockRangeLimit(error);
      const requestedSize = toBlock - fromBlock + 1;
      if (limit === null || limit >= requestedSize) throw error;
      this.rpcBlockRangeLimit = limit;
      return this.contractEventsInChunks(fromBlock, toBlock, limit);
    }
  }

  private async contractEventsInChunks(
    fromBlock: number,
    toBlock: number,
    size: number,
  ): Promise<RpcContractEvent[]> {
    const logs: RpcContractEvent[] = [];
    for (let chunkFrom = fromBlock; chunkFrom <= toBlock; chunkFrom += size) {
      const chunkTo = Math.min(chunkFrom + size - 1, toBlock);
      logs.push(...(await this.rpc.contractEvents(chunkFrom, chunkTo)));
    }
    return logs;
  }

  private providerBlockRangeLimit(error: unknown): number | null {
    const message = error instanceof Error ? error.message : String(error);
    const match = /up to (?:a )?(\d+) block range/i.exec(message);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private async ingest(
    log: RpcContractEvent,
    latestBlock: number,
  ): Promise<void> {
    const commandId = bytes16ToUuid(log.args.commandId, 'commandId');
    const licenseId = bytes16ToUuid(log.args.licenseId, 'licenseId');
    const context = await this.checkpoints.commandContext(commandId);
    // A fresh environment may start at a deployed contract's block after the
    // chain already contains events from another database. Preserve the
    // checkpoint and ignore those unowned historical events; a command that is
    // present but points at another license remains a hard integrity failure.
    if (!context) return;
    this.assertContext(context, licenseId);
    await this.indexer.ingest({
      blockHash: log.blockHash,
      blockNumber: Number(log.blockNumber),
      chainCommandId: context.commandId,
      chainId: this.options.chainId,
      confirmationCount: latestBlock - Number(log.blockNumber) + 1,
      contractAddress: this.options.contractAddress.toLowerCase(),
      eventType: eventType(log),
      ...(context.licenseDeviceId ? { licenseDeviceId: context.licenseDeviceId } : {}),
      licenseId,
      logIndex: log.logIndex,
      network: this.options.network.toLowerCase(),
      payload: eventPayload(log),
      providerUserId: context.providerUserId,
      transactionHash: log.transactionHash,
    });
  }

  private assertContext(
    context: ChainCommandEventContext | null,
    licenseId: string,
  ): asserts context is ChainCommandEventContext {
    if (!context || context.licenseId !== licenseId) {
      throw new Error('CHAIN_EVENT_COMMAND_CONTEXT_MISMATCH');
    }
  }
}
