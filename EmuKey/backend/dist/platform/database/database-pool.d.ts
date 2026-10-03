import { type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
export declare class DatabasePool extends Pool implements OnApplicationShutdown {
    private readonly logger;
    constructor(config: ConfigService);
    onApplicationShutdown(): Promise<void>;
}
