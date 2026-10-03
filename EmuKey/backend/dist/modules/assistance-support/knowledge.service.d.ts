import type { AuthPrincipal } from '../identity-access/identity.types.js';
export declare class KnowledgeService {
    private readonly repository;
    constructor(repository: {
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
        }): Promise<unknown>;
        list(actor: AuthPrincipal): Promise<unknown[]>;
        publish(actor: AuthPrincipal, id: string, expectedCurrentVersion?: number): Promise<unknown>;
        detail(actor: AuthPrincipal, id: string): Promise<unknown>;
        search(actor: AuthPrincipal, question: string): Promise<Array<{
            content: string;
            id: string;
        }>>;
    });
    create(actor: AuthPrincipal, input: Parameters<KnowledgeService['repository']['create']>[1]): Promise<unknown>;
    list(actor: AuthPrincipal): Promise<unknown[]>;
    publish(actor: AuthPrincipal, id: string, expectedCurrentVersion?: number): Promise<unknown>;
    detail(actor: AuthPrincipal, id: string): Promise<unknown>;
    search(actor: AuthPrincipal, question: string): Promise<{
        content: string;
        id: string;
    }[]>;
    private requireProvider;
}
