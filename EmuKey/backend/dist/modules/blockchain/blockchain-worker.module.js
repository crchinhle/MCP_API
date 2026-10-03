var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BlockchainModule } from './blockchain.module.js';
import { ChainCommandProcessor, CHAIN_COMMAND_QUEUE, } from './worker/chain-command.processor.js';
import { ChainCommandScheduler } from './worker/chain-command.scheduler.js';
let BlockchainWorkerModule = class BlockchainWorkerModule {
};
BlockchainWorkerModule = __decorate([
    Module({
        imports: [
            BlockchainModule,
            BullModule.registerQueue({ name: CHAIN_COMMAND_QUEUE }),
        ],
        providers: [ChainCommandProcessor, ChainCommandScheduler],
    })
], BlockchainWorkerModule);
export { BlockchainWorkerModule };
//# sourceMappingURL=blockchain-worker.module.js.map