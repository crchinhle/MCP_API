import { Pool } from 'pg';
import type { ReadinessProbe } from './platform-readiness.service.js';
export declare class PostgresReadinessProbe implements ReadinessProbe {
    private readonly pool;
    readonly name = "postgres";
    constructor(pool: Pool);
    check(): Promise<void>;
}
