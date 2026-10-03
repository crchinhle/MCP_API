import { Redis } from 'ioredis';
import type { ReadinessProbe } from './platform-readiness.service.js';
export declare class RedisReadinessProbe implements ReadinessProbe {
    private readonly client;
    readonly name = "redis";
    constructor(client: Redis);
    check(): Promise<void>;
}
