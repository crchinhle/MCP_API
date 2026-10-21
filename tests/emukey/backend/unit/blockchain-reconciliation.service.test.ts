import { ForbiddenException } from '@nestjs/common';

import { BlockchainReconciliationService } from '../../../../EmuKey/backend/src/modules/blockchain/application/blockchain-reconciliation.service.js';

function fixture() {
  const client = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
    query: vi.fn().mockResolvedValue({
      rows: [
        {
          active_without_finality: 0,
          pending_events: 0,
          reorged_events: 1,
          unknown_commands: 0,
        },
      ],
    }),
  };
  const commands = {
    reconcileReceipt: vi.fn().mockResolvedValue(null),
    reconcileUnknown: vi
      .fn()
      .mockResolvedValueOnce('00000000-0000-4000-8000-000000000901')
      .mockResolvedValue(null),
  };
  const indexer = {
    canonicalTime: vi.fn().mockResolvedValue(new Date('2026-09-17T00:00:00.000Z')),
    poll: vi.fn().mockResolvedValueOnce(2).mockResolvedValue(null),
  };
  const projections = {
    deriveExpiredFromCanonicalChain: vi.fn().mockResolvedValue([]),
    reconcileCanonicalProjections: vi.fn().mockResolvedValue({
      commandRepairs: 1,
      licenseIds: ['00000000-0000-4000-8000-000000000401'],
      licenseRepairs: 1,
      remainingMismatches: 0,
    }),
  };
  return {

    client,
    commands,
    indexer,
    pool,
    projections,
    service: new BlockchainReconciliationService(
      pool as never,
      commands as never,
      indexer,
      projections,

    ),
  };
}

describe('BlockchainReconciliationService', () => {
  it('indexes real RPC ranges, reconciles durable commands and repairs canonical projections', async () => {
    const setup = fixture();

    await expect(
      setup.service.run({
        role: 'SYSTEM_ADMIN',
        sessionVersion: 1,
        sub: '00000000-0000-4000-8000-000000000001',
      }),
    ).resolves.toMatchObject({
      indexedEvents: 2,
      processed: true,
      projection: {
        commandRepairs: 1,
        licenseRepairs: 1,
        remainingMismatches: 0,
      },
      reconciledCommandIds: [
        '00000000-0000-4000-8000-000000000901',
      ],
    });

    expect(setup.indexer.poll).toHaveBeenCalledTimes(2);
    expect(setup.projections.reconcileCanonicalProjections).toHaveBeenCalled();
    expect(setup.projections.deriveExpiredFromCanonicalChain).toHaveBeenCalledWith(
      new Date('2026-09-17T00:00:00.000Z'),
    );
  });

  it('rejects non-operations roles before touching chain state', async () => {
    const setup = fixture();

    await expect(
      setup.service.run({
        role: 'CUSTOMER',
        sessionVersion: 1,
        sub: '00000000-0000-4000-8000-000000000004',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(setup.commands.reconcileUnknown).not.toHaveBeenCalled();
    expect(setup.indexer.poll).not.toHaveBeenCalled();
  });

  it('returns idle without opening an extra transaction', async () => {
    const setup = fixture();
    setup.commands.reconcileUnknown.mockReset().mockResolvedValue(null);
    setup.indexer.poll.mockReset().mockResolvedValue(null);
    setup.projections.reconcileCanonicalProjections.mockResolvedValue({
      commandRepairs: 0,
      licenseIds: [],
      licenseRepairs: 0,
      remainingMismatches: 0,
    });

    await expect(setup.service.runAutomatic('worker-idle')).resolves.toMatchObject({
      processed: false,
    });

    expect(setup.pool.connect).not.toHaveBeenCalled();
  });

  it('returns the outcome of automatic reconciliation without opening a separate transaction', async () => {
    const setup = fixture();
    await expect(setup.service.runAutomatic('worker-automatic')).resolves.toMatchObject({
      processed: true, indexedEvents: 2, projection: { licenseRepairs: 1, commandRepairs: 1 },
    });
    expect(setup.pool.connect).not.toHaveBeenCalled();
  });
});
