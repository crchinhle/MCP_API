import { Pool } from 'pg';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { PrivateStoragePort } from '../../../platform/storage/private-storage.port.js';
export declare class KnowledgeRepository {
    private readonly pool;
    private readonly storage?;
    private readonly limits;
    constructor(pool: Pool, storage?: PrivateStoragePort | undefined, limits?: {
        maxFileBytes: number;
        maxChunks: number;
        maxChunkBytes: number;
        allowedMimeTypes: string[];
    });
    create(actor: AuthPrincipal, input: {
        chunks?: string[];
        file?: {
            originalname: string;
            mimetype: string;
            size: number;
            buffer: Buffer;
        };
        logicalDocumentKey: string;
        productId: string;
        sourceType: string;
        title: string;
        version?: number;
    }): Promise<{
        id: string;
        title: string;
        logicalDocumentKey: string;
        version: number;
        status: string;
        isCurrent: boolean;
    }>;
    list(actor: AuthPrincipal): Promise<Record<string, unknown>[]>;
    detail(actor: AuthPrincipal, id: string): Promise<{
        chunks: string[];
        id: string;
        title: string;
        logicalDocumentKey: string;
        version: number;
        status: string;
        isCurrent: boolean;
    }>;
    publish(actor: AuthPrincipal, id: string, expectedCurrentVersion?: number): Promise<{
        id: string;
        title: string;
        logicalDocumentKey: string;
        version: number;
        status: string;
        isCurrent: boolean;
    }>;
    search(actor: AuthPrincipal, question: string): Promise<Array<{
        id: string;
        content: string;
    }>>;
    searchForConversation(input: {
        conversationId: string;
        customerUserId: string;
        question: string;
    }): Promise<Array<{
        id: string;
        content: string;
    }>>;
}
export declare function chunkText(content: string, maxChunkBytes?: number): string[];
