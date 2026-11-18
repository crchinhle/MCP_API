import { Logger } from '@nestjs/common';
import { catalogReference } from './catalog-reference.js';
import type {
  AiGatewayPort,
  CitationDetail,
  GroundingSource,
} from './ports/ai-gateway.port.js';
import type { QuestionUnderstanding } from './ports/ai-gateway.port.js';

export type AiIntent =
  | 'PRODUCT_QA'
  | 'USAGE_GUIDANCE'
  | 'PRODUCT_RECOMMENDATION'
  | 'FOLLOW_UP'
  | 'SUPPORT_REQUIRED'
  | 'OUT_OF_SCOPE';
export type AiOutcome =
  | 'ANSWERED'
  | 'CLARIFICATION'
  | 'NO_SOURCES'
  | 'OUT_OF_SCOPE'
  | 'SUPPORT_REQUIRED'
  | 'PROVIDER_UNAVAILABLE';
export interface AiTurn {
  role: 'user' | 'assistant';
  content: string;
  catalogSources?: GroundingSource[];
}
export interface Requirements {
  maxPriceVnd?: number;
  minDevices?: number;
  durationMonths?: number;
}
export interface CatalogSearchInput extends Requirements {
  interpreted?: boolean;
  productReference?: string;
  question: string;
  productIds?: string[];
  planIds?: string[];
}
export interface AdvisorAnswer {
  answer: string;
  intent: AiIntent;
  outcome: AiOutcome;
  grounded: boolean;
  citedSourceIds: string[];
  citationDetails: CitationDetail[];
  catalogSources: GroundingSource[];
  recommendations: GroundingSource[];
}
export interface AdvisorInput {
  question: string;
  history?: AiTurn[];
  productIds?: string[];
  planIds?: string[];
}

export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('đ', 'd')
    .replaceAll('Đ', 'D')
    .toLowerCase();
}

export function classifyIntent(question: string): AiIntent {
  const q = normalize(question);
  if (
    /thanh toan|chua nhan.*(license|ban quyen)|loi tai khoan|nhan vien|ho tro truc tiep|van khong.*kich hoat|mat tai khoan|bi hack/.test(
      q,
    )
  )
    return 'SUPPORT_REQUIRED';
  if (/thoi tiet|bong da|chinh tri|lam tho|viet tho|nau an|tinh yeu/.test(q))
    return 'OUT_OF_SCOPE';
  if (
    /\b(?:goi (do|nay)|cai (do|nay|dau tien|thu)|loai do|san pham (do|nay|dau tien|thu)|goi (thu|dau tien)|vua (de xuat|nhac)|re (hon|nhat)|so sanh.*hai)\b/.test(
      q,
    )
  )
    return 'FOLLOW_UP';
  if (
    /cai dat|kich hoat|huong dan|su dung|khac phuc|bao loi|ma loi|loi khi/.test(
      q,
    )
  )
    return 'USAGE_GUIDANCE';
  if (
    /toi can|tim.*phan mem|phu hop|nen chon|ngan sach|de xuat|goi y|duoi.*(dong|trieu|nghin)|toi da.*dong/.test(
      q,
    )
  )
    return 'PRODUCT_RECOMMENDATION';
  if (
    /\b(?:san pham|phan mem|goi|gia|thiet bi|may|emukey|classroom|license|ban quyen|tinh nang|dong bo|tuong thich)\b/.test(
      q,
    )
  )
    return 'PRODUCT_QA';
  return 'OUT_OF_SCOPE';
}

export function extractRequirements(question: string): Requirements {
  const q = normalize(question);
  const result: Requirements = {};
  const money = q.match(
    /(?:ngan sach|toi da|duoi|khoang|gia|khong qua)\s*(?:toi da\s*)?([\d.,]+)\s*(trieu|nghin|ngan|k|dong|vnd|d|₫)(?![a-z])/,
  );
  if (money) {
    const unit = money[2]!;
    const number =
      unit === 'trieu'
        ? Number(money[1]!.replace(',', '.'))
        : Number(money[1]!.replace(/[.,]/g, ''));
    const value =
      number *
      (unit === 'trieu' ? 1000000 : /nghin|ngan|k/.test(unit) ? 1000 : 1);
    if (Number.isSafeInteger(value) && value >= 0) result.maxPriceVnd = value;
  }
  const devices = q.match(/(\d+)\s*(?:thiet bi|may)/);
  const duration = q.match(/(\d+)\s*(thang|nam)/);
  if (devices && Number(devices[1]) > 0) result.minDevices = Number(devices[1]);
  if (duration && Number(duration[1]) > 0)
    result.durationMonths =
      Number(duration[1]) * (duration[2] === 'nam' ? 12 : 1);
  return result;
}

