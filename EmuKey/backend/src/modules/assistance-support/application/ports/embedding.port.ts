export const EMBEDDING_PORT = Symbol('EMBEDDING_PORT');

/** Metadata identifies an embedding space; query/document tasks must use the same space. */
export interface EmbeddingPort {
  readonly model: string;
  readonly dimensions: number;
  embed(input: {
    text: string;
    taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT';
  }): Promise<number[]>;
}

/** pgvector cosine distance rejects zero vectors; never interpolate unchecked provider data. */
export function validateEmbedding(
  values: number[],
  dimensions: number,
): number[] {
  if (
    !Number.isInteger(dimensions) ||
    dimensions < 1 ||
    dimensions > 3072 ||
    !Array.isArray(values) ||
    values.length !== dimensions ||
    values.some((value) => !Number.isFinite(value))
  )
    throw new Error('EMBEDDING_INVALID_VECTOR');
  const norm = Math.hypot(...values);
  if (!Number.isFinite(norm) || norm === 0)
    throw new Error('EMBEDDING_INVALID_VECTOR');
  return values.map((value) => value / norm);
}
