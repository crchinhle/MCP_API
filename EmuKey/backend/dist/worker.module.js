var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommerceModule } from './modules/commerce-payment/commerce.module.js';
import { OperationsModule } from './modules/operations/operations.module.js';
import { ORDER_TIMEOUT_QUEUE, OrderTimeoutProcessor } from './modules/commerce-payment/worker/order-timeout.processor.js';
import { PlatformCoreModule } from './platform/platform-core.module.js';
import { BlockchainModule } from './modules/blockchain/blockchain.module.js';
import { BlockchainWorkerModule } from './modules/blockchain/blockchain-worker.module.js';
const workerImports = process.env.NODE_ENV === 'test'
    ? [BlockchainModule]
    : [BlockchainWorkerModule, CommerceModule, OperationsModule, BullModule.registerQueue({ name: ORDER_TIMEOUT_QUEUE })];
let WorkerModule = class WorkerModule {
};
WorkerModule = __decorate([
    Module({
        imports: [PlatformCoreModule, ...workerImports],
        providers: process.env.NODE_ENV === 'test' ? [] : [OrderTimeoutProcessor],
    })
], WorkerModule);
export { WorkerModule };
//# sourceMappingURL=worker.module.js.map