import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AI_GATEWAY,
  type AiGatewayPort,
} from './application/ports/ai-gateway.port.js';
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
import { PRIVATE_STORAGE, type PrivateStoragePort } from '../../platform/storage/private-storage.port.js';

@Module({
  imports: [IdentityModule],
  controllers: [AssistanceSupportController, KnowledgeController],
  providers: [
    { provide: AssistanceSupportRepository, inject: [Pool], useFactory: (pool: Pool) => new AssistanceSupportRepository(pool) },
     { provide: KnowledgeRepository, inject: [Pool, PRIVATE_STORAGE, ConfigService], useFactory: (pool: Pool, storage: PrivateStoragePort, config: ConfigService) => new KnowledgeRepository(pool, storage, {
       maxFileBytes: config.get<number>('KNOWLEDGE_MAX_FILE_BYTES') ?? 10_485_760,
       maxChunks: config.get<number>('KNOWLEDGE_MAX_CHUNKS') ?? 500,
       maxChunkBytes: config.get<number>('KNOWLEDGE_MAX_CHUNK_BYTES') ?? 12_000,
       allowedMimeTypes: config.get<string[]>('KNOWLEDGE_ALLOWED_MIME_TYPES') ?? ['application/pdf', 'text/plain'],
     }) },
    { provide: KnowledgeService, inject: [KnowledgeRepository], useFactory: (repository: KnowledgeRepository) => new KnowledgeService(repository) },
    {
      provide: AiAssistanceService,
      inject: [AI_GATEWAY, KnowledgeRepository, AssistanceSupportRepository],
      useFactory: (gateway: AiGatewayPort, knowledge: KnowledgeRepository, conversations: AssistanceSupportRepository) => new AiAssistanceService(gateway, {
        appendAiMessage: (input) => conversations.appendAiMessage(input),
        appendCustomerMessage: (input) => conversations.appendCustomerMessage(input),
        searchSources: (input) => knowledge.searchForConversation(input),
      }),
    },
    { provide: AssistanceSupportService, inject: [AssistanceSupportRepository, AiAssistanceService], useFactory: (repository: AssistanceSupportRepository, ai: AiAssistanceService) => new AssistanceSupportService(repository, ai) },
    {
      provide: AI_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AiGatewayPort => {
        const adapter = config.getOrThrow<string>('AI_ADAPTER');
         if (adapter === 'fake') return new FakeAiGateway();
         if (adapter === 'gemini') return new GeminiAiGateway({
           apiKey: config.getOrThrow<string>('GEMINI_API_KEY'),
           model: config.getOrThrow<string>('GEMINI_MODEL'),
           timeoutMs: config.getOrThrow<number>('GEMINI_TIMEOUT_MS'),
           maxOutputTokens: config.getOrThrow<number>('GEMINI_MAX_OUTPUT_TOKENS'),
         });
         throw new Error(`AI adapter ${adapter} is not configured`);
      },
    },
  ],
  exports: [AI_GATEWAY],
})
export class AssistanceSupportModule {}
