var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_GATEWAY, } from './application/ports/ai-gateway.port.js';
import { FakeAiGateway } from './infrastructure/fake-ai.gateway.js';
import { GeminiAiGateway } from './infrastructure/gemini-ai.gateway.js';
import { Pool } from 'pg';
import { AssistanceSupportController } from './assistance-support.controller.js';
import { AssistanceSupportService } from './assistance-support.service.js';
import { AssistanceSupportRepository } from './infrastructure/assistance-support.repository.js';
import { IdentityModule } from '../identity-access/identity.module.js';
import { AiAssistanceService } from './ai-assistance.service.js';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeRepository } from './infrastructure/knowledge.repository.js';
import { KnowledgeService } from './knowledge.service.js';
import { PRIVATE_STORAGE } from '../../platform/storage/private-storage.port.js';
let AssistanceSupportModule = class AssistanceSupportModule {
};
AssistanceSupportModule = __decorate([
    Module({
        imports: [IdentityModule],
        controllers: [AssistanceSupportController, KnowledgeController],
        providers: [
            { provide: AssistanceSupportRepository, inject: [Pool], useFactory: (pool) => new AssistanceSupportRepository(pool) },
            { provide: KnowledgeRepository, inject: [Pool, PRIVATE_STORAGE, ConfigService], useFactory: (pool, storage, config) => new KnowledgeRepository(pool, storage, {
                    maxFileBytes: config.get('KNOWLEDGE_MAX_FILE_BYTES') ?? 10_485_760,
                    maxChunks: config.get('KNOWLEDGE_MAX_CHUNKS') ?? 500,
                    maxChunkBytes: config.get('KNOWLEDGE_MAX_CHUNK_BYTES') ?? 12_000,
                    allowedMimeTypes: config.get('KNOWLEDGE_ALLOWED_MIME_TYPES') ?? ['application/pdf', 'text/plain'],
                }) },
            { provide: KnowledgeService, inject: [KnowledgeRepository], useFactory: (repository) => new KnowledgeService(repository) },
            {
                provide: AiAssistanceService,
                inject: [AI_GATEWAY, KnowledgeRepository, AssistanceSupportRepository],
                useFactory: (gateway, knowledge, conversations) => new AiAssistanceService(gateway, {
                    appendAiMessage: (input) => conversations.appendAiMessage(input),
                    appendCustomerMessage: (input) => conversations.appendCustomerMessage(input),
                    searchSources: (input) => knowledge.searchForConversation(input),
                }),
            },
            { provide: AssistanceSupportService, inject: [AssistanceSupportRepository, AiAssistanceService], useFactory: (repository, ai) => new AssistanceSupportService(repository, ai) },
            {
                provide: AI_GATEWAY,
                inject: [ConfigService],
                useFactory: (config) => {
                    const adapter = config.getOrThrow('AI_ADAPTER');
                    if (adapter === 'fake')
                        return new FakeAiGateway();
                    if (adapter === 'gemini')
                        return new GeminiAiGateway({
                            apiKey: config.getOrThrow('GEMINI_API_KEY'),
                            model: config.getOrThrow('GEMINI_MODEL'),
                            timeoutMs: config.getOrThrow('GEMINI_TIMEOUT_MS'),
                            maxOutputTokens: config.getOrThrow('GEMINI_MAX_OUTPUT_TOKENS'),
                        });
                    throw new Error(`AI adapter ${adapter} is not configured`);
                },
            },
        ],
        exports: [AI_GATEWAY],
    })
], AssistanceSupportModule);
export { AssistanceSupportModule };
//# sourceMappingURL=assistance-support.module.js.map