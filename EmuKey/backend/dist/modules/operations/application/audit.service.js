import { ForbiddenException } from '@nestjs/common';
export class AuditService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    list(actor, input) {
        if (actor.role !== 'SYSTEM_ADMIN')
            throw new ForbiddenException();
        return this.repository.list(input);
    }
}
//# sourceMappingURL=audit.service.js.map