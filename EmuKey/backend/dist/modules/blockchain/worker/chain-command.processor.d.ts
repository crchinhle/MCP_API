import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ChainCommandService } from '../application/chain-command.service.js';
import { BlockchainReconciliationService } from '../application/blockchain-reconciliation.service.js';
export declare const CHAIN_COMMAND_QUEUE = "chain-command-trigger";
export declare class ChainCommandProcessor extends WorkerHost {
    private readonly commands;
    private readonly reconciliation;
    constructor(commands: ChainCommandService, reconciliation: BlockchainReconciliationService);
    process(job: Job): Promise<void>;
}
