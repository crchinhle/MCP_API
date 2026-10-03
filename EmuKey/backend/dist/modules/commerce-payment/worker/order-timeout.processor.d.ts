import { WorkerHost } from '@nestjs/bullmq';
import { type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { CommerceService } from '../application/commerce.service.js';
export declare const ORDER_TIMEOUT_QUEUE = "order-timeout";
export declare class OrderTimeoutProcessor extends WorkerHost implements OnModuleInit {
    private readonly queue;
    private readonly commerce;
    private readonly logger;
    constructor(queue: Queue, commerce: CommerceService);
    onModuleInit(): Promise<void>;
    process(): Promise<void>;
}
