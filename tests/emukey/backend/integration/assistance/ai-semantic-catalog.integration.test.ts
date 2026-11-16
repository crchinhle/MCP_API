import { ConfigService } from '@nestjs/config';
import { AiRetrievalDatabase } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/ai-retrieval.database.js';
import { CatalogAiRepository } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/catalog-ai.repository.js';
import { KnowledgeAiRepository } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/knowledge-ai.repository.js';
import { GeminiAiGateway } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/gemini-ai.gateway.js';
import { GeminiEmbeddingGateway } from '../../../../../EmuKey/backend/src/modules/assistance-support/infrastructure/gemini-embedding.gateway.js';
import { AiAdvisorService } from '../../../../../EmuKey/backend/src/modules/assistance-support/application/ai-advisor.service.js';

// Explicit read-only end-to-end evaluation against the configured public catalog.
// No Conversation/Message/session/index/database mutations are performed.
describe.skipIf(process.env.EMUKEY_TEST_REAL_CATALOG !== '1')('Real semantic advisor over the public Catalog', () => {
  let reader: AiRetrievalDatabase;
  let advisor: AiAdvisorService;
  beforeAll(() => {
    reader = new AiRetrievalDatabase(new ConfigService({ DATABASE_URL: process.env.DATABASE_URL, AI_RETRIEVAL_DATABASE_URL: process.env.AI_RETRIEVAL_DATABASE_URL }));
    const gateway = new GeminiAiGateway({ apiKey: process.env.GEMINI_API_KEY ?? '', model: process.env.GEMINI_MODEL ?? '', timeoutMs: 20000, maxOutputTokens: 1024 });
    const embedding = new GeminiEmbeddingGateway({ apiKey: process.env.GEMINI_API_KEY ?? '', model: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001', dimensions: Number(process.env.GEMINI_EMBEDDING_DIMENSIONS ?? 768) });
    advisor = new AiAdvisorService(gateway, new CatalogAiRepository(reader, embedding), new KnowledgeAiRepository(reader));
  });
  afterAll(async () => { await reader?.onApplicationShutdown(); });
  it.each([
    ['Gói Classroom Hub có những gói nào giá ra sao và được nhà cung cấp nào cung cấp', 'Classroom', true],
    ['sản phẩm ClinicDesk', 'ClinicDesk', false],
    ['clinic desk bn tien v', 'ClinicDesk', false],
    ['classrom hub co nhung goi nao z', 'Classroom', true],
    ['cái phần mềm cho phòng khám đặt lịch bác sĩ có những bản nào?', 'ClinicDesk', false],
    ['bên nào làm Classroom Hub, giá cả sao shop?', 'Classroom', false],
  ])('answers a varied real question: %s', async (question, name, expectFamily) => {
    const actual = await advisor.answer({ question });
    expect(actual.outcome).toBe('ANSWERED');
    expect(actual.grounded).toBe(true);
    expect(actual.catalogSources.length).toBeGreaterThan(0);
    expect(actual.catalogSources.every(source => source.productName?.includes(name))).toBe(true);
    if (expectFamily) expect(actual.catalogSources).toHaveLength(3);
    if (question.includes('nhà cung cấp')) expect(actual.answer).toContain('Nhà cung cấp:');
  });
  it('rejects a nonexistent named product rather than substituting semantic neighbors', async () => {
    const actual = await advisor.answer({ question: 'Phần mềm UnreleasedImaginarySuiteZXQ có giá bao nhiêu?' });
    expect(actual.outcome).toBe('NO_SOURCES');
    expect(actual.grounded).toBe(false);
  });
});
