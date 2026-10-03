import type { Mocked } from 'vitest';

import { ActivationEnvelopeRecoveryService } from '../../src/modules/blockchain/application/activation-envelope-recovery.service.js';
import type { ActivationEnvelopePort } from '../../src/modules/blockchain/application/ports/activation-envelope.port.js';
import type {
  ChainCommandRecord,
  ChainCommandRepository,
} from '../../src/modules/blockchain/infrastructure/chain-command.repository.js';

const command: ChainCommandRecord = {
  attemptCount: 1,
  chainId: 31_337,
  commandId: '00000000-0000-4000-8000-000000000901',
  commandType: 'ISSUE_LICENSE',
  contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  licenseId: '00000000-0000-4000-8000-000000000401',
  network: 'hardhat',
  nonce: null,
  payload: {
    activationCommitment: `0x${'11'.repeat(32)}`,
    keyVersion: 1,
  },
  payloadHash: `0x${'22'.repeat(32)}`,
  receiptStatus: null,
  relayerAddress: null,
  signedTransaction: null,
  status: 'PENDING',
  transactionHash: null,
};

describe('ActivationEnvelopeRecoveryService', () => {
  it('rotates durable commitment and recreates a missing envelope', async () => {
    const repository = {
      getLicenseCommitment: vi.fn().mockResolvedValue({
        commitment: command.payload.activationCommitment,
        keyVersion: 1,
      }),
      rotatePendingActivation: vi
        .fn()
        .mockImplementation(
          (
            current: ChainCommandRecord,
            commitment: string,
            keyVersion: number,
            payload: Record<string, unknown>,
            payloadHash: string,
          ) => ({
            ...current,
            payload,
            payloadHash,
          }),
        ),
    } as unknown as Mocked<ChainCommandRepository>;
    const envelopes = {
      prepare: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockResolvedValue(null),
    } as unknown as Mocked<ActivationEnvelopePort>;
    const service = new ActivationEnvelopeRecoveryService(
      repository,
      envelopes,
    );

    const recovered = await service.ensure(command);

    expect(recovered.payload.keyVersion).toBe(1);
    expect(recovered.payload.activationCommitment).not.toBe(
      command.payload.activationCommitment,
    );
    expect(repository.rotatePendingActivation.mock.calls).toHaveLength(1);
    expect(envelopes.prepare.mock.calls).toHaveLength(1);
  });

  it('never rotates after a nonce or transaction has been prepared', async () => {
    const prepared = { ...command, nonce: 3 };
    const repository = {
      getLicenseCommitment: vi.fn().mockResolvedValue({
        commitment: command.payload.activationCommitment,
        keyVersion: 1,
      }),
    } as unknown as Mocked<ChainCommandRepository>;
    const envelopes = {
      read: vi.fn().mockResolvedValue(null),
    } as unknown as Mocked<ActivationEnvelopePort>;
    const service = new ActivationEnvelopeRecoveryService(
      repository,
      envelopes,
    );

    await expect(service.ensure(prepared)).rejects.toThrow(
      'ACTIVATION_ROTATION_NOT_ALLOWED',
    );
  });
});
