import type { Hex } from 'viem';
import type { Pool } from 'pg';

import { RpcChainIndexerService } from '../../src/modules/blockchain/application/rpc-chain-indexer.service.js';
import { ChainIndexerCheckpointRepository } from '../../src/modules/blockchain/infrastructure/chain-indexer-checkpoint.repository.js';
import type { ObservedChainEvent } from '../../src/modules/blockchain/infrastructure/chain-event.repository.js';

function bytes16(value: string): Hex {
  return `0x${value.replaceAll('-', '')}`;
}

describe('RpcChainIndexerService', () => {
  it('keeps overlap inside the configured RPC batch limit', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ next_block: '100' }] });
    const repository = new ChainIndexerCheckpointRepository({
      query,
    } as unknown as Pool);

    await expect(
      repository.claimRange(
        {
          chainId: 31_337,
          contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
          network: 'hardhat',
        },
        'worker-1',
        1,
        200,
        10,
        3,
      ),
    ).resolves.toEqual({ fromBlock: 97, toBlock: 106 });
  });

  it('resumes from PostgreSQL, ingests canonical RPC logs and advances only after success', async () => {
    const commandId = '00000000-0000-4000-8000-000000000901';
    const licenseId = '00000000-0000-4000-8000-000000000401';
    const checkpoints = {
      claimRange: vi.fn().mockResolvedValue({ fromBlock: 10, toBlock: 20 }),
      commandContext: vi.fn().mockResolvedValue({
        commandId,
        licenseId,
        providerUserId: '00000000-0000-4000-8000-000000000002',
      }),
      completeRange: vi.fn().mockResolvedValue(undefined),
      eventIdentities: vi.fn().mockResolvedValue([
        {
          blockHash: `0x${'99'.repeat(32)}`,
          id: '00000000-0000-4000-8000-000000000801',
          logIndex: 2,
          transactionHash: `0x${'88'.repeat(32)}`,
        },
      ]),
      release: vi.fn().mockResolvedValue(undefined),
    };
    const indexer = {
      ingest: vi
        .fn<(event: ObservedChainEvent) => Promise<{ created: boolean; id: string }>>()
        .mockResolvedValue({ created: true, id: 'event-1' }),
      markReorged: vi.fn().mockResolvedValue(undefined),
    };
    const rpc = {
      blockHash: vi.fn().mockResolvedValue(`0x${'20'.repeat(32)}`),
      blockTimestamp: vi.fn().mockResolvedValue(new Date('2026-09-17T00:00:00.000Z')),
      contractEvents: vi.fn().mockResolvedValue([
        {
          args: {
            activationCommitment: `0x${'11'.repeat(32)}`,
            activationKeyVersion: 1n,
            commandId: bytes16(commandId),
            expiresAt: 1_800_000_000n,
            licenseId: bytes16(licenseId),
            planCommitment: `0x${'22'.repeat(32)}`,
            provider: '0x0000000000000000000000000000000000000002',
          },
          blockHash: `0x${'15'.repeat(32)}`,
          blockNumber: 15n,
          eventName: 'LicenseIssued',
          logIndex: 0,
          transactionHash: `0x${'77'.repeat(32)}`,
        },
      ]),
      latestBlock: vi.fn().mockResolvedValue(20),
    };
    const service = new RpcChainIndexerService(checkpoints, indexer, rpc, {
      batchSize: 100,
      chainId: 31_337,
      contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      deploymentBlock: 1,
      network: 'hardhat',
      requiredConfirmations: 2,
    });

    await expect(service.poll('worker-1')).resolves.toBe(1);
    await expect(service.canonicalTime()).resolves.toEqual(new Date('2026-09-17T00:00:00.000Z'));
    expect(rpc.blockTimestamp).toHaveBeenCalledWith(19);

    expect(indexer.markReorged).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000801',
    );
    expect(indexer.ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        chainCommandId: commandId,
        confirmationCount: 6,
        eventType: 'LICENSE_ISSUED',
        licenseId,
      }),
    );
    expect(indexer.ingest.mock.calls[0]?.[0].payload).toMatchObject({
      activationCommitment: `0x${'11'.repeat(32)}`,
      keyVersion: 1,
    });
    expect(checkpoints.completeRange).toHaveBeenCalledWith(
      expect.any(Object),
      'worker-1',
      { fromBlock: 10, toBlock: 20 },
      `0x${'20'.repeat(32)}`,
    );
    expect(checkpoints.release).not.toHaveBeenCalled();
  });

  it('learns the provider log-range limit and scans the claimed range in chunks', async () => {
    const checkpoints = {
      claimRange: vi
        .fn()
        .mockResolvedValueOnce({ fromBlock: 100, toBlock: 124 })
        .mockResolvedValueOnce({ fromBlock: 125, toBlock: 149 }),
      commandContext: vi.fn(),
      completeRange: vi.fn().mockResolvedValue(undefined),
      eventIdentities: vi.fn().mockResolvedValue([]),
      release: vi.fn().mockResolvedValue(undefined),
    };
    const rpc = {
      blockHash: vi.fn().mockResolvedValue(`0x${'20'.repeat(32)}`),
      blockTimestamp: vi.fn(),
      contractEvents: vi
        .fn()
        .mockRejectedValueOnce(
          new Error('Free tier supports up to a 10 block range'),
        )
        .mockResolvedValue([]),
      latestBlock: vi.fn().mockResolvedValue(200),
    };
    const service = new RpcChainIndexerService(
      checkpoints,
      { ingest: vi.fn(), markReorged: vi.fn() },
      rpc,
      {
        batchSize: 25,
        chainId: 31_337,
        contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        deploymentBlock: 1,
        network: 'hardhat',
        requiredConfirmations: 2,
      },
    );

    await expect(service.poll('worker-1')).resolves.toBe(0);
    await expect(service.poll('worker-1')).resolves.toBe(0);

    expect(rpc.contractEvents.mock.calls).toEqual([
      [100, 124],
      [100, 109],
      [110, 119],
      [120, 124],
      [125, 134],
      [135, 144],
      [145, 149],
    ]);
    expect(checkpoints.completeRange).toHaveBeenCalledTimes(2);
    expect(checkpoints.release).not.toHaveBeenCalled();
  });

  it('does not rescan the chain head repeatedly within the same worker process', async () => {
    const checkpoints = {
      claimRange: vi.fn().mockResolvedValue({ fromBlock: 197, toBlock: 200 }),
      commandContext: vi.fn(),
      completeRange: vi.fn().mockResolvedValue(undefined),
      eventIdentities: vi.fn().mockResolvedValue([]),
      release: vi.fn().mockResolvedValue(undefined),
    };
    const rpc = {
      blockHash: vi.fn().mockResolvedValue(`0x${'20'.repeat(32)}`),
      blockTimestamp: vi.fn(),
      contractEvents: vi.fn().mockResolvedValue([]),
      latestBlock: vi.fn().mockResolvedValue(200),
    };
    const service = new RpcChainIndexerService(
      checkpoints,
      { ingest: vi.fn(), markReorged: vi.fn() },
      rpc,
      {
        batchSize: 25,
        chainId: 31_337,
        contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        deploymentBlock: 1,
        network: 'hardhat',
        requiredConfirmations: 2,
      },
    );

    await expect(service.poll('worker-1')).resolves.toBe(0);
    await expect(service.poll('worker-1')).resolves.toBeNull();

    expect(checkpoints.claimRange).toHaveBeenCalledTimes(1);
    expect(rpc.contractEvents).toHaveBeenCalledTimes(1);
  });

  it('does not advance the durable cursor when RPC processing fails', async () => {
    const checkpoints = {
      claimRange: vi.fn().mockResolvedValue({ fromBlock: 10, toBlock: 20 }),
      commandContext: vi.fn(),
      completeRange: vi.fn(),
      eventIdentities: vi.fn().mockResolvedValue([]),
      release: vi.fn().mockResolvedValue(undefined),
    };
    const rpc = {
      blockHash: vi.fn(),
      blockTimestamp: vi.fn(),
      contractEvents: vi.fn().mockRejectedValue(new Error('RPC unavailable')),
      latestBlock: vi.fn().mockResolvedValue(20),
    };
    const service = new RpcChainIndexerService(
      checkpoints,
      { ingest: vi.fn(), markReorged: vi.fn() },
      rpc,
      {
        batchSize: 100,
        chainId: 31_337,
        contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        deploymentBlock: 1,
        network: 'hardhat',
        requiredConfirmations: 2,
      },
    );

    await expect(service.poll('worker-1')).rejects.toThrow('RPC unavailable');
    expect(checkpoints.completeRange).not.toHaveBeenCalled();
    expect(checkpoints.release).toHaveBeenCalled();
  });
});