export function redactSecrets(value: string): string {
  return value
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(
      /((?:password|mat khau|mật khẩu|api[_ -]?key|access[_ -]?token|license\s*key|activation\s*key))(?:\s*[:=]\s*|\s+(?:(?:is|là|la)\s+)?)[^\s;,]+/gi,
      '$1 [REDACTED]',
    )
    .replace(/\b[A-Za-z0-9]{4,}(?:-[A-Za-z0-9]{4,}){3,}\b/g, '[REDACTED]');
}

export function boundedHistory(turns: AiTurn[] = []): AiTurn[] {
  let remaining = 12000;
  const result: AiTurn[] = [];
  for (const turn of turns.slice(-16).reverse()) {
    if (remaining <= 0) break;
    const content = redactSecrets(turn.content).slice(
      0,
      Math.min(2000, remaining),
    );
    remaining -= content.length;
    // Only identifiers and ordering are needed to resolve references. Never reuse remembered prices as facts.
    result.unshift({
      role: turn.role,
      content,
      ...(turn.catalogSources
        ? { catalogSources: turn.catalogSources.slice(0, 5) }
        : {}),
    });
  }
  return result;
}

export class AiAdvisorService {
  private readonly logger = new Logger(AiAdvisorService.name);
  constructor(
    private readonly gateway: AiGatewayPort,
    private readonly catalog: {
      search(input: CatalogSearchInput): Promise<GroundingSource[]>;
    },
    private readonly knowledge: {
      search(input: {
        question: string;
        productIds?: string[];
        planIds?: string[];
      }): Promise<GroundingSource[]>;
    },
  ) {}

  /** Retry identity stays stable, but cached evidence never bypasses current visibility or price. */
  async isCurrent(
    answer: Partial<AdvisorAnswer>,
    question: string,
  ): Promise<boolean> {
    const catalog = answer.catalogSources ?? [];
    if (catalog.length) {
      const planIds = [
        ...new Set(catalog.flatMap((s) => (s.planId ? [s.planId] : []))),
      ];
      if (!planIds.length) return false;
      const current = await this.catalog.search({
        question: 'catalog',
        planIds,
      });
      if (
        catalog.some(
          (old) =>
            !current.some(
              (s) =>
                s.id === old.id &&
                s.content === old.content &&
                s.priceVnd === old.priceVnd &&
                s.maxActiveDevices === old.maxActiveDevices &&
                s.durationMonths === old.durationMonths,
            ),
        )
      )
        return false;
    }
    const citations = answer.citationDetails ?? [];
    if (citations.length) {
      const current = await this.knowledge.search({
        question: redactSecrets(question),
      });
      if (
        citations.some(
          (old) =>
            !current.some(
              (s) =>
                s.id === old.chunkId &&
                s.documentId === old.documentId &&
                s.documentVersion === old.documentVersion &&
                s.content.includes(old.excerpt),
            ),
        )
      )
        return false;
    }
    return !answer.grounded || catalog.length > 0 || citations.length > 0;
  }

