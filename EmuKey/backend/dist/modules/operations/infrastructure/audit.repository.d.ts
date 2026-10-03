import { Pool } from 'pg';
export declare class AuditRepository {
    private readonly pool;
    constructor(pool: Pool);
    list(input: {
        page: number;
        action?: string;
        outcome?: string;
    }): Promise<{
        items: any[];
        hasMore: boolean;
        page: number;
    }>;
}
