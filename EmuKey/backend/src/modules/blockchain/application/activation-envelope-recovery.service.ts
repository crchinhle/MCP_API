import { randomBytes } from 'node:crypto';

import { keccak256, stringToHex, type Hex } from 'viem';

import {
  activationCommitment,
  canonicalizeEntitlements,
} from '../../../platform/crypto/license-crypto.js';
import type { ChainCommandRepository } from '../infrastructure/chain-command.repository.js';
import type { ChainCommandRecord } from '../infrastructure/chain-command.repository.js';
import type { ActivationEnvelopePort } from './ports/activation-envelope.port.js';

const ACTIVATION_ENVELOPE_TTL_SECONDS = 86_400;

export class ActivationEnvelopeRecoveryService {
  constructor(
    private readonly repository: ChainCommandRepository,
    private readonly envelopes: ActivationEnvelopePort,
  ) {}

  async ensure(command: ChainCommandRecord): Promise<ChainCommandRecord> {
    if (!['ISSUE_LICENSE', 'ROTATE_KEY'].includes(command.commandType)) return command;
    const durable = command.commandType === 'ISSUE_LICENSE'
      ? await this.repository.getLicenseCommitment(command.licenseId)
      : await this.repository.getRotationCommitment(command.licenseId);
    if (!durable) throw new Error('ACTIVATION_LICENSE_NOT_RECOVERABLE');
    try {
      const envelope = await this.envelopes.read(command.commandId);
      if (
        envelope &&
        envelope.licenseId === command.licenseId &&
        envelope.commitment === durable.commitment &&
        envelope.keyVersion === durable.keyVersion &&
        command.payload.activationCommitment === durable.commitment &&
        command.payload.keyVersion === durable.keyVersion
      ) {
        return command;
      }
    } catch {
      // A missing or tampered Redis value is recovered only while no tx exists.
    }
    return this.recover(command);
  }

  async recoverById(
    commandId: string,
    licenseId: string,
  ): Promise<ChainCommandRecord> {
    const command = await this.repository.findRecoverableIssue(
      commandId,
      licenseId,
    );
    if (!command) throw new Error('ACTIVATION_ROTATION_NOT_ALLOWED');
    return this.recover(command);
  }

  private async recover(
    command: ChainCommandRecord,
  ): Promise<ChainCommandRecord> {
    if (
      command.transactionHash ||
      command.signedTransaction ||
      command.nonce !== null
    ) {
      throw new Error('ACTIVATION_ROTATION_NOT_ALLOWED');
    }
    const currentVersion = Number(command.payload.keyVersion);
    if (!Number.isSafeInteger(currentVersion) || currentVersion <= 0) {
      throw new Error('INVALID_ACTIVATION_KEY_VERSION');
    }
    const secret: Hex = `0x${randomBytes(32).toString('hex')}`;
    const commitment = activationCommitment(secret);
    const keyVersion = currentVersion;
    const payload = {
      ...command.payload,
      activationCommitment: commitment,
      keyVersion,
    };
    const payloadHash = keccak256(
      stringToHex(canonicalizeEntitlements(payload)),
    );
    const updated = await this.repository.rotatePendingActivation(
      command,
      commitment,
      keyVersion,
      payload,
      payloadHash,
    );
    await this.envelopes.prepare(
      {
        commandId: updated.commandId,
        commitment,
        keyVersion,
        licenseId: updated.licenseId,
        secret,
      },
      ACTIVATION_ENVELOPE_TTL_SECONDS,
    );
    return updated;
  }
}
