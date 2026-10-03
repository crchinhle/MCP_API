import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthPrincipal } from '../identity-access/identity.types.js';

export class KnowledgeService {
  constructor(private readonly repository: {
     create(actor: AuthPrincipal, input: { chunks?: string[]; file?: { originalname: string; mimetype: string; size: number; buffer: Buffer }; logicalDocumentKey: string; productId: string; sourceType: string; title: string; version?: number }): Promise<unknown>;
    list(actor: AuthPrincipal): Promise<unknown[]>;
     publish(actor: AuthPrincipal, id: string, expectedCurrentVersion?: number): Promise<unknown>;
     detail(actor: AuthPrincipal, id: string): Promise<unknown>;
    search(actor: AuthPrincipal, question: string): Promise<Array<{ content: string; id: string }>>;
  }) {}

  create(actor: AuthPrincipal, input: Parameters<KnowledgeService['repository']['create']>[1]) {
    this.requireProvider(actor);
    return this.repository.create(actor, input);
  }
  list(actor: AuthPrincipal) { this.requireProvider(actor); return this.repository.list(actor); }
  async publish(actor: AuthPrincipal, id: string, expectedCurrentVersion?: number) {
    this.requireProvider(actor);
    try {
      return await this.repository.publish(actor, id, expectedCurrentVersion);
    } catch (error) {
      if (error instanceof Error && error.message === 'KNOWLEDGE_VERSION_CONFLICT') {
        throw new ConflictException({ code: error.message, message: 'Phiên bản đã thay đổi. Vui lòng tải lại danh sách trước khi công bố.' });
      }
      if (error instanceof Error && error.message === 'KNOWLEDGE_DOCUMENT_NOT_FOUND') {
        throw new NotFoundException({ code: error.message, message: 'Không tìm thấy tài liệu sẵn sàng công bố.' });
      }
      throw error;
    }
  }
  async detail(actor: AuthPrincipal, id: string) {
    this.requireProvider(actor);
    try {
      return await this.repository.detail(actor, id);
    } catch (error) {
      if (error instanceof Error && error.message === 'KNOWLEDGE_DOCUMENT_NOT_FOUND') {
        throw new NotFoundException({ code: error.message, message: 'Không tìm thấy tài liệu.' });
      }
      throw error;
    }
  }
  search(actor: AuthPrincipal, question: string) {
    if (!['CUSTOMER', 'PROVIDER_ADMIN', 'SYSTEM_ADMIN'].includes(actor.role)) throw new ForbiddenException();
    return this.repository.search(actor, question);
  }
  private requireProvider(actor: AuthPrincipal) { if (actor.role !== 'PROVIDER_ADMIN' && actor.role !== 'SYSTEM_ADMIN') throw new ForbiddenException(); }
}
