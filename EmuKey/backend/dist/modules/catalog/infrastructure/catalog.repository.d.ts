import { Pool } from 'pg';
export declare class CatalogRepository {
    private readonly pool;
    constructor(pool: Pool);
    listPublished(): Promise<Record<string, unknown>[]>;
    findPublished(slug: string): Promise<Record<string, unknown>[]>;
    findPublishedPlans(ids: string[]): Promise<Record<string, unknown>[]>;
}
