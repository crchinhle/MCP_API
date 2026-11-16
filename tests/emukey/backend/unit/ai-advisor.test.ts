import { AiAdvisorService, classifyIntent, extractRequirements, redactSecrets } from '../../../../EmuKey/backend/src/modules/assistance-support/application/ai-advisor.service.js';

const product = { id: 'catalog:p1', kind: 'CATALOG' as const, content: 'Classroom Hub Business quản lý lớp học', productId: 'product1', productCode: 'classroom', productName: 'Classroom Hub', planId: 'p1', planName: 'Business', priceVnd: 450000, maxActiveDevices: 10, durationMonths: 12, entitlements: {} };
const make = () => {
  const catalog = { search: vi.fn().mockResolvedValue([product]) };
  const knowledge = { search: vi.fn().mockResolvedValue([]) };
  const gateway = { answerGrounded: vi.fn() };
  return { catalog, knowledge, gateway, service: new AiAdvisorService(gateway, catalog, knowledge) };
};

describe('AI advisor safety and orchestration', () => {
  it.each(['Gói Classroom Hub có những gói nào giá ra sao và được nhà cung cấp nào cung cấp', 'sản phẩm ClinicDesk'])('answers product family phrasing: %s', async question => {
    const { service, catalog } = make();
    const family = question.includes('ClinicDesk') ? 'ClinicDesk' : 'Classroom Hub';
    catalog.search.mockResolvedValue([{ ...product, productName: `${family} Business`, content: JSON.stringify({ description: 'Phần mềm quản lý.', providerName: 'Nhà cung cấp A' }) }]);
    const result = await service.answer({ question });
    expect(result.outcome).toBe('ANSWERED');
    expect(result.answer).toContain(`${family} Business`);
    if (question.includes('nhà cung cấp')) expect(result.answer).toContain('Nhà cung cấp A');
  });
  it.each([
    ['Tôi cần phần mềm quản lý lớp học', 'PRODUCT_RECOMMENDATION'],
    ['Ngân sách 500.000 đồng cho 10 thiết bị', 'PRODUCT_RECOMMENDATION'],
    ['Classroom Hub có những gói nào?', 'PRODUCT_QA'],
    ['Hướng dẫn cài đặt Classroom Hub', 'USAGE_GUIDANCE'],
    ['Thanh toán thành công nhưng chưa nhận được license', 'SUPPORT_REQUIRED'],
    ['Hôm nay thời tiết thế nào?', 'OUT_OF_SCOPE'],
    ['Gói đó hỗ trợ bao nhiêu máy?', 'FOLLOW_UP'],
  ])('classifies %s', (question, expected) => expect(classifyIntent(question)).toBe(expected));

  it('extracts hard constraints without inventing values', () => {
    expect(extractRequirements('Ngân sách tối đa 500.000 đồng, 10 thiết bị trong 12 tháng')).toEqual({ maxPriceVnd: 500000, minDevices: 10, durationMonths: 12 });
    expect(extractRequirements('Giá khoảng 1,5 triệu cho 5 máy')).toMatchObject({ maxPriceVnd: 1500000, minDevices: 5 });
    expect(extractRequirements('Tôi cần phần mềm dưới 500.000đ cho 5 máy')).toMatchObject({ maxPriceVnd: 500000, minDevices: 5 });
    expect(extractRequirements('Ngân sách 500.000₫')).toMatchObject({ maxPriceVnd: 500000 });
  });
  it('answers product purpose only from the published description', async () => {
    const { service, catalog } = make();
    catalog.search.mockResolvedValue([{ ...product, content: JSON.stringify({ description: 'Quản lý lớp học, theo dõi tiến độ học viên.' }) }]);
    expect(await service.answer({ question: 'Classroom Hub dùng để làm gì?' })).toMatchObject({ grounded: true, outcome: 'ANSWERED' });
  });
  it('does not substitute an unrelated product for an unknown named product', async () => {
    const { service } = make();
    expect(await service.answer({ question: 'Phần mềm Không Tồn Tại hỗ trợ bao nhiêu máy?' })).toMatchObject({ outcome: 'NO_SOURCES', catalogSources: [] });
  });
  it('returns backend facts and recommendation cards without model-generated prices', async () => {
    const { service, gateway } = make();
    const result = await service.answer({ question: 'Tôi cần phần mềm quản lý lớp học' });
    expect(result).toMatchObject({ grounded: true, recommendations: [{ planId: 'p1', priceVnd: 450000 }] });
    expect(gateway.answerGrounded).not.toHaveBeenCalled();
  });
  it('does not replace hard constraints with similarity', async () => {
    const { service } = make();
    expect(await service.answer({ question: 'Tôi cần phần mềm dưới 100.000 đồng cho 20 máy' })).toMatchObject({ grounded: false, recommendations: [], outcome: 'NO_SOURCES' });
  });
  it('invalidates replayed prices and removed Knowledge sources', async () => {
    const { service, catalog, knowledge } = make();
    const answer = await service.answer({ question: 'Tôi cần phần mềm quản lý lớp học' });
    expect(await service.isCurrent(answer, 'Tôi cần phần mềm quản lý lớp học')).toBe(true);
    catalog.search.mockResolvedValue([{ ...product, priceVnd: 999999 }]);
    expect(await service.isCurrent(answer, 'Tôi cần phần mềm quản lý lớp học')).toBe(false);
    knowledge.search.mockResolvedValue([]);
    expect(await service.isCurrent({ grounded: true, citationDetails: [{ chunkId: 'k', documentId: 'd', documentTitle: 'Guide', documentVersion: 1, chunkIndex: 0, excerpt: 'Cài đặt' }] }, 'Cài đặt')).toBe(false);
  });
  it('asks for numeric clarification when an explicit budget cannot be parsed', async () => {
    const { service, catalog } = make();
    expect(await service.answer({ question: 'Tôi cần phần mềm ngân sách năm trăm nghìn đồng' })).toMatchObject({ outcome: 'CLARIFICATION' });
    expect(catalog.search).not.toHaveBeenCalled();
  });
  it('asks for clarification rather than selecting an ambiguous reference', async () => {
    const { service, catalog } = make();
    expect(await service.answer({ question: 'Gói đó có bao nhiêu máy?', history: [{ role: 'assistant', content: '', catalogSources: [product, { ...product, planId: 'p2', id: 'catalog:p2' }] }] })).toMatchObject({ outcome: 'CLARIFICATION' });
    expect(catalog.search).not.toHaveBeenCalled();
  });
  it('resolves an ordinal then rechecks the current catalog', async () => {
    const { service, catalog } = make();
    await service.answer({ question: 'Cái thứ hai có bao nhiêu thiết bị?', history: [{ role: 'assistant', content: '', catalogSources: [{ ...product, planId: 'p0' }, product] }] });
    expect(catalog.search).toHaveBeenCalledWith(expect.objectContaining({ planIds: ['p1'] }));
  });
  it('keeps the earlier recommendation order when comparing after focusing the cheapest plan', async () => {
    const { service, catalog } = make();
    await service.answer({ question: 'So sánh với gói thứ hai.', history: [
      { role: 'assistant', content: 'Recommendations', catalogSources: [product, { ...product, id: 'catalog:p2', planId: 'p2' }] },
      { role: 'assistant', content: 'Cheapest', catalogSources: [product] },
    ] });
    expect(catalog.search).toHaveBeenCalledWith(expect.objectContaining({ planIds: ['p1', 'p2'] }));
  });
  it('does not forward support/payment issues to the model or create tickets', async () => {
    const { service, gateway, catalog } = make();
    expect(await service.answer({ question: 'Thanh toán thành công nhưng chưa nhận được license' })).toMatchObject({ outcome: 'SUPPORT_REQUIRED', grounded: false });
    expect(catalog.search).not.toHaveBeenCalled();
    expect(gateway.answerGrounded).not.toHaveBeenCalled();
  });
  it('keeps out-of-scope questions away from Support and retrieval', async () => {
    const { service, catalog } = make();
    expect(await service.answer({ question: 'Hôm nay thời tiết thế nào?' })).toMatchObject({ outcome: 'OUT_OF_SCOPE' });
    expect(catalog.search).not.toHaveBeenCalled();
  });
  it('distinguishes provider failure from missing evidence', async () => {
    const { service, knowledge, gateway } = make();
    knowledge.search.mockResolvedValue([{ id: 'k', content: 'Mở cài đặt và chọn Kích hoạt.', documentId: 'd', documentTitle: 'Cài đặt', documentVersion: 1, chunkIndex: 0 }]);
    gateway.answerGrounded.mockRejectedValue(new Error('TIMEOUT'));
    expect(await service.answer({ question: 'Hướng dẫn cài đặt Classroom' })).toMatchObject({ outcome: 'PROVIDER_UNAVAILABLE' });
  });
  it('rejects valid citation IDs carrying invented or unrelated excerpts', async () => {
    const { service, knowledge, gateway } = make();
    knowledge.search.mockResolvedValue([{ id: 'k', content: 'Mở cài đặt và chọn Kích hoạt.', documentId: 'd', documentTitle: 'Cài đặt', documentVersion: 1, chunkIndex: 0 }]);
    gateway.answerGrounded.mockResolvedValue({ answer: 'Tự sửa cơ sở dữ liệu', citedSourceIds: ['k'], grounded: true, evidence: [{ sourceId: 'k', quote: 'Tự sửa cơ sở dữ liệu' }] });
    expect(await service.answer({ question: 'Hướng dẫn cài đặt Classroom' })).toMatchObject({ outcome: 'NO_SOURCES', grounded: false });
  });
  it('rejects an exact but irrelevant quote even when generic words and the product name match', async () => {
    const { service, knowledge, gateway } = make();
    const content = 'Classroom: hướng dẫn sao lưu dữ liệu hàng ngày.';
    knowledge.search.mockResolvedValue([{ id: 'k', content, documentId: 'd', documentTitle: 'Guide', documentVersion: 1, chunkIndex: 0 }]);
    gateway.answerGrounded.mockResolvedValue({ answer: 'Cài đặt từ bản sao lưu', grounded: true, citedSourceIds: ['k'], evidence: [{ sourceId: 'k', quote: content }] });
    expect(await service.answer({ question: 'Hướng dẫn cài đặt Classroom' })).toMatchObject({ outcome: 'NO_SOURCES', grounded: false });
  });
  it('returns only exact verified evidence, never the untrusted model answer', async () => {
    const { service, knowledge, gateway } = make();
    knowledge.search.mockResolvedValue([{ id: 'k', content: 'Mở cài đặt và chọn Kích hoạt.', documentId: 'd', documentTitle: 'Cài đặt', documentVersion: 1, chunkIndex: 0 }]);
    gateway.answerGrounded.mockResolvedValue({ answer: 'Thêm bước không có trong nguồn', citedSourceIds: ['k'], grounded: true, evidence: [{ sourceId: 'k', quote: 'Mở cài đặt và chọn Kích hoạt.' }] });
    const result = await service.answer({ question: 'Hướng dẫn cài đặt Classroom' });
    expect(result.answer).toContain('Mở cài đặt và chọn Kích hoạt.');
    expect(result.answer).not.toContain('Thêm bước');
    expect(result.citationDetails).toMatchObject([{ documentId: 'd', documentVersion: 1 }]);
  });
  it('redacts passwords, bearer credentials and license keys from external context', () => {
    const value = redactSecrets('password: abc123 Bearer abc.def.xyz license key: AAAA-BBBB-CCCC-DDDD');
    expect(value).not.toContain('abc123'); expect(value).not.toContain('abc.def.xyz'); expect(value).not.toContain('AAAA-BBBB');
    expect(redactSecrets('password is mySecret123; access token abc.def.ghi')).not.toMatch(/mySecret123|abc\.def\.ghi/);
    expect(redactSecrets('mật khẩu là MatKhau123')).not.toContain('MatKhau123');
  });
});
