import { CatalogService } from '../application/catalog.service.js';
import { CatalogAdminService } from '../application/catalog-admin.service.js';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { CreateProductDto, UpdateProductDto } from './catalog.dto.js';
export declare class CatalogController {
    private readonly service;
    private readonly adminService;
    constructor(service: CatalogService, adminService: CatalogAdminService);
    listAdmin(actor: AuthPrincipal): Promise<{
        code: string;
        createdAt: Date;
        description: string | null;
        imageUrl: string | null;
        id: string;
        name: string;
        publishedAt: Date | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
    }[]>;
    findAdmin(actor: AuthPrincipal, id: string): Promise<{
        code: string;
        createdAt: Date;
        description: string | null;
        imageUrl: string | null;
        id: string;
        name: string;
        publishedAt: Date | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
    }>;
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
    create(actor: AuthPrincipal, dto: CreateProductDto): Promise<{
        code: string;
        createdAt: Date;
        description: string | null;
        imageUrl: string | null;
        id: string;
        name: string;
        publishedAt: Date | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
    }>;
    update(actor: AuthPrincipal, id: string, dto: UpdateProductDto): Promise<{
        code: string;
        createdAt: Date;
        description: string | null;
        imageUrl: string | null;
        id: string;
        name: string;
        publishedAt: Date | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
    }>;
    delete(actor: AuthPrincipal, id: string): Promise<{
        deleted: boolean;
    }>;
    publish(actor: AuthPrincipal, id: string): Promise<{
        code: string;
        createdAt: Date;
        description: string | null;
        imageUrl: string | null;
        id: string;
        name: string;
        publishedAt: Date | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
    }>;
    archive(actor: AuthPrincipal, id: string): Promise<{
        code: string;
        createdAt: Date;
        description: string | null;
        imageUrl: string | null;
        id: string;
        name: string;
        publishedAt: Date | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        updatedAt: Date;
    }>;
}
