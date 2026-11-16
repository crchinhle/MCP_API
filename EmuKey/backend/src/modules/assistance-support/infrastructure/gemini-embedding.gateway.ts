import { GoogleGenAI } from '@google/genai';
import { Logger } from '@nestjs/common';
import {
  validateEmbedding,
  type EmbeddingPort,
} from '../application/ports/embedding.port.js';

export interface GeminiEmbeddingOptions {
  apiKey: string;
  model?: string;
  dimensions?: number;
  timeoutMs?: number;
}

/** https://ai.google.dev/gemini-api/docs/embeddings — text retrieval task types. */
export class GeminiEmbeddingGateway implements EmbeddingPort {
  private readonly logger = new Logger(GeminiEmbeddingGateway.name);
  readonly model: string;
  readonly dimensions: number;
  private readonly client: GoogleGenAI;
  private readonly timeoutMs: number;

  constructor(options: GeminiEmbeddingOptions) {
    this.model = options.model ?? 'gemini-embedding-001';
    this.dimensions = options.dimensions ?? 768;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    if (
      !options.apiKey.trim() ||
      !this.model.trim() ||
      !Number.isInteger(this.dimensions) ||
      this.dimensions < 1 ||
      this.dimensions > 3072 ||
      !Number.isInteger(this.timeoutMs) ||
      this.timeoutMs < 1 ||
      this.timeoutMs > 120_000
    ) {
      throw new Error('EMBEDDING_INVALID_OPTIONS');
    }
    this.client = new GoogleGenAI({ apiKey: options.apiKey });
  }

  async embed(input: Parameters<EmbeddingPort['embed']>[0]): Promise<number[]> {
    const started = Date.now();
    if (!input.text.trim() || input.text.length > 32_000)
      throw new Error('EMBEDDING_INVALID_INPUT');
    const response = await this.client.models.embedContent({
      model: this.model,
      contents: input.text,
      config: {
        taskType: input.taskType,
        outputDimensionality: this.dimensions,
        abortSignal: AbortSignal.timeout(this.timeoutMs),
        httpOptions: { timeout: this.timeoutMs },
      },
    });
    if (response.embeddings?.length !== 1)
      throw new Error('EMBEDDING_INVALID_RESPONSE');
    this.logger.log({
      event: 'ai.embedding.completed',
      model: this.model,
      dimensions: this.dimensions,
      taskType: input.taskType,
      inputCharacters: input.text.length,
      latencyMs: Date.now() - started,
    });
    return validateEmbedding(
      response.embeddings[0]?.values ?? [],
      this.dimensions,
    );
  }
}
