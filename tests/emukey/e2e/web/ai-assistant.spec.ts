import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";

test.use({ screenshot: "off", video: "off", trace: "off" });

// UI boundary verification only. Every API response is a deterministic fixture;
// these tests do not claim real retrieval, Gemini, or backend integration works.
test.describe("AI assistant — mocked API UI", () => {
  const sessionId = "11111111-1111-4111-8111-111111111111";
  const conversationId = "22222222-2222-4222-8222-222222222222";
  const source = {
    id: "fixture-catalog",
    kind: "CATALOG",
    content: JSON.stringify({
      productId: "33333333-3333-4333-8333-333333333333",
      planId: "44444444-4444-4444-8444-444444444444",
      hashInput: "internal-catalog-hash-input",
      description: "Phù hợp nhóm nhỏ cần báo cáo.",
    }),
    productId: "class-product",
    productCode: "CLASS",
    productName: "Quản lý lớp học",
    planId: "class-plan",
    planName: "Gói nhóm",
    priceVnd: 150000,
    maxActiveDevices: 3,
    durationMonths: 12,
    entitlements: { analytics: true },
  };
  const citation = {
    documentId: "installation-guide",
    documentTitle: "Hướng dẫn cài đặt",
    documentVersion: 1,
    chunkId: "guide-chunk",
    chunkIndex: 0,
    excerpt: "Tải bộ cài từ trang sản phẩm.",
  };
  const answer = (outcome = "ANSWERED") => ({
    answer: "Gói nhóm hỗ trợ 3 thiết bị trong 12 tháng.",
    outcome,
    intent: "PRODUCT_QA",
    grounded: true,
    citedSourceIds: [source.id],
    citationDetails: [citation],
    catalogSources: [source],
    recommendations: [source],
  });

  async function fixture(page: Page, role = "GUEST") {
    const state = {
      asks: [] as {
        path: string;
        body: { question: string; clientMessageId: string; sessionId?: string };
      }[],
      support: [] as { reason: string }[],
      creates: 0,
      expired: false,
      failNext: false,
      outcome: "ANSWERED",
      status: "AI_ACTIVE",
      history: [] as Record<string, unknown>[],
    };
    const conversation = () => ({
      id: conversationId,
      status: state.status,
      customerUserId: "fixture-buyer",
      assignedSupportUserId: null,
      contextType: "GENERAL",
      contextId: null,
      title: "Tư vấn sản phẩm",
    });
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace("/api/v1", "");
      if (path === "/auth/refresh")
        return role === "GUEST"
          ? route.fulfill({
              status: 401,
              json: { error: { code: "UNAUTHORIZED" } },
            })
          : route.fulfill({
              json: {
                accessToken: "mocked-ui-token",
                user: {
                  id: "fixture-buyer",
                  role,
                  displayName: "Fixture Buyer",
                  email: "buyer@example.test",
                  status: "ACTIVE",
                },
              },
            });
      if (path === "/public/assistant/ask" || path.endsWith("/ai-ask")) {
        const body = request.postDataJSON();
        state.asks.push({ path, body });
        if (state.expired && body.sessionId)
          return route.fulfill({
            status: 404,
            json: { error: { code: "SESSION_NOT_FOUND" } },
          });
        if (state.failNext) {
          state.failNext = false;
          return route.fulfill({
            status: 503,
            json: { error: { code: "UNAVAILABLE" } },
          });
        }
        const result = answer(state.outcome);
        if (path.endsWith("/ai-ask")) {
          state.history.push(
            {
              id: body.clientMessageId,
              conversationId,
              clientMessageId: body.clientMessageId,
              senderType: "CUSTOMER",
              serverSequence: state.history.length + 1,
              content: body.question,
            },
            {
              ...result,
              id: `${body.clientMessageId}-ai`,
              conversationId,
              clientMessageId: "server-derived-answer-id",
              senderType: "AI",
              serverSequence: state.history.length + 2,
              content: result.answer,
            },
          );
        }
        return route.fulfill({ json: { ...result, sessionId } });
      }
      if (path === "/conversations" && request.method() === "POST") {
        state.creates++;
        return route.fulfill({ status: 201, json: conversation() });
      }
      if (path.endsWith("/request-support")) {
        state.support.push(request.postDataJSON());
        state.status = "WAITING_SUPPORT";
        return route.fulfill({ json: conversation() });
      }
      if (path.endsWith("/messages"))
        return route.fulfill({ json: state.history });
      if (path === `/conversations/${conversationId}`)
        return route.fulfill({ json: conversation() });
      if (path === "/notifications")
        return route.fulfill({
          json: { items: [], unreadCount: 0, nextCursor: null },
        });
      return route.fulfill({ json: [] });
    });
    return state;
  }

  async function open(page: Page) {
    await page.getByRole("button", { name: "Mở trợ lý AI" }).click();
    await expect(
      page.getByRole("textbox", { name: "Câu hỏi cho trợ lý AI" }),
    ).toBeEnabled();
    return page.getByRole("dialog", { name: "Trợ lý AI EmuKey" });
  }
  async function send(page: Page, question: string) {
    await page
      .getByRole("textbox", { name: "Câu hỏi cho trợ lý AI" })
      .fill(question);
    await page.getByRole("button", { name: "Gửi câu hỏi" }).click();
  }

  for (const { width, height } of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    test(`guest conversation, sources and responsive layout at ${width}px (mocked)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const state = await fixture(page);
      await page.goto("/products");
      const panel = await open(page);
      await send(page, "Tư vấn gói cho ba thiết bị");
      await expect(
        panel.getByText(answer().answer, { exact: true }),
      ).toHaveCount(1);
      await expect(
        panel.getByRole("link", { name: `Xem nguồn: ${source.productName}` }),
      ).toHaveAttribute("href", "/products/CLASS");
      await expect(
        panel.getByRole("link", { name: /Hướng dẫn cài đặt/ }),
      ).toHaveAttribute("href", "/help/installation-guide");
      await expect(panel.getByText(/^150.000\s₫$/)).toHaveCount(0);
      await expect(
        panel.getByText(citation.excerpt, { exact: true }),
      ).toHaveCount(0);
      await expect(panel.getByRole("log")).not.toContainText(source.content);
      await expect(panel.getByRole("log")).not.toContainText(
        "33333333-3333-4333-8333-333333333333",
      );
      await expect(panel.getByRole("log")).not.toContainText(
        "internal-catalog-hash-input",
      );
      await expect(panel.getByText(/Gói đề xuất:/)).toHaveCount(0);
      await expect(
        panel.getByRole("link", { name: "Liên hệ nhân viên hỗ trợ" }),
      ).toHaveCount(0);
      const bounds = await panel.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const composer = element
          .querySelector("textarea")!
          .getBoundingClientRect();
        const log = element.querySelector("[role=log]")!;
        return {
          x: box.x,
          y: box.y,
          right: box.right,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
          composerRight: composer.right,
          composerBottom: composer.bottom,
          overflow: element.scrollWidth > element.clientWidth,
          scrollable: getComputedStyle(log).overflowY,
        };
      });
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(width);
      expect(bounds.bottom).toBeLessThanOrEqual(height);
      expect(bounds.composerRight).toBeLessThanOrEqual(bounds.right);
      expect(bounds.composerBottom).toBeLessThanOrEqual(bounds.bottom);
      expect(bounds.overflow).toBe(false);
      expect(bounds.scrollable).toBe("auto");
      if (width > 600) {
        expect(bounds.width).toBe(400);
        expect(bounds.height).toBe(560);
      }
      await panel.getByRole("log").evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.screenshot({
        path: join(tmpdir(), `emukey-ai-mocked-${width}.png`),
      });
      await send(page, "Gói đó có báo cáo không?");
      await expect.poll(() => state.asks.length).toBe(2);
      expect(state.asks[0].body.sessionId).toBeUndefined();
      expect(state.asks[1].body.sessionId).toBe(sessionId);
      await expect(
        panel.getByText(answer().answer, { exact: true }),
      ).toHaveCount(2);
      await page.reload();
      await open(page);
      await expect(
        page
          .getByRole("dialog")
          .getByText("Gói đó có báo cáo không?", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Hội thoại mới" }).click();
      await send(page, "Tư vấn một sản phẩm khác");
      await expect.poll(() => state.asks.length).toBe(3);
      expect(state.asks[2].body.sessionId).toBeUndefined();
      await expect(
        page.getByRole("textbox", { name: "Câu hỏi cho trợ lý AI" }),
      ).toBeEnabled();
      await page
        .getByRole("textbox", { name: "Câu hỏi cho trợ lý AI" })
        .press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Mở trợ lý AI" }),
      ).toBeFocused();
      expect(errors).toEqual([]);
    });
  }

  test("retry idempotency and expired guest session require explicit actions (mocked)", async ({
    page,
  }) => {
    const state = await fixture(page);
    state.failNext = true;
    await page.goto("/products");
    const panel = await open(page);
    await page
      .getByRole("textbox", { name: "Câu hỏi cho trợ lý AI" })
      .fill("So sánh gói");
    await panel.locator("form").evaluate((form) => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await expect(panel.getByRole("alert")).toBeVisible();
    expect(state.asks).toHaveLength(1);
    await panel.getByRole("button", { name: "Thử gửi lại" }).click();
    await expect(
      panel.getByText(answer().answer, { exact: true }),
    ).toBeVisible();
    expect(state.asks[1].body.clientMessageId).toBe(
      state.asks[0].body.clientMessageId,
    );
    state.expired = true;
    await send(page, "Câu hỏi tiếp theo");
    await expect(panel.getByRole("alert")).toContainText("đã hết hạn");
    await expect(panel.getByRole("textbox")).toBeDisabled();
    expect(state.asks).toHaveLength(3);
    await panel.getByRole("button", { name: "Bắt đầu hội thoại mới" }).click();
    await send(page, "Bắt đầu lại");
    await expect.poll(() => state.asks.length).toBe(4);
    expect(state.asks[3].body.sessionId).toBeUndefined();
    expect(state.asks[3].body.clientMessageId).not.toBe(
      state.asks[2].body.clientMessageId,
    );
  });

  test("customer restores history and hands off only after clicking support (mocked)", async ({
    page,
  }) => {
    const state = await fixture(page, "CUSTOMER");
    state.outcome = "SUPPORT_REQUIRED";
    await page.goto("/products");
    let panel = await open(page);
    await send(page, "Tôi cần kiểm tra đơn hàng");
    await expect(
      panel.getByRole("button", { name: "Liên hệ nhân viên hỗ trợ" }),
    ).toBeVisible();
    expect(state.creates).toBe(1);
    expect(state.support).toHaveLength(0);
    await expect(panel.getByText(answer().answer, { exact: true })).toHaveCount(
      1,
    );
    await page.reload();
    panel = await open(page);
    await expect(
      panel.getByText("Tôi cần kiểm tra đơn hàng", { exact: true }),
    ).toBeVisible();
    await expect(
      panel.getByRole("link", { name: `Xem nguồn: ${source.productName}` }),
    ).toHaveCount(1);
    await panel
      .getByRole("button", { name: "Liên hệ nhân viên hỗ trợ" })
      .click();
    await expect(
      panel.getByText("Đã chuyển sang nhân viên hỗ trợ.", { exact: true }),
    ).toBeVisible();
    expect(state.support).toHaveLength(1);
    expect(state.support[0].reason.trim()).not.toBe("");
    await expect(panel.getByRole("textbox")).toBeDisabled();
    await expect(
      panel.getByRole("link", { name: "Mở hội thoại hỗ trợ" }),
    ).toHaveAttribute(
      "href",
      `/buyer/support?conversationId=${conversationId}`,
    );
    await page.reload();
    await page.getByRole("button", { name: "Mở trợ lý AI" }).click();
    await expect(page.getByRole("dialog").getByRole("textbox")).toBeDisabled();
    expect(state.asks).toHaveLength(1);
  });
});
