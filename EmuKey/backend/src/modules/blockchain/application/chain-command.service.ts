import type { ActivationEnvelopePort } from './ports/activation-envelope.port.js';
import {
  ChainSubmissionUnknownError,
  type ChainCommandInput,
  type ChainRelayerPort,
  type PreparedChainTransaction,
} from './ports/chain-relayer.port.js';
import type { ChainCommandRepository } from '../infrastructure/chain-command.repository.js';
import type { ChainCommandRecord } from '../infrastructure/chain-command.repository.js';
import type { ActivationEnvelopeRecoveryService } from './activation-envelope-recovery.service.js';

export class ChainCommandService {
  constructor(
    private readonly repository: ChainCommandRepository,
    private readonly relayer: ChainRelayerPort,
    private readonly envelopes: ActivationEnvelopePort,
    private readonly recovery?: ActivationEnvelopeRecoveryService,
  ) {}

  async processNext(workerId: string): Promise<string | null> {
    let command = await this.repository.claimNext(workerId);
    if (!command) return null;
    try {
      if (command.status === 'RETRYABLE_FAILED') {
        await this.repository.markPending(command.commandId, workerId);
      }
      if (command.commandType === 'ISSUE_LICENSE' || command.commandType === 'ROTATE_KEY') {
        if (this.recovery) command = await this.recovery.ensure(command);
        const [envelope, durable] = await Promise.all([
          this.envelopes.read(command.commandId),
          command.commandType === 'ISSUE_LICENSE'
            ? this.repository.getLicenseCommitment(command.licenseId)
            : this.repository.getRotationCommitment(command.licenseId),
        ]);
        if (
          !envelope ||
          !durable ||
          envelope.licenseId !== command.licenseId ||
          envelope.commitment !== durable.commitment ||
          envelope.keyVersion !== durable.keyVersion ||
          command.payload.activationCommitment !== durable.commitment ||
          command.payload.keyVersion !== durable.keyVersion
        ) {
          throw new Error('ACTIVATION_ENVELOPE_PRECONDITION_FAILED');
        }
      }
      const transaction = await this.prepareTransaction(command);
      await this.relayer.broadcast(transaction);
      await this.repository.markSubmitted(command.commandId);
      return command.commandId;
    } catch (error) {
      if (error instanceof ChainSubmissionUnknownError) {
        await this.repository.markUnknown(
          command.commandId,
          error.transactionHash ?? command.transactionHash ?? undefined,
        );
      } else {
        await this.repository.markFailure(
          command.commandId,
          command.attemptCount,
          error instanceof Error ? error.message : 'CHAIN_SUBMIT_FAILED',
        );
      }
      return command.commandId;
    }
  }

  async reconcileUnknown(workerId: string): Promise<string | null> {
    const command = await this.repository.claimUnknown(workerId);
    if (!command) return null;
    try {
      const transaction = this.requirePrepared(command);
      const receipt = await this.relayer.receipt(transaction.transactionHash);
      if (receipt?.status === 'REVERTED') {
        await this.repository.markReverted(command.commandId, receipt);
      } else if (receipt) {
        await this.repository.markReceipt(command.commandId, receipt);
        await this.repository.markSubmitted(command.commandId);
      } else {
        await this.relayer.broadcast(transaction);
        await this.repository.markSubmitted(command.commandId);
      }
      return command.commandId;
    } catch (error) {
      if (error instanceof ChainSubmissionUnknownError) {
        await this.repository.markUnknown(
          command.commandId,
          error.transactionHash ?? command.transactionHash ?? undefined,
        );
        return command.commandId;
      }
      await this.repository.releaseUnknown(command.commandId);
      return command.commandId;
    }
  }

  async reconcileReceipt(workerId: string): Promise<string | null> {
    const command = await this.repository.claimSubmitted(workerId);
    if (!command) return null;
    try {
      const transaction = this.requirePrepared(command);
      const receipt = await this.relayer.receipt(transaction.transactionHash);
      if (!receipt) {
        await this.repository.releaseSubmitted(command.commandId);
      } else if (receipt.status === 'REVERTED') {
        await this.repository.markReverted(command.commandId, receipt);
      } else {
        await this.repository.markReceipt(command.commandId, receipt);
      }
      return command.commandId;
    } catch {
      await this.repository.releaseSubmitted(command.commandId);
      return command.commandId;
    }
  }

  recoverDeadLetter(
    commandId: string,
    mode: 'REQUEUE_NO_SUBMISSION' | 'RECONCILE_SAME_RAW' | 'ABANDON_REVERTED' | 'ABANDON_NO_EFFECT',
    reason: string,
    evidence?: Record<string, unknown>,
    actor?: { userId: string; role: string },
  ) {
    return this.repository.recoverDeadLetter(commandId, mode, reason, evidence, actor);
  }

  private input(command: ChainCommandRecord): ChainCommandInput {
    return {
      chainId: command.chainId,
      commandId: command.commandId,
      commandType: command.commandType,
      contractAddress: command.contractAddress,
      network: command.network,
      payload: command.payload,
      payloadHash: command.payloadHash,
    };
  }

  private async prepareTransaction(
    command: ChainCommandRecord,
  ): Promise<PreparedChainTransaction> {
    if (command.signedTransaction || command.transactionHash) {
      return this.requirePrepared(command);
    }
    const input = this.input(command);
    let nonce = command.nonce;
    let relayerAddress = command.relayerAddress;
    if (nonce === null || !relayerAddress) {
      const context = await this.relayer.getSubmissionContext(input);
      relayerAddress = context.relayerAddress;
      nonce = await this.repository.reserveNonce(
        command.commandId,
        relayerAddress,
        context.pendingNonce,
      );
    }
    const transaction = await this.relayer.prepare(input, nonce);
    if (
      transaction.relayerAddress.toLowerCase() !== relayerAddress.toLowerCase()
    ) {
      throw new Error('CHAIN_RELAYER_CHANGED_DURING_PREPARATION');
    }
    return this.toPrepared(
      await this.repository.markPrepared(command.commandId, transaction),
    );
  }

  private requirePrepared(
    command: ChainCommandRecord,
  ): PreparedChainTransaction {
    if (
      command.nonce === null ||
      !command.relayerAddress ||
      !command.signedTransaction ||
      !command.transactionHash
    ) {
      throw new Error('CHAIN_TRANSACTION_NOT_PREPARED');
    }
    return this.toPrepared(command);
  }

  private toPrepared(command: ChainCommandRecord): PreparedChainTransaction {
    return {
      network: command.network,
      nonce: command.nonce!,
      rawTransaction: command.signedTransaction!,
      relayerAddress: command.relayerAddress!,
      transactionHash: command.transactionHash!,
    };
  }
}
