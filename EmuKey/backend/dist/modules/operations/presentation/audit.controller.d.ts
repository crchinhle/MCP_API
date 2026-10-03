import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import { AuditService } from '../application/audit.service.js';
import { AuditQueryDto } from './audit.dto.js';
export declare class AuditController {
    private readonly service;
    constructor(service: AuditService);
    list(actor: AuthPrincipal, query: AuditQueryDto): Promise<{
        items: any[];
        hasMore: boolean;
        page: number;
    }>;
}
