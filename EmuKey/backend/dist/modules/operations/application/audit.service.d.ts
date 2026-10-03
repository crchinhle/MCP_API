import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { AuditRepository } from '../infrastructure/audit.repository.js';
export declare class AuditService {
    private readonly repository;
    constructor(repository: AuditRepository);
    list(actor: AuthPrincipal, input: Parameters<AuditRepository['list']>[0]): Promise<{
        items: any[];
        hasMore: boolean;
        page: number;
    }>;
}
