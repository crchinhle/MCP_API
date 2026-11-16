import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AI_GATEWAY,
  type AiGatewayPort,
} from './application/ports/ai-gateway.port.js';
import { FakeAiGateway } from './infrastructure/fake-ai.gateway.js';
import { GeminiAiGateway } from './infrastructure/gemini-ai.gateway.js';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { AiAdvisorService } from './application/ai-advisor.service.js';
import { PublicAssistantService } from './application/public-assistant.service.js';
import { PublicAssistantController } from './presentation/public-assistant.controller.js';
import { AiRetrievalDatabase } from './infrastructure/ai-retrieval.database.js';
import { CatalogAiRepository } from './infrastructure/catalog-ai.repository.js';
import { KnowledgeAiRepository } from './infrastructure/knowledge-ai.repository.js';
import { GeminiEmbeddingGateway } from './infrastructure/gemini-embedding.gateway.js';
import { AssistanceSupportController } from './assistance-support.controller.js';
import { AssistanceSupportService } from './assistance-support.service.js';
import { AssistanceSupportRepository } from './infrastructure/assistance-support.repository.js';
import { NotificationWriter } from '../operations/application/notification-writer.js';
import { OperationsModule } from '../operations/operations.module.js';
import { IdentityModule } from '../identity-access/identity.module.js';
import { AiAssistanceService } from './ai-assistance.service.js';
import { KnowledgeController, PublicKnowledgeController } from './knowledge.controller.js';
import { KnowledgeRepository } from './infrastructure/knowledge.repository.js';
import { KnowledgeService } from './knowledge.service.js';
import { PRIVATE_STORAGE, type PrivateStoragePort } from '../../platform/storage/private-storage.port.js';

@Module({
  imports: [IdentityModule, OperationsModule],
  controllers: [AssistanceSupportController, KnowledgeController, PublicKnowledgeController, PublicAssistantController],
  providers: [
    AiRetrievalDatabase,
    { provide: CatalogAiRepository, inject: [AiRetrievalDatabase, ConfigService], useFactory: (pool: AiRetrievalDatabase, config: ConfigService) => new CatalogAiRepository(pool,
      config.get<string>('AI_ADAPTER') === 'gemini' ? new GeminiEmbeddingGateway({ apiKey: config.getOrThrow<string>('GEMINI_API_KEY'), model: config.get<string>('GEMINI_EMBEDDING_MODEL') ?? 'gemini-embedding-001', dimensions: config.get<number>('GEMINI_EMBEDDING_DIMENSIONS') ?? 768, timeoutMs: Math.min(config.get<number>('GEMINI_TIMEOUT_MS') ?? 15000, 10_000) }) : undefined) },
    { provide: KnowledgeAiRepository, inject: [AiRetrievalDatabase], useFactory: (pool: AiRetrievalDatabase) => new KnowledgeAiRepository(pool) },
    { provide: AiAdvisorService, inject: [AI_GATEWAY, CatalogAiRepository, KnowledgeAiRepository], useFactory: (gateway: AiGatewayPort, catalog: CatalogAiRepository, knowledge: KnowledgeAiRepository) => new AiAdvisorService(gateway, catalog, knowledge) },
    { provide: PublicAssistantService, inject: [Redis, AiAdvisorService], useFactory: (redis: Redis, advisor: AiAdvisorService) => new PublicAssistantService(redis, advisor) },
    { provide: AssistanceSupportRepository, inject: [Pool, NotificationWriter], useFactory: (pool: Pool, notifications: NotificationWriter) => new AssistanceSupportRepository(pool, notifications) },
     { provide: KnowledgeRepository, inject: [Pool, PRIVATE_STORAGE, ConfigService], useFactory: (pool: Pool, storage: PrivateStoragePort, config: ConfigService) => new KnowledgeRepository(pool, storage, {
       maxFileBytes: config.get<number>('KNOWLEDGE_MAX_FILE_BYTES') ?? 10_485_760,
       maxChunks: config.get<number>('KNOWLEDGE_MAX_CHUNKS') ?? 500,
       maxChunkBytes: config.get<number>('KNOWLEDGE_MAX_CHUNK_BYTES') ?? 12_000,
       allowedMimeTypes: config.get<string[]>('KNOWLEDGE_ALLOWED_MIME_TYPES') ?? ['application/pdf', 'text/plain'],
     }) },
    { provide: KnowledgeService, inject: [KnowledgeRepository], useFactory: (repository: KnowledgeRepository) => new KnowledgeService(repository) },
    {
      provide: AiAssistanceService,
      inject: [AI_GATEWAY, KnowledgeRepository, AssistanceSupportRepository, AiAdvisorService],
      useFactory: (gateway: AiGatewayPort, knowledge: KnowledgeRepository, conversations: AssistanceSupportRepository, advisor: AiAdvisorService) => new AiAssistanceService(gateway, {
        appendAiMessage: (input) => conversations.appendAiMessage(input),
        appendCustomerMessage: (input) => conversations.appendCustomerMessage(input),
        searchSources: (input) => knowledge.searchForConversation(input),
        context: (input) => conversations.aiContext(input),
        findAnswer: (conversationId, clientMessageId) => conversations.findAiAnswer(conversationId, clientMessageId),
      }, advisor),
    },
    { provide: AssistanceSupportService, inject: [AssistanceSupportRepository, AiAssistanceService, PublicAssistantService], useFactory: (repository: AssistanceSupportRepository, ai: AiAssistanceService, requests: PublicAssistantService) => new AssistanceSupportService(repository, ai, requests) },
    {
      provide: AI_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AiGatewayPort => {
        const adapter = config.getOrThrow<string>('AI_ADAPTER');
         if (adapter === 'fake' && config.get<string>('NODE_ENV') !== 'production') return new FakeAiGateway();
         if (adapter === 'gemini') return new GeminiAiGateway({
           apiKey: config.getOrThrow<string>('GEMINI_API_KEY'),
           model: config.getOrThrow<string>('GEMINI_MODEL'),
           timeoutMs: Math.min(config.getOrThrow<number>('GEMINI_TIMEOUT_MS'), 20_000),
           maxOutputTokens: config.getOrThrow<number>('GEMINI_MAX_OUTPUT_TOKENS'),
         });
         throw new Error(`AI adapter ${adapter} is not configured`);
      },
    },
  ],
  exports: [AI_GATEWAY, AssistanceSupportService],
})
export class AssistanceSupportModule {}
