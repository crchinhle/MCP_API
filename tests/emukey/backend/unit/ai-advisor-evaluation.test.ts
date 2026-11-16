import { AiAdvisorService, type AiIntent } from '../../../../EmuKey/backend/src/modules/assistance-support/application/ai-advisor.service.js';

// Controlled offline evaluation. No fake embedding results are counted as provider quality.
// Each row records input, context, expected intent/source/behavior; Vitest records actual pass/fail and latency.
const groups: Array<{ intent: AiIntent; questions: string[] }> = [
  { intent: 'PRODUCT_QA', questions: ['Classroom có những gói nào?', 'Giá bản quyền là bao nhiêu?', 'Gói doanh nghiệp có bao nhiêu máy?', 'Sản phẩm Classroom dùng để làm gì?', 'Thời hạn gói bản quyền?', 'EmuKey có sản phẩm nào?', 'Gói Business có tính năng đồng bộ?', 'Phần mềm có tương thích Linux?'] },
  { intent: 'USAGE_GUIDANCE', questions: ['Hướng dẫn cài đặt phần mềm', 'Làm sao kích hoạt license?', 'Tôi gặp lỗi khi mở phần mềm', 'Hướng dẫn sử dụng Classroom', 'Khắc phục mã lỗi E401', 'Thiết lập theo hướng dẫn chính thức', 'Cách cài đặt trên máy mới', 'Cách kích hoạt bản quyền trên máy tính'] },
  { intent: 'PRODUCT_RECOMMENDATION', questions: ['Tôi cần phần mềm quản lý lớp học', 'Tìm phần mềm quản lý học viên', 'Gói nào phù hợp ngân sách 500.000 đồng?', 'Đề xuất sản phẩm cho doanh nghiệp nhỏ', 'Tôi cần 10 thiết bị', 'Ngân sách tối đa 1 triệu đồng', 'Có gợi ý cho trường học không?', 'Nên chọn sản phẩm nào?'] },
  { intent: 'FOLLOW_UP', questions: ['Gói đó có bao nhiêu máy?', 'Cái thứ hai có thời hạn bao lâu?', 'Còn gói rẻ hơn thì sao?', 'So sánh hai sản phẩm vừa đề xuất', 'Hướng dẫn cài đặt sản phẩm đầu tiên', 'Loại đó có hỗ trợ 10 máy?', 'Gói thứ hai bao nhiêu tiền?', 'Cái đầu tiên dùng như thế nào?'] },
  { intent: 'SUPPORT_REQUIRED', questions: ['Thanh toán xong chưa nhận được license', 'Chưa nhận được bản quyền', 'Lỗi tài khoản không đăng nhập được', 'Tôi muốn gặp nhân viên', 'Vẫn không thể kích hoạt', 'Tài khoản bị hack', 'Cần hỗ trợ trực tiếp', 'Thanh toán bị trừ tiền hai lần'] },
  { intent: 'OUT_OF_SCOPE', questions: ['Hôm nay thời tiết thế nào?', 'Kết quả bóng đá hôm qua?', 'Viết thơ về mùa thu', 'Hướng dẫn nấu ăn', 'Tư vấn tình yêu', 'Nói về chính trị', 'Kể chuyện vui', 'Giải bài toán lượng giác'] },
];

const cases = groups.flatMap(group => group.questions.map(question => ({ question, context: [], expectedIntent: group.intent, expectedSource: null, expectedBehavior: group.intent === 'FOLLOW_UP' ? 'CLARIFICATION' : group.intent === 'SUPPORT_REQUIRED' || group.intent === 'OUT_OF_SCOPE' ? group.intent : 'NO_SOURCES' })));

describe('48-case controlled AI evaluation without source evidence', () => {
  it.each(cases)('$expectedIntent: $question', async ({ question, context, expectedIntent, expectedBehavior }) => {
    const catalog = { search: vi.fn().mockResolvedValue([]) };
    const knowledge = { search: vi.fn().mockResolvedValue([]) };
    const gateway = { answerGrounded: vi.fn() };
    const actual = await new AiAdvisorService(gateway, catalog, knowledge).answer({ question, history: context });
    expect(actual.intent).toBe(expectedIntent);
    expect(actual.outcome).toBe(expectedBehavior);
    expect(actual.citedSourceIds).toEqual([]);
    expect(actual.grounded).toBe(false);
    expect(gateway.answerGrounded).not.toHaveBeenCalled();
  });
});

