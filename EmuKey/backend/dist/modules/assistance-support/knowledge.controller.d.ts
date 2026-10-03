import type { AuthPrincipal } from '../identity-access/identity.types.js';
import { CreateKnowledgeDocumentDto, KnowledgeQueryDto, PublishKnowledgeDocumentDto } from './knowledge.dto.js';
import { KnowledgeService } from './knowledge.service.js';
export declare class KnowledgeController {
    private readonly service;
    constructor(service: KnowledgeService);
    list(actor: AuthPrincipal): Promise<unknown[]>;
    create(actor: AuthPrincipal, dto: CreateKnowledgeDocumentDto, file?: {
        originalname: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
    }): Promise<unknown>;
    detail(actor: AuthPrincipal, id: string): Promise<unknown>;
    publish(actor: AuthPrincipal, id: string, dto: PublishKnowledgeDocumentDto): Promise<unknown>;
    query(actor: AuthPrincipal, dto: KnowledgeQueryDto): Promise<{
        content: string;
        id: string;
    }[]>;
}
