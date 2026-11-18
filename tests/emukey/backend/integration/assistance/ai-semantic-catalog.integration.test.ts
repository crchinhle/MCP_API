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
  // A semantic answer may require multiple provider calls. Pace this opt-in
  // suite so evaluation does not manufacture quota failures with a local burst.
  beforeEach(async () => { await new Promise((resolve) => setTimeout(resolve, 9000)); });
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
  it('recommends only current plans that satisfy an explicit budget and device limit', async () => {
    const result = await advisor.answer({ question: 'Tôi cần phần mềm quản lý lớp học, ngân sách tối đa 3 triệu đồng, cho 5 thiết bị.' });
    expect(result.outcome).toBe('ANSWERED');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.every(source => source.priceVnd! <= 3000000 && source.maxActiveDevices! >= 5)).toBe(true);
  });
  it('does not exceed a budget when no classroom plan supports five devices below two million', async () => {
    const result = await advisor.answer({ question: 'Tôi cần phần mềm quản lý lớp học, ngân sách tối đa 2 triệu đồng, cho 5 thiết bị.' });
    expect(result.outcome).toBe('NO_SOURCES');
    expect(result.recommendations).toEqual([]);
  });
  it('grounds installation guidance in currently published public Knowledge', async () => {
    const result = await advisor.answer({ question: 'Hướng dẫn cài đặt Classroom Hub' });
    expect(result.outcome).toBe('ANSWERED');
    expect(result.grounded).toBe(true);
    expect(result.citationDetails.length).toBeGreaterThan(0);
    expect(result.citationDetails.every(source => source.documentVersion > 0 && Boolean(source.excerpt.trim()))).toBe(true);
  });
  it('resolves ordinal and latest references against current catalog facts and clarifies ambiguous targets', async () => {
    const family = await advisor.answer({ question: 'ClinicDesk có những gói nào và giá bao nhiêu?' });
    expect(family.outcome).toBe('ANSWERED');
    expect(family.catalogSources.length).toBeGreaterThanOrEqual(2);
    const history = [{ role: 'assistant' as const, content: family.answer, catalogSources: family.catalogSources }];
    const ambiguous = await advisor.answer({ question: 'Cái đó giá bao nhiêu?', history });
    expect(ambiguous.outcome).toBe('CLARIFICATION');
    const second = await advisor.answer({ question: 'Cái thứ hai giá bao nhiêu?', history });
    expect(second.outcome).toBe('ANSWERED');
    expect(second.catalogSources).toHaveLength(1);
    expect(second.catalogSources[0]?.planId).toBe(family.catalogSources[1]?.planId);
    const latest = await advisor.answer({ question: 'Sản phẩm vừa nói hỗ trợ bao nhiêu thiết bị?', history: [...history, { role: 'assistant', content: second.answer, catalogSources: second.catalogSources }] });
    expect(latest.outcome).toBe('ANSWERED');
    expect(latest.catalogSources[0]?.planId).toBe(second.catalogSources[0]?.planId);
    expect(latest.answer).toContain(String(latest.catalogSources[0]?.maxActiveDevices));
    const yearly = await advisor.answer({ question: 'Nếu đổi sang gói năm thì sao?', history: [{ role: 'assistant', content: second.answer, catalogSources: second.catalogSources }] });
    expect(yearly.outcome).toBe('ANSWERED');
    expect(yearly.catalogSources.length).toBeGreaterThan(0);
    expect(yearly.catalogSources.every(source => source.productId === second.catalogSources[0]?.productId && source.durationMonths === 12)).toBe(true);
  });
});