const catalogSource = { id: 'catalog:plan-1', kind: 'CATALOG' as const, productId: 'product-1', productCode: 'CLASSROOM', productName: 'Classroom', planId: 'plan-1', planName: 'Business', priceVnd: 300000, maxActiveDevices: 10, durationMonths: 12, entitlements: {}, content: JSON.stringify({ description: 'Quản lý lớp học và theo dõi tiến độ học viên.' }) };
const documentSource = { id: 'chunk-1', documentId: 'document-1', documentTitle: 'Hướng dẫn Classroom', documentVersion: 1, chunkIndex: 0, content: 'Để cài đặt Classroom, mở bộ cài và chọn Cài đặt. Để kích hoạt bản quyền, mở Cài đặt và chọn Kích hoạt. Khi gặp mã lỗi E401, kiểm tra kết nối Internet.' };
const positive = [
  { question: 'Classroom có những gói nào?', expectedIntent: 'PRODUCT_QA', expectedSource: catalogSource.id, expectedBehavior: 'ANSWERED', context: [] },
  { question: 'Classroom giá bao nhiêu?', expectedIntent: 'PRODUCT_QA', expectedSource: catalogSource.id, expectedBehavior: 'ANSWERED', context: [] },
  { question: 'Classroom dùng để làm gì?', expectedIntent: 'PRODUCT_QA', expectedSource: catalogSource.id, expectedBehavior: 'ANSWERED', context: [] },
  { question: 'EmuKey có sản phẩm nào?', expectedIntent: 'PRODUCT_QA', expectedSource: catalogSource.id, expectedBehavior: 'ANSWERED', context: [] },
  { question: 'Hướng dẫn cài đặt Classroom', expectedIntent: 'USAGE_GUIDANCE', expectedSource: documentSource.id, expectedBehavior: 'ANSWERED', context: [] },
  { question: 'Cách kích hoạt bản quyền Classroom', expectedIntent: 'USAGE_GUIDANCE', expectedSource: documentSource.id, expectedBehavior: 'ANSWERED', context: [] },
  { question: 'Khắc phục mã lỗi E401', expectedIntent: 'USAGE_GUIDANCE', expectedSource: documentSource.id, expectedBehavior: 'ANSWERED', context: [] },
  { question: 'Tôi cần phần mềm cho 10 thiết bị', expectedIntent: 'PRODUCT_RECOMMENDATION', expectedSource: catalogSource.id, expectedBehavior: 'ANSWERED', context: [] },
  { question: 'Ngân sách dưới 500.000đ', expectedIntent: 'PRODUCT_RECOMMENDATION', expectedSource: catalogSource.id, expectedBehavior: 'ANSWERED', context: [] },
  { question: 'Nên chọn phần mềm nào?', expectedIntent: 'PRODUCT_RECOMMENDATION', expectedSource: catalogSource.id, expectedBehavior: 'ANSWERED', context: [] },
  { question: 'Gói đó hỗ trợ bao nhiêu máy?', expectedIntent: 'FOLLOW_UP', expectedSource: catalogSource.id, expectedBehavior: 'ANSWERED', context: [{ role: 'assistant' as const, content: 'Classroom', catalogSources: [catalogSource] }] },
  { question: 'Gói nào rẻ nhất?', expectedIntent: 'FOLLOW_UP', expectedSource: catalogSource.id, expectedBehavior: 'ANSWERED', context: [{ role: 'assistant' as const, content: 'Classroom', catalogSources: [catalogSource] }] },
];

describe('12-case controlled source-backed and multi-turn evaluation', () => {
  it.each(positive)('$expectedIntent: $question', async ({ question, context, expectedIntent, expectedSource, expectedBehavior }) => {
    const actual = await new AiAdvisorService({ answerGrounded: async () => ({ answer: 'Untrusted prose must not appear', grounded: true, citedSourceIds: [documentSource.id], evidence: [{ sourceId: documentSource.id, quote: documentSource.content }] }) },
      { search: async () => [catalogSource] }, { search: async () => [documentSource] }).answer({ question, history: context });
    expect(actual.intent).toBe(expectedIntent);
    expect(actual.outcome).toBe(expectedBehavior);
    expect(actual.grounded).toBe(true);
    expect(actual.citedSourceIds).toContain(expectedSource);
    expect(actual.answer).not.toContain('Untrusted prose');
  });
});
