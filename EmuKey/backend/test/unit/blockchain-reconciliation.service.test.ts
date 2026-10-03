import { ForbiddenException } from '@nestjs/common';

import { BlockchainReconciliationService } from '../../src/modules/blockchain/application/blockchain-reconciliation.service.js';
import type {
  AuditEvent,
  TransactionClient,
} from '../../src/platform/audit/audit-writer.js';

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
  const audit = {
    write: vi
      .fn<(client: TransactionClient, event: AuditEvent) => Promise<void>>()
      .mockResolvedValue(undefined),
  };
  return {
    audit,
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
      audit,
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
    expect(setup.audit.write).toHaveBeenCalledWith(
      setup.client,
      expect.objectContaining({
        action: 'BLOCKCHAIN_RECONCILIATION_COMPLETED',
      }),
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

  it('does not create one audit row per idle worker tick', async () => {
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

    expect(setup.audit.write).not.toHaveBeenCalled();
    expect(setup.pool.connect).not.toHaveBeenCalled();
  });

  it('records automatic reconciliation as a system source without a user role', async () => {
    const setup = fixture();

    await setup.service.runAutomatic('worker-automatic');

    expect(setup.audit.write).toHaveBeenCalledTimes(1);
    const auditEvent = setup.audit.write.mock.calls[0]?.[1];
    expect(auditEvent).toMatchObject({
      action: 'BLOCKCHAIN_RECONCILIATION_COMPLETED',
      metadata: {
        source: 'SYSTEM_WORKER',
        workerId: 'worker-automatic',
      },
    });
    expect(auditEvent).not.toHaveProperty('actorRole');
    expect(auditEvent).not.toHaveProperty('actorUserId');
  });
});
