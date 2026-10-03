import { CatalogRepository } from '../infrastructure/catalog.repository.js';
export declare class CatalogService {
    private readonly repository;
    constructor(repository: CatalogRepository);
    private map;
    list(): Promise<{
        slug: string;
        name: string;
        summary: string;
        imageUrl: string | null;
        publishedAt: unknown;
        plans: {
            id: string;
            code: string;
            name: string;
            billingCycle: unknown;
            durationMonths: number;
            priceVnd: number;
            maxActiveDevices: number;
            entitlements: unknown;
        }[];
    }[]>;
    find(slug: string): Promise<{
        slug: string;
        name: string;
        summary: string;
        imageUrl: string | null;
        publishedAt: unknown;
        plans: {
            id: string;
            code: string;
            name: string;
            billingCycle: unknown;
            durationMonths: number;
            priceVnd: number;
            maxActiveDevices: number;
            entitlements: unknown;
        }[];
    }>;
}
