import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { CatalogAiRepository } from '../../modules/assistance-support/infrastructure/catalog-ai.repository.js';
import { GeminiEmbeddingGateway } from '../../modules/assistance-support/infrastructure/gemini-embedding.gateway.js';
import { databaseCliLogger } from '../../platform/database/database-cli.js';

/** Never runs the destructive initializer: upgrade SQL derives from schema.sql markers. */
export function extractAiRetrievalUpgrade(schema: string): string {
  const begin = '-- emukey:ai-retrieval:begin';
  const end = '-- emukey:ai-retrieval:end';
  const sections = schema.split(begin);
  const tail = sections[1]?.split(end);
  if (sections.length !== 2 || tail?.length !== 2 || !tail[0]?.trim())
    throw new Error('AI_RETRIEVAL_SCHEMA_MARKERS_INVALID');
  return `BEGIN;\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '5min';\nSET LOCAL search_path = public;\n${tail[0]}\nCOMMIT;`;
}

export async function indexAiCatalog(): Promise<void> {
  const args = process.argv.slice(2);
  if (
    args.some(
      (arg) => !['--upgrade', '--upgrade-only', '--status'].includes(arg),
    )
  )
    throw new Error('AI_CATALOG_UNKNOWN_ARGUMENT');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.trim()) throw new Error('DATABASE_URL_REQUIRED');
  const upgradeOnly = args.includes('--upgrade-only');
  const statusOnly = args.includes('--status');
  // Read only the required variables, without loading unrelated API/worker configuration.
  const embedding =
    upgradeOnly || statusOnly
      ? undefined
      : new GeminiEmbeddingGateway({
          apiKey: process.env.GEMINI_API_KEY ?? '',
          model: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
          dimensions: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? 768),
          timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS ?? 10_000),
        });
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 10_000,
    application_name: 'emukey-ai-catalog-indexer',
  });
  try {
    if (upgradeOnly || args.includes('--upgrade')) {
      const sql = extractAiRetrievalUpgrade(
        await readFile(resolve(process.cwd(), 'database/schema.sql'), 'utf8'),
      );
      // One dedicated client keeps transaction/error cleanup scoped to this trusted operation.
      const client = await pool.connect();
      try {
        await client.query(sql);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    if (statusOnly)
      databaseCliLogger.info(
        await new CatalogAiRepository(pool).status({
          model: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
          dimensions: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? 768),
        }),
        'AI catalog index status',
      );
    else if (!upgradeOnly)
      databaseCliLogger.info(
        await new CatalogAiRepository(pool, embedding).reindex(),
        'AI catalog indexed',
      );
    else databaseCliLogger.info({ event: 'ai.catalog.schema_upgraded' });
  } finally {
    await pool.end();
  }
}

// Keep imports side-effect free for focused CLI/schema tests.
if (
  process.argv[1] &&
  /(?:^|[/\\])index-ai-catalog\.(?:js|ts)$/.test(process.argv[1])
) {
  indexAiCatalog().catch(() => {
    // Provider/driver errors may contain credentials or query text; never print raw errors.
    databaseCliLogger.error(
      { event: 'ai.catalog.index_failed' },
      'AI catalog indexing failed; check schema, writer privileges and embedding configuration',
    );
    process.exitCode = 1;
  });
}
