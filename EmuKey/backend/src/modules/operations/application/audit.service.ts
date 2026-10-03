import { ForbiddenException } from '@nestjs/common';
import type { AuthPrincipal } from '../../identity-access/identity.types.js';
import type { AuditRepository } from '../infrastructure/audit.repository.js';

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}
  list(actor: AuthPrincipal, input: Parameters<AuditRepository['list']>[0]) {
    if (actor.role !== 'SYSTEM_ADMIN') throw new ForbiddenException();
    return this.repository.list(input);
  }
}
