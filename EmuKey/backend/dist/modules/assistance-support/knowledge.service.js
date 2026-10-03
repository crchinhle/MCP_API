import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
export class KnowledgeService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    create(actor, input) {
        this.requireProvider(actor);
        return this.repository.create(actor, input);
    }
    list(actor) { this.requireProvider(actor); return this.repository.list(actor); }
    async publish(actor, id, expectedCurrentVersion) {
        this.requireProvider(actor);
        try {
            return await this.repository.publish(actor, id, expectedCurrentVersion);
        }
        catch (error) {
            if (error instanceof Error && error.message === 'KNOWLEDGE_VERSION_CONFLICT') {
                throw new ConflictException({ code: error.message, message: 'Phiên bản đã thay đổi. Vui lòng tải lại danh sách trước khi công bố.' });
            }
            if (error instanceof Error && error.message === 'KNOWLEDGE_DOCUMENT_NOT_FOUND') {
                throw new NotFoundException({ code: error.message, message: 'Không tìm thấy tài liệu sẵn sàng công bố.' });
            }
            throw error;
        }
    }
    async detail(actor, id) {
        this.requireProvider(actor);
        try {
            return await this.repository.detail(actor, id);
        }
        catch (error) {
            if (error instanceof Error && error.message === 'KNOWLEDGE_DOCUMENT_NOT_FOUND') {
                throw new NotFoundException({ code: error.message, message: 'Không tìm thấy tài liệu.' });
            }
            throw error;
        }
    }
    search(actor, question) {
        if (!['CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN'].includes(actor.role))
            throw new ForbiddenException();
        return this.repository.search(actor, question);
    }
    requireProvider(actor) { if (actor.role !== 'PROVIDER_ADMIN' && actor.role !== 'SYSTEM_ADMIN')
        throw new ForbiddenException(); }
}
//# sourceMappingURL=knowledge.service.js.map