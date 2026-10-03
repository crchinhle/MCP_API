import { OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
export declare class ChainCommandScheduler implements OnModuleInit {
    private readonly queue;
    constructor(queue: Queue);
    onModuleInit(): Promise<void>;
}
