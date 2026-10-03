import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
const MAX_RECONCILIATION_STEPS = 25;
export class BlockchainReconciliationService {
    pool;
    commands;
    indexer;
    projections;
    audit;
    constructor(pool, commands, indexer, projections, audit) {
        this.pool = pool;
        this.commands = commands;
        this.indexer = indexer;
        this.projections = projections;
        this.audit = audit;
    }
    async run(actor) {
        if (actor.role !== 'SYSTEM_ADMIN' && actor.role !== 'SUPPORT_STAFF') {
            throw new ForbiddenException();
        }
        return this.reconcile(`operations:${actor.sub}`, actor);
    }
    runAutomatic(workerId) {
        return this.reconcile(workerId);
    }
    async recoverDeadLetter(actor, commandId, request) {
        if (actor.role !== 'SYSTEM_ADMIN' && actor.role !== 'SUPPORT_STAFF') {
            throw new ForbiddenException();
        }
        try {
            return await this.commands.recoverDeadLetter(commandId, request.mode, request.reason, request.evidence, { role: actor.role, userId: actor.sub });
        }
        catch (error) {
            const code = error instanceof Error ? error.message : 'CHAIN_COMMAND_RECOVERY_FAILED';
            if (code === 'CHAIN_COMMAND_NOT_FOUND')
                throw new NotFoundException({ code, message: 'Chain command was not found.' });
            throw new ConflictException({ code, message: 'The dead-letter command cannot be recovered in its current state.' });
        }
    }
    async reconcile(workerId, actor) {
        const reconciledCommandIds = [];
        let indexedEvents = 0;
        for (let index = 0; index < MAX_RECONCILIATION_STEPS; index += 1) {
            const commandId = await this.commands.reconcileUnknown(workerId);
            if (!commandId)
                break;
            reconciledCommandIds.push(commandId);
        }
        for (let index = 0; index < MAX_RECONCILIATION_STEPS; index += 1) {
            const commandId = await this.commands.reconcileReceipt(workerId);
            if (!commandId)
                break;
            reconciledCommandIds.push(commandId);
        }
        for (let index = 0; index < MAX_RECONCILIATION_STEPS; index += 1) {
            const count = await this.indexer.poll(workerId);
            if (count === null)
                break;
            indexedEvents += count;
        }
        const projection = await this.projections.reconcileCanonicalProjections();
        const canonicalTime = await this.indexer.canonicalTime();
        const expiredLicenseIds = await this.projections.deriveExpiredFromCanonicalChain(canonicalTime);
        const health = await this.pool.query(`SELECT
        (SELECT count(*)::int FROM chain_commands WHERE status='SUBMITTED_UNKNOWN') AS unknown_commands,
        (SELECT count(*)::int FROM chain_events WHERE finality_status='PENDING'
          AND observed_at < now() - interval '5 minutes') AS pending_events,
        (SELECT count(*)::int FROM chain_events WHERE finality_status='REORGED') AS reorged_events,
        (SELECT count(*)::int FROM licenses l LEFT JOIN chain_events e
          ON e.id=l.last_applied_chain_event_id AND e.finality_status='CONFIRMED'
      WHERE l.status IN ('ACTIVE','SUSPENDED','REVOKED') AND e.id IS NULL) AS active_without_finality`);
        const processed = reconciledCommandIds.length > 0 ||
            indexedEvents > 0 ||
            projection.commandRepairs > 0 ||
            projection.licenseRepairs > 0 ||
            expiredLicenseIds.length > 0;
        if (actor || processed) {
            const client = await this.pool.connect();
            try {
                await client.query('BEGIN');
                await this.audit.write(client, {
                    action: 'BLOCKCHAIN_RECONCILIATION_COMPLETED',
                    ...(actor
                        ? { actorRole: actor.role, actorUserId: actor.sub }
                        : {}),
                    metadata: {
                        ...(!actor ? { source: 'SYSTEM_WORKER', workerId } : {}),
                        indexedEvents,
                        canonicalTime: canonicalTime.toISOString(),
                        expiredLicenseIds,
                        projection,
                        reconciledCommandIds,
                        ...health.rows[0],
                    },
                    targetType: 'BLOCKCHAIN_PROJECTION',
                });
                await client.query('COMMIT');
            }
            catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
        }
        return {
            health: health.rows[0],
            indexedEvents,
            canonicalTime: canonicalTime.toISOString(),
            expiredLicenseIds,
            processed,
            projection,
            reconciledCommandIds,
        };
    }
}
//# sourceMappingURL=blockchain-reconciliation.service.js.map