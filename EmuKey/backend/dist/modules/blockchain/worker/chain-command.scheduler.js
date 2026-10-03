var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { CHAIN_COMMAND_QUEUE } from './chain-command.processor.js';
let ChainCommandScheduler = class ChainCommandScheduler {
    queue;
    constructor(queue) {
        this.queue = queue;
    }
    async onModuleInit() {
        await this.queue.upsertJobScheduler('durable-chain-command-poller', { every: 1_000 }, {
            name: 'poll-postgres',
            data: {},
            opts: { removeOnComplete: 100, removeOnFail: 100 },
        });
    }
};
ChainCommandScheduler = __decorate([
    Injectable(),
    __param(0, InjectQueue(CHAIN_COMMAND_QUEUE)),
    __metadata("design:paramtypes", [Function])
], ChainCommandScheduler);
export { ChainCommandScheduler };
//# sourceMappingURL=chain-command.scheduler.js.map