  async answer(input: AdvisorInput): Promise<AdvisorAnswer> {
    const started = Date.now();
    let intent: AiIntent = this.gateway.understandQuestion
      ? 'OUT_OF_SCOPE'
      : classifyIntent(input.question);
    const respond = (
      outcome: AiOutcome,
      answer: string,
      extra: Partial<AdvisorAnswer> = {},
    ): AdvisorAnswer => {
      this.logger.log({
        event: 'ai.advisor.completed',
        intent,
        outcome,
        latencyMs: Date.now() - started,
      });
      return {
        answer,
        intent,
        outcome,
        grounded: false,
        citedSourceIds: [],
        citationDetails: [],
        catalogSources: [],
        recommendations: [],
        ...extra,
      };
    };
    const history = boundedHistory(input.history);
    const question = redactSecrets(input.question).slice(0, 4000);
    let understanding: QuestionUnderstanding | undefined;
    if (this.gateway.understandQuestion) {
      try {
        understanding = await this.gateway.understandQuestion({
          question,
          history: history.map((turn) => ({
            role: turn.role,
            content: turn.content,
          })),
        });
        intent = understanding.intent;
      } catch (error) {
        this.logger.warn({
          event: 'ai.understanding.failed',
          code:
            error instanceof Error &&
            error.message === 'GEMINI_INVALID_RESPONSE'
              ? 'INVALID_RESPONSE'
              : 'PROVIDER_ERROR',
          status:
            typeof error === 'object' && error !== null && 'status' in error
              ? error.status
              : undefined,
        });
        return respond(
          'PROVIDER_UNAVAILABLE',
          'Trợ lý đang gặp sự cố khi xử lý câu hỏi. Vui lòng thử lại sau.',
        );
      }
      if (understanding.clarification)
        return respond('CLARIFICATION', understanding.clarification);
    }
    if (intent === 'SUPPORT_REQUIRED')
      return respond(
        'SUPPORT_REQUIRED',
        'Vấn đề này cần nhân viên kiểm tra. Bạn có thể chọn liên hệ nhân viên hỗ trợ bên dưới.',
      );
    if (intent === 'OUT_OF_SCOPE')
      return respond(
        'OUT_OF_SCOPE',
        'Tôi hỗ trợ sản phẩm, gói bản quyền và hướng dẫn sử dụng trên EmuKey. Bạn muốn tìm hiểu sản phẩm nào?',
      );
    let productIds = input.productIds;
    let planIds = input.planIds;
    let cheaperThanPlanId: string | undefined;
    const requirements = (understanding ? [] : history)
      .filter((t) => t.role === 'user')
      .reduce<Requirements>(
        (current, turn) => ({
          ...current,
          ...extractRequirements(turn.content),
        }),
        {},
      );
    Object.assign(requirements, extractRequirements(input.question));
    if (understanding) {
      const parsed = understanding.requirements;
      if (parsed.maxPriceVnd !== null)
        requirements.maxPriceVnd =
          requirements.maxPriceVnd === undefined
            ? parsed.maxPriceVnd
            : Math.min(requirements.maxPriceVnd, parsed.maxPriceVnd);
      if (parsed.minDevices !== null)
        requirements.minDevices = Math.max(
          requirements.minDevices ?? 0,
          parsed.minDevices,
        );
      if (parsed.durationMonths !== null)
        requirements.durationMonths = parsed.durationMonths;
    }
    if (
      requirements.maxPriceVnd === undefined &&
      !understanding &&
      /ngan sach|(?:duoi|toi da|khong qua).*?(?:dong|vnd|₫|\d\s*d\b)/.test(
        normalize(input.question),
      )
    )
      return respond(
        'CLARIFICATION',
        'Ngân sách tối đa của bạn là bao nhiêu đồng? Vui lòng nhập số tiền để tôi lọc chính xác.',
      );
    if (
      intent === 'FOLLOW_UP' ||
      (understanding && understanding.reference.mode !== 'NONE')
    ) {
      const lists = history
        .slice()
        .reverse()
        .flatMap((t) =>
          t.role === 'assistant' && t.catalogSources?.length
            ? [t.catalogSources]
            : [],
        );
      const previous = lists[0] ?? [];
      const q = normalize(input.question);
      const ordinal = understanding
        ? (understanding.reference.index ?? undefined)
        : /dau tien|thu (nhat|1)/.test(q)
          ? 0
          : /thu (hai|2)/.test(q)
            ? 1
            : /thu (ba|3)/.test(q)
              ? 2
              : undefined;
      const ordered =
        ordinal === undefined
          ? previous
          : (lists.find((list) => list.length > 1 && list[ordinal]) ??
            lists.find((list) => list[ordinal]) ??
            []);
      let selected =
        ordinal !== undefined
          ? ordered[ordinal]
            ? [ordered[ordinal]]
            : []
          : previous;
      if (understanding?.reference.mode === 'ALL')
        selected = lists.find((list) => list.length > 1) ?? previous;
      else if (understanding?.reference.mode === 'COMPARE')
        selected =
          ordinal === undefined
            ? (lists.find((list) => list.length > 1) ?? previous)
            : [
                ...new Map(
                  [...previous.slice(0, 1), ...selected].map((p) => [
                    p.planId,
                    p,
                  ]),
                ).values(),
              ];
      else if (!understanding && /re nhat/.test(q))
        selected = lists.find((list) => list.length > 1) ?? previous;
      else if (!understanding && /so sanh/.test(q))
        selected =
          ordinal === undefined
            ? previous
            : [
                ...new Map(
                  [...previous.slice(0, 1), ...selected].map((p) => [
                    p.planId,
                    p,
                  ]),
                ).values(),
              ];
      else if (!understanding && /re hon/.test(q)) {
        if (previous.length !== 1)
          return respond(
            'CLARIFICATION',
            'Bạn muốn tìm gói rẻ hơn gói nào? Vui lòng cho biết tên gói.',
          );
        cheaperThanPlanId = previous[0]?.planId;
        selected = lists.find((list) => list.length > 1) ?? previous;
      } else if (
        ordinal === undefined &&
        new Set(previous.map((p) => p.planId)).size > 1
      )
        selected = [];
      if (!selected.length)
        return respond(
          'CLARIFICATION',
          'Bạn đang hỏi sản phẩm hoặc gói nào? Vui lòng cho biết tên để tôi kiểm tra chính xác.',
        );
      planIds = selected.flatMap((p) => (p.planId ? [p.planId] : []));
      // A different term selects a current plan in the referenced product family.
      // Historical plan IDs must not exclude that family's annual/monthly alternatives.
      if (requirements.durationMonths !== undefined && selected.some(p => p.durationMonths !== requirements.durationMonths)) planIds = undefined;
      productIds = [
        ...new Set(selected.flatMap((p) => (p.productId ? [p.productId] : []))),
      ];
    }
    const retrievalQuestion = understanding
      ? redactSecrets(understanding.searchQuery).slice(0, 4000)
      : question;
    const guidance =
      intent === 'USAGE_GUIDANCE' ||
      Boolean(
        understanding?.requestedFields.some(
          (field) => field === 'FEATURES' || field === 'COMPATIBILITY',
        ),
      ) ||
      (intent === 'FOLLOW_UP' &&
        /cai dat|huong dan|kich hoat|su dung|loi/.test(normalize(question)));
    let catalog: GroundingSource[];
    try {
      catalog = await this.catalog.search({
        question: retrievalQuestion,
        ...(understanding
          ? {
              interpreted: true,
              ...(understanding.productReference
                ? { productReference: understanding.productReference }
                : {}),
            }
          : {}),
        ...requirements,
        ...(productIds?.length ? { productIds } : {}),
        ...(planIds?.length ? { planIds } : {}),
      });
    } catch {
      return respond(
        'PROVIDER_UNAVAILABLE',
        'Tạm thời không thể tra cứu thông tin. Vui lòng thử lại sau.',
      );
    }
    catalog = catalog
      .filter(
        (p) =>
          p.kind === 'CATALOG' &&
          p.productId &&
          p.planId &&
          typeof p.priceVnd === 'number' &&
          Number.isFinite(p.priceVnd) &&
          (requirements.maxPriceVnd === undefined ||
            p.priceVnd <= requirements.maxPriceVnd) &&
          (requirements.minDevices === undefined ||
            (p.maxActiveDevices ?? 0) >= requirements.minDevices) &&
          (requirements.durationMonths === undefined ||
            p.durationMonths === requirements.durationMonths) &&
          (!productIds?.length || productIds.includes(p.productId)) &&
          (!planIds?.length || planIds.includes(p.planId)),
      )
      .slice(0, 5);
    if (understanding && catalog.length && this.gateway.selectCatalog) {
      try {
        const selection = await this.gateway.selectCatalog({
          question,
          sources: catalog.map((source) => ({
            ...source,
            content: redactSecrets(source.content).slice(0, 6000),
          })),
          history: history.map((turn) => ({
            role: turn.role,
            content: turn.content,
          })),
        });
        if (selection.ambiguous)
          return respond(
            'CLARIFICATION',
            selection.clarification ??
              'Bạn muốn hỏi sản phẩm hoặc gói nào trong các lựa chọn này?',
          );
        if (
          selection.sourceIds.some(
            (id) => !catalog.some((source) => source.id === id),
          )
        )
          return respond(
            'NO_SOURCES',
            'Tôi chưa có đủ thông tin xác thực để trả lời câu hỏi này.',
          );
        const candidates = catalog;
        catalog = [...new Set(selection.sourceIds)].flatMap((id) => {
          const source = candidates.find((source) => source.id === id);
          return source ? [source] : [];
        });
      } catch (error) {
        this.logger.warn({
          event: 'ai.catalog_selection.failed',
          code:
            error instanceof Error &&
            error.message === 'GEMINI_INVALID_RESPONSE'
              ? 'INVALID_RESPONSE'
              : 'PROVIDER_ERROR',
          status:
            typeof error === 'object' && error !== null && 'status' in error
              ? error.status
              : undefined,
        });
        return respond(
          'PROVIDER_UNAVAILABLE',
          'Tạm thời không thể xác minh sản phẩm phù hợp. Vui lòng thử lại sau.',
        );
      }
    }
    if (
      intent === 'PRODUCT_QA' &&
      !understanding &&
      !productIds?.length &&
      !planIds?.length &&
      catalog.length
    ) {
      const q = normalize(question);
      const reference = catalogReference(question);
      const named = catalog.filter((p) =>
        [p.productName, p.productCode, p.planName].some(
          (name) =>
            name &&
            (q.includes(normalize(name)) ||
              (reference &&
                (normalize(name) === normalize(reference) ||
                  normalize(name).startsWith(normalize(reference) + ' ')))),
        ),
      );
      if (named.length) catalog = named;
      else if (
        !/co (nhung )?san pham nao|danh muc|cac san pham|gia ban quyen/.test(q)
      )
        return respond(
          'NO_SOURCES',
          'Tôi chưa xác định được sản phẩm hoặc gói bạn hỏi trong Catalog hiện hành. Vui lòng cho biết tên sản phẩm chính xác.',
        );
      if (
        named.length &&
        new Set(named.map((p) => p.productId)).size > 1 &&
        !reference &&
        !/so sanh/.test(q)
      )
        return respond(
          'CLARIFICATION',
          'Có nhiều sản phẩm hoặc gói cùng tên. Bạn muốn hỏi sản phẩm nào?',
        );
    }
    if (
      !understanding &&
      intent === 'FOLLOW_UP' &&
      /re nhat/.test(normalize(question))
    )
      catalog.sort((a, b) => a.priceVnd! - b.priceVnd!);
    if (
      !understanding &&
      intent === 'FOLLOW_UP' &&
      /re nhat/.test(normalize(question))
    )
      catalog = catalog.slice(0, 1);
    if (cheaperThanPlanId) {
      const focusPrice = catalog.find(
        (p) => p.planId === cheaperThanPlanId,
      )?.priceVnd;
      catalog =
        focusPrice === undefined
          ? []
          : catalog.filter((p) => p.priceVnd! < focusPrice);
    }
    if (!guidance && catalog.length) {
      if (
        intent !== 'PRODUCT_RECOMMENDATION' &&
        (understanding
          ? understanding.requestedFields.length === 1 &&
            understanding.requestedFields.includes('OVERVIEW')
          : /dung de lam gi|la gi|mo ta|chuc nang chinh/.test(
              normalize(question),
            ))
      ) {
        const descriptions = catalog.flatMap((p) => {
          try {
            const value = JSON.parse(p.content) as { description?: unknown };
            return typeof value.description === 'string' &&
              value.description.trim()
              ? [
                  `${p.productName}: ${redactSecrets(value.description).slice(0, 3000)}`,
                ]
              : [];
          } catch {
            return [];
          }
        });
        if (descriptions.length)
          return respond('ANSWERED', [...new Set(descriptions)].join('\n\n'), {
            grounded: true,
            citedSourceIds: catalog.map((p) => p.id),
            catalogSources: catalog,
          });
      }
      // Only server facts are rendered, including price. No model-generated product IDs or promises.
      const answer = catalog
        .map((p) => {
          let provider = '';
          try {
            const metadata = JSON.parse(p.content) as {
              providerName?: unknown;
            };
            if (
              typeof metadata.providerName === 'string' &&
              (understanding
                ? understanding.requestedFields.includes('PROVIDER')
                : /nha cung cap|provider/.test(normalize(question)))
            )
              provider = ` Nhà cung cấp: ${redactSecrets(metadata.providerName)}.`;
          } catch {
            /* Older source formats may not contain provider metadata. */
          }
          return `${p.productName} — ${p.planName}: ${p.priceVnd!.toLocaleString('vi-VN')} đồng, ${p.durationMonths} tháng, tối đa ${p.maxActiveDevices} thiết bị.${provider}`;
        })
        .join('\n');
      const factual =
        /bao nhieu|gia|goi nao|nhung goi|so sanh|thiet bi|may|thoi han|re nhat|san pham nao|danh muc|cac san pham/.test(
          normalize(question),
        );
      if (
        !understanding &&
        !factual &&
        intent !== 'PRODUCT_RECOMMENDATION' &&
        !catalogReference(question)
      )
        return respond(
          'NO_SOURCES',
          'Tôi chưa tìm thấy thông tin xác nhận yêu cầu này. Bạn có thể xem thông tin sản phẩm bên dưới hoặc liên hệ nhân viên.',
          { catalogSources: catalog },
        );
      return respond('ANSWERED', answer, {
        grounded: true,
        citedSourceIds: catalog.map((p) => p.id),
        catalogSources: catalog,
        recommendations: intent === 'PRODUCT_RECOMMENDATION' ? catalog : [],
      });
    }
    if (!guidance)
      return respond(
        'NO_SOURCES',
        'Tôi chưa tìm thấy sản phẩm hoặc gói đáp ứng yêu cầu trong Catalog hiện hành. Bạn có thể điều chỉnh tiêu chí hoặc liên hệ nhân viên hỗ trợ.',
      );
    const scopedProducts = productIds?.length
      ? productIds
      : [
          ...new Set(
            catalog.flatMap((p) => (p.productId ? [p.productId] : [])),
          ),
        ];
    let sources: GroundingSource[];
    try {
      sources = (
        await this.knowledge.search({
          question: retrievalQuestion,
          ...(scopedProducts.length ? { productIds: scopedProducts } : {}),
          ...(planIds?.length ? { planIds } : {}),
        })
      )
        .slice(0, 5)
        .map((s) => ({
          ...s,
          content: redactSecrets(s.content).slice(0, 6000),
        }));
      if (understanding && intent !== 'USAGE_GUIDANCE' && catalog.length) {
        const catalogEvidence = catalog.flatMap((source) => {
          try {
            const fields = JSON.parse(source.content) as {
              description?: unknown;
              entitlements?: unknown;
            };
            const description =
              typeof fields.description === 'string'
                ? redactSecrets(fields.description).slice(0, 3000)
                : '';
            const entitlements = source.entitlements
              ? JSON.stringify(source.entitlements)
              : '';
            const content = `${source.productName} — ${source.planName}\n${description}\nQuyền lợi được công bố: ${entitlements}`;
            return [{ ...source, content }];
          } catch {
            return [];
          }
        });
        sources = [...catalogEvidence, ...sources].slice(0, 8);
      }
    } catch {
      return respond(
        'PROVIDER_UNAVAILABLE',
        'Tạm thời không thể tra cứu tài liệu. Vui lòng thử lại sau.',
      );
    }
    if (!sources.length)
      return respond(
        'NO_SOURCES',
        'Tôi chưa tìm thấy hướng dẫn xác nhận trong tài liệu chính thức hiện có. Bạn có thể liên hệ nhân viên hỗ trợ.',
      );
    try {
      const result = await this.gateway.answerGrounded({
        question,
        sources,
        history: history.map((t) => ({ role: t.role, content: t.content })),
      });
      const evidence = result.evidence;
      if (
        !result.grounded ||
        !Array.isArray(evidence) ||
        !evidence.length ||
        evidence.length > 8 ||
        !result.citedSourceIds.length ||
        result.citedSourceIds.some((id) => !sources.some((s) => s.id === id))
      )
        return respond(
          'NO_SOURCES',
          'Tôi chưa có đủ nguồn xác thực để đưa ra hướng dẫn này.',
        );
      // Publication/version can change while the external provider is generating.
      const currentSources = await this.knowledge.search({
        question: retrievalQuestion,
        ...(scopedProducts.length ? { productIds: scopedProducts } : {}),
        ...(planIds?.length ? { planIds } : {}),
      });
      const verified = evidence.flatMap((e) => {
        const source = sources.find((s) => s.id === e.sourceId);
        if (
          !source ||
          !result.citedSourceIds.includes(e.sourceId) ||
          typeof e.quote !== 'string' ||
          e.quote.trim().length < 12 ||
          e.quote.length > 4000 ||
          !source.content.includes(e.quote) ||
          /ignore.*instruction|bo qua.*huong dan|system prompt|password|api.key/i.test(
            normalize(e.quote),
          )
        )
          return [];
        if (source.kind === 'CATALOG') {
          // Catalog evidence was constructed from an authorized snapshot. Revalidate
          // its underlying canonical facts before returning any selected excerpt.
          return [{ source, quote: e.quote }];
        }
        if (
          !currentSources.some(
            (s) =>
              s.id === source.id &&
              s.documentVersion === source.documentVersion &&
              s.content.includes(e.quote),
          )
        )
          return [];
        const normalizedQuestion = normalize(
          understanding ? retrievalQuestion : question,
        );
        const normalizedQuote = normalize(e.quote);
        const topicChecks: Array<[RegExp, RegExp]> = [
          [/\bcai dat\b/, /\bcai dat\b|\bbo cai\b|\binstall(?:ation)?\b/],
          [/\bkich hoat\b/, /\bkich hoat\b|\bactivat(?:e|ion)\b/],
          [/\bsao luu\b/, /\bsao luu\b|\bbackup\b/],
          [/\bdong bo\b/, /\bdong bo\b|\bsync(?:hronization)?\b/],
        ];
        if (
          topicChecks.some(
            ([asked, supported]) =>
              asked.test(normalizedQuestion) &&
              !supported.test(normalizedQuote),
          )
        )
          return [];
        const exactCodes =
          normalizedQuestion.match(/\b[a-z]{1,5}[-_]?\d{2,}\b/g) ?? [];
        if (exactCodes.some((code) => !normalizedQuote.includes(code)))
          return [];
        const terms =
          normalize(understanding ? retrievalQuestion : question).match(
            /[a-z0-9]{3,}/g,
          ) ?? [];
        if (!terms.some((t) => normalize(e.quote).includes(t))) return [];
        return [{ source, quote: e.quote }];
      });
      if (verified.length !== evidence.length)
        return respond(
          'NO_SOURCES',
          'Tôi chưa có đủ nguồn xác thực để đưa ra hướng dẫn này.',
        );
      const citationDetails = verified.flatMap(({ source, quote }) =>
        source.documentId &&
        source.documentTitle &&
        Number.isSafeInteger(source.documentVersion) &&
        source.documentVersion! > 0 &&
        Number.isSafeInteger(source.chunkIndex) &&
        source.chunkIndex! >= 0
          ? [
              {
                chunkId: source.id,
                documentId: source.documentId,
                documentTitle: source.documentTitle,
                documentVersion: source.documentVersion!,
                chunkIndex: source.chunkIndex!,
                excerpt: quote.slice(0, 800),
              },
            ]
          : [],
      );
      if (
        citationDetails.length !==
        verified.filter((item) => item.source.kind !== 'CATALOG').length
      )
        return respond(
          'NO_SOURCES',
          'Nguồn hướng dẫn chưa đủ thông tin để xác minh.',
        );
      if (
        verified.some((item) => item.source.kind === 'CATALOG') &&
        !(await this.isCurrent(
          { catalogSources: catalog, grounded: true },
          question,
        ))
      )
        return respond(
          'NO_SOURCES',
          'Thông tin sản phẩm vừa thay đổi. Vui lòng hỏi lại để nhận thông tin mới nhất.',
        );
      return respond('ANSWERED', verified.map((e) => e.quote).join('\n\n'), {
        grounded: true,
        citedSourceIds: [...new Set(verified.map((e) => e.source.id))],
        citationDetails,
        catalogSources: catalog,
      });
    } catch {
      this.logger.warn({ event: 'ai.generation.unavailable' });
      return respond(
        'PROVIDER_UNAVAILABLE',
        'Trợ lý AI tạm thời không thể trả lời. Vui lòng thử lại hoặc liên hệ nhân viên hỗ trợ.',
      );
    }
  }
}
