var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ChainCommandService } from '../application/chain-command.service.js';
import { BlockchainReconciliationService } from '../application/blockchain-reconciliation.service.js';
export const CHAIN_COMMAND_QUEUE = 'chain-command-trigger';
let ChainCommandProcessor = class ChainCommandProcessor extends WorkerHost {
    commands;
    reconciliation;
    constructor(commands, reconciliation) {
        super();
        this.commands = commands;
        this.reconciliation = reconciliation;
    }
    async process(job) {
        const workerId = `bullmq:${job.id ?? 'scheduled'}`;
        await this.commands.processNext(workerId);
        await this.reconciliation.runAutomatic(workerId);
    }
};
ChainCommandProcessor = __decorate([
    Processor(CHAIN_COMMAND_QUEUE, { concurrency: 1 }),
    __metadata("design:paramtypes", [ChainCommandService,
        BlockchainReconciliationService])
], ChainCommandProcessor);
export { ChainCommandProcessor };
//# sourceMappingURL=chain-command.processor.js.map