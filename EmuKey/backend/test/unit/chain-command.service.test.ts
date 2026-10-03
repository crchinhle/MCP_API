import type { Mocked } from 'vitest';

import { ChainCommandService } from '../../src/modules/blockchain/application/chain-command.service.js';
import type { ActivationEnvelopePort } from '../../src/modules/blockchain/application/ports/activation-envelope.port.js';
import {
  ChainSubmissionUnknownError,
  type ChainRelayerPort,
  type PreparedChainTransaction,
} from '../../src/modules/blockchain/application/ports/chain-relayer.port.js';
import type { ChainCommandRepository } from '../../src/modules/blockchain/infrastructure/chain-command.repository.js';

const transaction: PreparedChainTransaction = {
  network: 'hardhat',
  nonce: 7,
  rawTransaction: `0x${'ab'.repeat(80)}`,
  relayerAddress: '0x0000000000000000000000000000000000001337',
  transactionHash: `0x${'22'.repeat(32)}`,
};

const command = {
  attemptCount: 1,
  chainId: 31_337,
  commandId: '00000000-0000-4000-8000-000000000901',
  commandType: 'RENEW_LICENSE',
  contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  licenseId: '00000000-0000-4000-8000-000000000401',
  network: 'hardhat',
  nonce: null,
  payload: { expiresAt: '2028-01-01T00:00:00.000Z' },
  payloadHash: `0x${'11'.repeat(32)}`,
  receiptStatus: null,
  relayerAddress: null,
  signedTransaction: null,
  status: 'PENDING' as const,
  transactionHash: null,
};

const preparedCommand = {
  ...command,
  nonce: transaction.nonce,
  relayerAddress: transaction.relayerAddress,
  signedTransaction: transaction.rawTransaction,
  transactionHash: transaction.transactionHash,
};

