import { type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
export declare class RedisClient extends Redis implements OnApplicationShutdown {
    constructor(config: ConfigService);
    onApplicationShutdown(): void;
}
