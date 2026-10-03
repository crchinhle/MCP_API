import { CatalogRepository } from '../infrastructure/catalog.repository.js';
export declare class ComparePlansQuery {
    private readonly repository;
    constructor(repository: CatalogRepository);
    execute(rawIds: string | string[]): Promise<{
        dimensions: {
            key: string;
            label: string;
            values: {
                [k: string]: unknown;
            };
        }[];
        plans: {
            billingCycle: unknown;
            id: string;
            name: string;
            productId: string;
            productName: string;
            version: number;
        }[];
    }>;
}
