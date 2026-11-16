import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { CatalogAiRepository } from './infrastructure/catalog-ai.repository.js';
import { GeminiEmbeddingGateway } from './infrastructure/gemini-embedding.gateway.js';
import { AiCatalogIndexer } from './worker/ai-catalog-indexer.js';

@Module({
  providers: [
    {
      provide: AiCatalogIndexer,
      inject: [Pool, Redis, ConfigService],
      useFactory: (writer: Pool, redis: Redis, config: ConfigService) => {
        const embedding =
          config.get<string>('AI_ADAPTER') === 'gemini'
            ? new GeminiEmbeddingGateway({
                apiKey: config.getOrThrow<string>('GEMINI_API_KEY'),
                model:
                  config.get<string>('GEMINI_EMBEDDING_MODEL') ??
                  'gemini-embedding-001',
                dimensions:
                  config.get<number>('GEMINI_EMBEDDING_DIMENSIONS') ?? 768,
                timeoutMs: config.get<number>('GEMINI_TIMEOUT_MS') ?? 15000,
              })
            : undefined;
        // No timer/provider request in fake development mode.
        return embedding
          ? new AiCatalogIndexer(
              new CatalogAiRepository(writer, embedding),
              redis,
            )
          : {};
      },
    },
  ],
})
export class AssistanceWorkerModule {}
