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
var OrderTimeoutProcessor_1;
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommerceService } from '../application/commerce.service.js';
export const ORDER_TIMEOUT_QUEUE = 'order-timeout';
let OrderTimeoutProcessor = OrderTimeoutProcessor_1 = class OrderTimeoutProcessor extends WorkerHost {
    queue;
    commerce;
    logger = new Logger(OrderTimeoutProcessor_1.name);
    constructor(queue, commerce) {
        super();
        this.queue = queue;
        this.commerce = commerce;
    }
    async onModuleInit() {
        // https://docs.bullmq.io/guide/job-schedulers
        await this.queue.upsertJobScheduler('overdue-orders', { every: 15_000 }, {
            name: 'cancel-overdue-orders', data: {},
            opts: { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 100, removeOnFail: 100 },
        });
    }
    async process() {
        const count = await this.commerce.cancelOverdueOrders();
        if (count)
            this.logger.log({ event: 'orders.auto_cancelled', count });
    }
};
OrderTimeoutProcessor = OrderTimeoutProcessor_1 = __decorate([
    Processor(ORDER_TIMEOUT_QUEUE, { concurrency: 1 }),
    __param(0, InjectQueue(ORDER_TIMEOUT_QUEUE)),
    __metadata("design:paramtypes", [Function, CommerceService])
], OrderTimeoutProcessor);
export { OrderTimeoutProcessor };
//# sourceMappingURL=order-timeout.processor.js.map