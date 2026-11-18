import { AiAdvisorService } from '../../../../EmuKey/backend/src/modules/assistance-support/application/ai-advisor.service.js';
import type { QuestionUnderstanding } from '../../../../EmuKey/backend/src/modules/assistance-support/application/ports/ai-gateway.port.js';

const understanding: QuestionUnderstanding = { intent: 'PRODUCT_QA', searchQuery: 'ClinicDesk phần mềm quản lý phòng khám', productReference: 'ClinicDesk', reference: { mode: 'NONE', index: null }, requirements: { maxPriceVnd: null, minDevices: null, durationMonths: null }, requestedFields: ['OVERVIEW'], clarification: null };
const source = { id: 'catalog:p1', kind: 'CATALOG' as const, productId: 'product1', productCode: 'DEMO_CLINICDESK_BUSINESS', productName: 'ClinicDesk Business', planId: 'p1', planName: 'Doanh nghiệp', priceVnd: 300000, maxActiveDevices: 10, durationMonths: 12, entitlements: { reports: true }, content: JSON.stringify({ description: 'Quản lý phòng khám và lịch hẹn.', providerName: 'Công ty A' }) };
function setup(overrides: Partial<QuestionUnderstanding> = {}) {
  const gateway = { understandQuestion: vi.fn().mockResolvedValue({ ...understanding, ...overrides }), selectCatalog: vi.fn().mockResolvedValue({ sourceIds: [source.id], ambiguous: false, clarification: null }), answerGrounded: vi.fn().mockResolvedValue({ grounded: false, answer: '', citedSourceIds: [], evidence: [] }) };
  const catalog = { search: vi.fn().mockResolvedValue([source]) };
  const knowledge = { search: vi.fn().mockResolvedValue([]) };
  return { gateway, catalog, knowledge, ai: new AiAdvisorService(gateway, catalog, knowledge) };
}
describe('Semantic question understanding drives production orchestration', () => {
  it.each(['clinic desk bn tien v', 'cái app đặt lịch cho bác sĩ ấy', 'cho xem sản phẩn ClinikDesk', 'Tell me about the clinic app'])('understands diverse phrasing without matching a hard-coded regex: %s', async question => {
    const { ai, gateway, catalog } = setup();
    const result = await ai.answer({ question });
    expect(gateway.understandQuestion).toHaveBeenCalledWith(expect.objectContaining({ question }));
    expect(catalog.search).toHaveBeenCalledWith(expect.objectContaining({ question: understanding.searchQuery, interpreted: true }));
    expect(result).toMatchObject({ grounded: true, outcome: 'ANSWERED' });
    expect(result.answer).toContain('Quản lý phòng khám');
  });
  it('requires a verified selection and never accepts model-invented source IDs', async () => {
    const { ai, gateway } = setup(); gateway.selectCatalog.mockResolvedValue({ sourceIds: ['invented'], ambiguous: false, clarification: null });
    expect(await ai.answer({ question: 'ClinicDesk' })).toMatchObject({ grounded: false, outcome: 'NO_SOURCES' });
  });
  it('asks a clarification when the model finds multiple possible products', async () => {
    const { ai, gateway } = setup(); gateway.selectCatalog.mockResolvedValue({ sourceIds: [], ambiguous: true, clarification: 'Bạn muốn phần mềm phòng khám hay quản lý lớp học?' });
    expect(await ai.answer({ question: 'app đó' })).toMatchObject({ outcome: 'CLARIFICATION' });
  });
  it('keeps requirements strict even if model selection includes an over-budget plan', async () => {
    const { ai } = setup({ intent: 'PRODUCT_RECOMMENDATION', requirements: { maxPriceVnd: 100000, minDevices: null, durationMonths: null } });
    expect(await ai.answer({ question: 'tầm một trăm nghìn đổ lại' })).toMatchObject({ outcome: 'NO_SOURCES', recommendations: [] });
  });
  it('returns recommendation cards when the semantic intent uses the default overview field', async () => {
    const { ai } = setup({ intent: 'PRODUCT_RECOMMENDATION', requirements: { maxPriceVnd: 3000000, minDevices: 5, durationMonths: null }, requestedFields: ['OVERVIEW'] });
    const result = await ai.answer({ question: 'Tôi cần phần mềm quản lý phòng khám cho 5 thiết bị, tối đa 3 triệu.' });
    expect(result).toMatchObject({ intent: 'PRODUCT_RECOMMENDATION', outcome: 'ANSWERED', recommendations: [expect.objectContaining({ planId: 'p1', priceVnd: 300000, maxActiveDevices: 10 })] });
    expect(result.answer).toContain('300.000');
  });
  it('allows an explicit new budget instead of retaining an obsolete lower budget from history', async () => {
    const { ai, catalog } = setup({ intent: 'PRODUCT_RECOMMENDATION', requirements: { maxPriceVnd: 1000000, minDevices: null, durationMonths: null } });
    await ai.answer({ question: 'Tăng ngân sách lên một triệu', history: [{ role: 'user', content: 'Ngân sách 200.000 đồng' }] });
    expect(catalog.search).toHaveBeenCalledWith(expect.objectContaining({ maxPriceVnd: 1000000 }));
  });
  it('returns an actual provider failure when question understanding is unavailable', async () => {
    const { ai, gateway, catalog } = setup(); gateway.understandQuestion.mockRejectedValue(new Error('timeout'));
    expect(await ai.answer({ question: 'ClinicDesk' })).toMatchObject({ outcome: 'PROVIDER_UNAVAILABLE' });
    expect(catalog.search).not.toHaveBeenCalled();
  });
  it('looks up the current product plans again when a follow-up changes the term', async () => {
    const { ai, catalog } = setup({ intent: 'FOLLOW_UP', reference: { mode: 'LATEST', index: null }, requirements: { maxPriceVnd: null, minDevices: null, durationMonths: 12 }, requestedFields: ['PRICE', 'DURATION'] });
    const oldPlan = { ...source, id: 'catalog:monthly', planId: 'monthly', durationMonths: 1 };
    const result = await ai.answer({ question: 'Nếu đổi sang gói năm thì sao?', history: [{ role: 'assistant', content: 'Gói tháng', catalogSources: [oldPlan] }] });
    expect(catalog.search).toHaveBeenCalledWith(expect.objectContaining({ productIds: ['product1'], durationMonths: 12 }));
    expect(catalog.search.mock.calls[0]?.[0]).not.toHaveProperty('planIds');
    expect(result).toMatchObject({ outcome: 'ANSWERED', grounded: true });
    expect(result.catalogSources).toEqual(expect.arrayContaining([expect.objectContaining({ planId: 'p1' })]));
  });
  it('answers requested provider and prices using backend facts rather than model text', async () => {
    const { ai } = setup({ requestedFields: ['PROVIDER', 'PRICE', 'PLANS'] });
    const actual = await ai.answer({ question: 'bên nào bán cái phòng khám, nhiêu tiền?' });
    expect(actual.answer).toContain('Công ty A'); expect(actual.answer).toContain('300.000');
  });
  it('does not answer compatibility by listing irrelevant prices', async () => {
    const { ai } = setup({ requestedFields: ['COMPATIBILITY'] });
    expect(await ai.answer({ question: 'chạy được trên mac không?' })).toMatchObject({ outcome: 'NO_SOURCES', grounded: false });
  });
});