describe('ChainCommandService durable submission handling', () => {
  it('reopens a retryable command before submitting it', async () => {
    const retryable = { ...command, status: 'RETRYABLE_FAILED' as const };
    const repository = {
      claimNext: vi.fn().mockResolvedValue(retryable),
      markPending: vi.fn().mockResolvedValue(undefined),
      markPrepared: vi.fn().mockResolvedValue(preparedCommand),
      markSubmitted: vi.fn().mockResolvedValue(undefined),
      reserveNonce: vi.fn().mockResolvedValue(7),
    } as unknown as Mocked<ChainCommandRepository>;
    const relayer = {
      broadcast: vi.fn().mockResolvedValue(undefined),
      getSubmissionContext: vi.fn().mockResolvedValue({ pendingNonce: 5, relayerAddress: transaction.relayerAddress }),
      prepare: vi.fn().mockResolvedValue(transaction),
      receipt: vi.fn(),
    } satisfies Mocked<ChainRelayerPort>;
    const service = new ChainCommandService(repository, relayer, {} as Mocked<ActivationEnvelopePort>);

    await service.processNext('worker-retry');

    expect(repository.markPending.mock.calls).toEqual([[command.commandId, 'worker-retry']]);
    expect(repository.markPrepared.mock.calls.length).toBeGreaterThan(0);
  });

  it('persists nonce and signed transaction before broadcasting', async () => {
    const repository = {
      claimNext: vi.fn().mockResolvedValue(command),
      markPrepared: vi.fn().mockResolvedValue(preparedCommand),
      markSubmitted: vi.fn().mockResolvedValue(undefined),
      reserveNonce: vi.fn().mockResolvedValue(7),
    } as unknown as Mocked<ChainCommandRepository>;
    const relayer = {
      broadcast: vi.fn().mockResolvedValue(undefined),
      getSubmissionContext: vi.fn().mockResolvedValue({
        pendingNonce: 5,
        relayerAddress: transaction.relayerAddress,
      }),
      prepare: vi.fn().mockResolvedValue(transaction),
      receipt: vi.fn(),
    } satisfies Mocked<ChainRelayerPort>;
    const service = new ChainCommandService(
      repository,
      relayer,
      {} as Mocked<ActivationEnvelopePort>,
    );

    await service.processNext('worker-a');

    expect(repository.reserveNonce.mock.calls[0]).toEqual([
      command.commandId,
      transaction.relayerAddress,
      5,
    ]);
    expect(repository.markPrepared.mock.invocationCallOrder[0]).toBeLessThan(
      relayer.broadcast.mock.invocationCallOrder[0]!,
    );
    expect(relayer.broadcast.mock.calls).toEqual([[transaction]]);
    expect(repository.markSubmitted.mock.calls).toEqual([[command.commandId]]);
  });

  it('rebroadcasts exactly the persisted transaction after an uncertain restart', async () => {
    const unknown = {
      ...preparedCommand,
      status: 'SUBMITTED_UNKNOWN' as const,
    };
    const repository = {
      claimUnknown: vi.fn().mockResolvedValue(unknown),
      markSubmitted: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<ChainCommandRepository>;
    const relayer = {
      broadcast: vi.fn().mockResolvedValue(undefined),
      getSubmissionContext: vi.fn(),
      prepare: vi.fn(),
      receipt: vi.fn().mockResolvedValue(null),
    } satisfies Mocked<ChainRelayerPort>;
    const service = new ChainCommandService(
      repository,
      relayer,
      {} as Mocked<ActivationEnvelopePort>,
    );

    await service.reconcileUnknown('replacement-worker');

    expect(relayer.prepare.mock.calls).toHaveLength(0);
    expect(relayer.broadcast.mock.calls).toEqual([[transaction]]);
    expect(repository.markSubmitted.mock.calls).toEqual([[command.commandId]]);
  });

  it('keeps an uncertain transaction for another lookup when RPC fails again', async () => {
    const unknown = {
      ...preparedCommand,
      status: 'SUBMITTED_UNKNOWN' as const,
    };
    const repository = {
      claimUnknown: vi.fn().mockResolvedValue(unknown),
      markUnknown: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<ChainCommandRepository>;
    const relayer = {
      broadcast: vi
        .fn()
        .mockRejectedValue(
          new ChainSubmissionUnknownError(transaction.transactionHash),
        ),
      getSubmissionContext: vi.fn(),
      prepare: vi.fn(),
      receipt: vi.fn().mockResolvedValue(null),
    } satisfies Mocked<ChainRelayerPort>;
    const service = new ChainCommandService(
      repository,
      relayer,
      {} as Mocked<ActivationEnvelopePort>,
    );

    await service.reconcileUnknown('reconciliation-worker');

    expect(repository.markUnknown.mock.calls).toEqual([
      [command.commandId, transaction.transactionHash],
    ]);
  });

  it('dead-letters a reverted receipt without issuing another transaction', async () => {
    const submitted = { ...preparedCommand, status: 'SUBMITTED' as const };
    const receipt = {
      blockHash: `0x${'33'.repeat(32)}`,
      blockNumber: 99,
      status: 'REVERTED' as const,
      transactionHash: transaction.transactionHash,
    };
    const repository = {
      claimSubmitted: vi.fn().mockResolvedValue(submitted),
      markReverted: vi.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<ChainCommandRepository>;
    const relayer = {
      broadcast: vi.fn(),
      getSubmissionContext: vi.fn(),
      prepare: vi.fn(),
      receipt: vi.fn().mockResolvedValue(receipt),
    } satisfies Mocked<ChainRelayerPort>;
    const service = new ChainCommandService(
      repository,
      relayer,
      {} as Mocked<ActivationEnvelopePort>,
    );

    await service.reconcileReceipt('receipt-worker');

    expect(repository.markReverted.mock.calls).toEqual([
      [command.commandId, receipt],
    ]);
    expect(relayer.broadcast.mock.calls).toHaveLength(0);
  });

  it('delegates an operator dead-letter recovery without preparing a replacement transaction', async () => {
    const repository = {
      recoverDeadLetter: vi.fn().mockResolvedValue({ ...preparedCommand, status: 'SUBMITTED_UNKNOWN' as const }),
    } as unknown as Mocked<ChainCommandRepository>;
    const service = new ChainCommandService(
      repository,
      {} as Mocked<ChainRelayerPort>,
      {} as Mocked<ActivationEnvelopePort>,
    );

    await expect(service.recoverDeadLetter(
      command.commandId,
      'RECONCILE_SAME_RAW',
      'RPC timeout requires same-raw reconciliation',
    )).resolves.toMatchObject({ status: 'SUBMITTED_UNKNOWN' });
    expect(repository.recoverDeadLetter.mock.calls).toEqual([[
      command.commandId,
      'RECONCILE_SAME_RAW',
      'RPC timeout requires same-raw reconciliation',
      undefined,
      undefined,
    ]]);
  });
});
