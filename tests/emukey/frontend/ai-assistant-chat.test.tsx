import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthProvider,
  type AuthUser,
} from "../../../EmuKey/frontend/src/application/auth/authContext";
import { AiAssistantLauncher } from "../../../EmuKey/frontend/src/presentation/components/AiAssistantLauncher";

const sessionId = "11111111-1111-4111-8111-111111111111";
const customer = {
  id: "buyer",
  role: "CUSTOMER",
  email: "buyer@example.test",
  displayName: "Buyer",
  status: "ACTIVE",
};
const answer = (outcome = "ANSWERED") => ({
  answer: "Câu trả lời có căn cứ",
  outcome,
  intent: "PRODUCT_QA",
  grounded: true,
  citedSourceIds: [],
  citationDetails: [],
  catalogSources: [],
  recommendations: [],
  sessionId,
});
let calls: { path: string; body: Record<string, unknown> }[];
let respond: (
  path: string,
  body: Record<string, unknown>,
) => Response | Promise<Response>;
function mount(user: AuthUser | null = null) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <AuthProvider skipBootstrap initialUser={user}>
        <MemoryRouter>
          <AiAssistantLauncher />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Mở trợ lý AI" }));
  return { ...view, client };
}
function send(text = "Tư vấn sản phẩm") {
  fireEvent.change(
    screen.getByRole("textbox", { name: "Câu hỏi cho trợ lý AI" }),
    { target: { value: text } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
}
beforeEach(() => {
  sessionStorage.clear();
  calls = [];
  respond = () => Response.json(answer());
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url).replace("/api/v1", "");
      const body = JSON.parse(String(init?.body ?? "{}"));
      calls.push({ path, body });
      return respond(path, body);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AI assistant chat", () => {
  it('keeps guest proof and unlocks the composer after a failed history link', async () => {
    const saved = JSON.stringify({ sessionId, sessionToken: 'a'.repeat(64), messages: [{ id: 'guest-message', senderType: 'CUSTOMER', content: 'Private guest history' }] });
    sessionStorage.setItem('emukey-ai-guest-session:guest', saved);
    let attempts = 0;
    respond = path => {
      if (path === '/conversations/link-guest-history') {
        attempts++;
        return attempts === 1 ? Response.json({}, { status: 503 }) : Response.json({ id: 'linked-conversation', status: 'AI_ACTIVE' });
      }
      return path.includes('/messages') ? Response.json([]) : Response.json({ status: 'AI_ACTIVE' });
    };
    mount(customer as AuthUser);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsent question' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu lịch sử khách' }));
    await screen.findByRole('alert');
    expect(sessionStorage.getItem('emukey-ai-guest-session:guest')).toBe(saved);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(false);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Unsent question');
    // The loading icon can remain during its exit animation in jsdom.
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận lưu lịch sử khách/ }));
    await waitFor(() => expect(sessionStorage.getItem('emukey-ai-conversation:buyer')).toBe('linked-conversation'));
    expect(attempts).toBe(2);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('reuses a customer creation intent when its response is lost', async () => {
    let creations = 0;
    respond = path => {
      if (path === '/conversations') {
        creations++;
        return creations === 1
          ? Promise.reject(new TypeError('Response lost after server commit'))
          : Response.json({ id: sessionId, status: 'AI_ACTIVE' });
      }
      if (path.includes('/messages')) return Response.json([]);
      if (path.endsWith('/ai-ask')) return Response.json(answer());
      return Response.json({ id: sessionId, status: 'AI_ACTIVE' });
    };
    mount(customer as AuthUser);
    send('Question after a lost creation response');
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Thử gửi lại' }));
    await screen.findByText('Câu trả lời có căn cứ');
    const requests = calls.filter(call => call.path === '/conversations');
    expect(requests).toHaveLength(2);
    expect(requests[0].body.clientRequestId).toEqual(expect.any(String));
    expect(requests[1].body.clientRequestId).toBe(requests[0].body.clientRequestId);
  });

  it('locks chat actions while guest history is being linked', async () => {
    sessionStorage.setItem('emukey-ai-guest-session:guest', JSON.stringify({ sessionId, sessionToken: 'a'.repeat(64), messages: [{ id: 'guest-message', senderType: 'CUSTOMER', content: 'Private guest history' }] }));
    let finish!: (value: Response) => void;
    respond = path => path === '/conversations/link-guest-history'
      ? new Promise<Response>(resolve => { finish = resolve; })
      : path.includes('/messages') ? Response.json([]) : Response.json({ id: 'other', status: 'AI_ACTIVE' });
    mount(customer as AuthUser);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Unsent question' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu lịch sử khách' }));
    await waitFor(() => expect(finish).toBeDefined());
    expect((screen.getByRole('button', { name: 'Hội thoại mới' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Gửi câu hỏi' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole('textbox').closest('form')!);
    expect(calls.filter(call => call.path === '/conversations')).toHaveLength(0);
    await act(async () => { finish(Response.json({ id: 'linked-conversation', status: 'AI_ACTIVE' })); });
    await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(false));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Unsent question');
  });

  it('ignores a guest link response after its account session has unmounted', async () => {
    const saved = JSON.stringify({ sessionId, sessionToken: 'a'.repeat(64), messages: [{ id: 'guest-message', senderType: 'CUSTOMER', content: 'Private guest history' }] });
    sessionStorage.setItem('emukey-ai-guest-session:guest', saved);
    let finish!: (value: Response) => void;
    respond = () => new Promise<Response>(resolve => { finish = resolve; });
    const view = mount(customer as AuthUser);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu lịch sử khách' }));
    await waitFor(() => expect(finish).toBeDefined());
    view.unmount();
    await act(async () => { finish(Response.json({ id: 'old-account-conversation', status: 'AI_ACTIVE' })); });
    expect(sessionStorage.getItem('emukey-ai-guest-session:guest')).toBe(saved);
    expect(sessionStorage.getItem('emukey-ai-conversation:buyer')).toBeNull();
  });

  it('saves guest history only after explicit confirmation by the signed-in customer', async () => {
    const sessionToken = 'a'.repeat(64);
    sessionStorage.setItem('emukey-ai-guest-session:guest', JSON.stringify({ sessionId, sessionToken, messages: [{ id: 'guest-message', senderType: 'CUSTOMER', content: 'Guest private history' }] }));
    respond = path => path === '/conversations/link-guest-history'
      ? Response.json({ id: 'linked-conversation', status: 'AI_ACTIVE' })
      : path.includes('/messages') ? Response.json([]) : Response.json({ status: 'AI_ACTIVE' });
    mount(customer as AuthUser);
    expect(calls.filter(call => call.path === '/conversations/link-guest-history')).toHaveLength(0);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu lịch sử khách' })));
    await waitFor(() => expect(sessionStorage.getItem('emukey-ai-conversation:buyer')).toBe('linked-conversation'));
    expect(calls.find(call => call.path === '/conversations/link-guest-history')?.body).toEqual({ sessionId, sessionToken, accepted: true });
    expect(sessionStorage.getItem('emukey-ai-guest-session:guest')).toBeNull();
  });
  it.each([null, customer])(
    "retries an in-progress AI request with the same intent for %j",
    async (user) => {
      let attempts = 0;
      respond = (path) => {
        if (path.endsWith("/messages")) return Response.json([]);
        if (path.endsWith("/ask") || path.endsWith("/ai-ask")) {
          attempts++;
          return attempts === 1
            ? Response.json(
                { error: { code: "AI_REQUEST_IN_PROGRESS" } },
                { status: 409 },
              )
            : Response.json(answer());
        }
        return Response.json({ id: sessionId, status: "AI_ACTIVE" });
      };
      mount(user);
      send("Câu hỏi đang xử lý");
      await screen.findByRole("alert");
      await waitFor(() =>
        expect(
          (screen.getByRole("textbox") as HTMLTextAreaElement).disabled,
        ).toBe(false),
      );
      fireEvent.click(screen.getByRole("button", { name: "Thử gửi lại" }));
      await screen.findByText("Câu trả lời có căn cứ");
      const asks = calls.filter(
        (call) => call.path.endsWith("/ask") || call.path.endsWith("/ai-ask"),
      );
      expect(asks).toHaveLength(2);
      expect(asks[1].body.clientMessageId).toBe(asks[0].body.clientMessageId);
      expect(screen.getAllByText("Câu hỏi đang xử lý")).toHaveLength(1);
    },
  );

  it.each([
    "CONVERSATION_STATE_INVALID",
    "CONVERSATION_CLOSED",
    "CONVERSATION_ACCESS_DENIED",
    "CONVERSATION_NOT_FOUND",
  ])("blocks a terminal conversation conflict %s", async (code) => {
    respond = () => Response.json({ error: { code } }, { status: 409 });
    mount();
    send();
    await screen.findByRole("alert");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(
      true,
    );
    expect(screen.queryByRole("button", { name: "Thử gửi lại" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Bắt đầu hội thoại mới" }),
    ).toBeTruthy();
  });

  it("invalidates a stale source replay without blocking new questions or reusing its intent", async () => {
    respond = () => Response.json({}, { status: 503 });
    mount();
    send("Câu hỏi có nguồn thay đổi");
    await screen.findByRole("alert");
    respond = () =>
      Response.json({ error: { code: "AI_SOURCES_CHANGED" } }, { status: 409 });
    fireEvent.click(screen.getByRole("button", { name: "Thử gửi lại" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Nguồn tham khảo đã thay đổi",
      ),
    );
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(
      false,
    );
    expect(screen.queryByRole("button", { name: "Thử gửi lại" })).toBeNull();
    respond = () => Response.json(answer());
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    await screen.findByText("Câu trả lời có căn cứ");
    expect(calls[1].body.clientMessageId).toBe(calls[0].body.clientMessageId);
    expect(calls[2].body.clientMessageId).not.toBe(
      calls[1].body.clientMessageId,
    );
    expect(calls[2].body.question).toBe("Câu hỏi có nguồn thay đổi");
  });

  it("keeps an unrecognized 409 retryable instead of treating it as a closed conversation", async () => {
    respond = () =>
      Response.json({ error: { code: "OTHER_AI_CONFLICT" } }, { status: 409 });
    mount();
    send();
    await screen.findByRole("alert");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(
      false,
    );
    respond = () => Response.json(answer());
    fireEvent.click(screen.getByRole("button", { name: "Thử gửi lại" }));
    await screen.findByText("Câu trả lời có căn cứ");
    expect(calls[1].body.clientMessageId).toBe(calls[0].body.clientMessageId);
  });

  it("retries public provider-unavailable responses without duplicating a turn or retaining failed answers", async () => {
    respond = () =>
      Response.json({
        ...answer("PROVIDER_UNAVAILABLE"),
        answer: "AI tạm thời gián đoạn",
      });
    mount();
    send("Câu hỏi cần thử lại");
    await screen.findByText("AI tạm thời gián đoạn");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Câu hỏi cần thử lại",
    );
    fireEvent.click(screen.getByRole("button", { name: "Thử gửi lại" }));
    await waitFor(() => expect(calls).toHaveLength(2));
    await waitFor(() =>
      expect(
        (screen.getByRole("textbox") as HTMLTextAreaElement).disabled,
      ).toBe(false),
    );
    expect(screen.getAllByText("AI tạm thời gián đoạn")).toHaveLength(1);
    expect(
      screen.getAllByText("Câu hỏi cần thử lại", { selector: "p" }),
    ).toHaveLength(1);
    respond = () => Response.json(answer());
    fireEvent.click(screen.getByRole("button", { name: "Thử gửi lại" }));
    await screen.findByText("Câu trả lời có căn cứ");
    expect(calls).toHaveLength(3);
    expect(calls[1].body.sessionId).toBe(sessionId);
    expect(calls[1].body.clientMessageId).toBe(calls[0].body.clientMessageId);
    expect(calls[2].body.clientMessageId).toBe(calls[0].body.clientMessageId);
    expect(
      screen.getAllByText("Câu hỏi cần thử lại", { selector: "p" }),
    ).toHaveLength(1);
    expect(screen.getAllByText("Câu trả lời có căn cứ")).toHaveLength(1);
    expect(screen.queryByText("AI tạm thời gián đoạn")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    const saved = JSON.parse(
      sessionStorage.getItem("emukey-ai-guest-session:guest")!,
    );
    expect(saved.messages).toHaveLength(2);
  });

  it("removes an unavailable reply invalidated by changed sources and submits a fresh intent in the same session", async () => {
    respond = () =>
      Response.json({
        ...answer("PROVIDER_UNAVAILABLE"),
        answer: "Phản hồi không còn hợp lệ",
      });
    mount();
    send("Kiểm tra nguồn mới");
    await screen.findByText("Phản hồi không còn hợp lệ");
    respond = () =>
      Response.json({ error: { code: "AI_SOURCES_CHANGED" } }, { status: 409 });
    fireEvent.click(screen.getByRole("button", { name: "Thử gửi lại" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Nguồn tham khảo đã thay đổi",
      ),
    );
    expect(screen.queryByText("Phản hồi không còn hợp lệ")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Liên hệ nhân viên hỗ trợ" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Thử gửi lại" })).toBeNull();
    const saved = JSON.parse(
      sessionStorage.getItem("emukey-ai-guest-session:guest")!,
    );
    expect(saved.sessionId).toBe(sessionId);
    expect(
      saved.messages.every(
        (message: { senderType: string }) => message.senderType !== "AI",
      ),
    ).toBe(true);
    respond = () => Response.json(answer());
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    await screen.findByText("Câu trả lời có căn cứ");
    expect(calls[1].body.clientMessageId).toBe(calls[0].body.clientMessageId);
    expect(calls[2].body.clientMessageId).not.toBe(
      calls[1].body.clientMessageId,
    );
    expect(calls[2].body.sessionId).toBe(sessionId);
  });

  it("lets guests chat, remembers only the server session, restores history and starts fresh", async () => {
    const view = mount();
    send();
    expect(await screen.findByText("Câu trả lời có căn cứ")).toBeTruthy();
    expect(calls[0].path).toBe("/public/assistant/ask");
    expect(calls[0].body.sessionId).toBeUndefined();
    send("Gói đó hỗ trợ mấy máy?");
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].body.sessionId).toBe(sessionId);
    await waitFor(() =>
      expect(screen.getAllByText("Câu trả lời có căn cứ")).toHaveLength(2),
    );
    view.unmount();
    mount();
    expect(screen.getByText("Gói đó hỗ trợ mấy máy?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hội thoại mới" }));
    send("Một yêu cầu khác");
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2].body.sessionId).toBeUndefined();
  });

  it("reuses the failed intent UUID on retry, blocks duplicate submits, and changes UUID after success", async () => {
    let release: (value: Response) => void = () => undefined;
    respond = () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      });
    mount();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Tư vấn sản phẩm" },
    });
    const form = screen
      .getByRole("button", { name: "Gửi câu hỏi" })
      .closest("form")!;
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    release(Response.json({ error: { code: "UNAVAILABLE" } }, { status: 503 }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    respond = () => Response.json(answer());
    fireEvent.click(screen.getByRole("button", { name: "Thử gửi lại" }));
    expect(await screen.findByText("Câu trả lời có căn cứ")).toBeTruthy();
    expect(calls[1].body.clientMessageId).toBe(calls[0].body.clientMessageId);
    send();
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2].body.clientMessageId).not.toBe(
      calls[1].body.clientMessageId,
    );
  });

  it("keeps Shift+Enter and IME Enter as input and supports closing by Escape", async () => {
    mount();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hỏi" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true, keyCode: 229 });
    expect(calls).toHaveLength(0);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(await screen.findByText("Câu trả lời có căn cứ")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Mở trợ lý AI" }),
    );
  });

  it.each([
    "ANSWERED",
    "CLARIFICATION",
    "OUT_OF_SCOPE",
    "SUPPORT_REQUIRED",
    "NO_SOURCES",
    "PROVIDER_UNAVAILABLE",
  ])("shows guest support only for eligible outcome %s", async (outcome) => {
    respond = () => Response.json(answer(outcome));
    mount();
    send();
    await screen.findByText("Câu trả lời có căn cứ");
    const link = screen.queryByRole("link", {
      name: "Liên hệ nhân viên hỗ trợ",
    });
    expect(Boolean(link)).toBe(
      ["SUPPORT_REQUIRED", "NO_SOURCES", "PROVIDER_UNAVAILABLE"].includes(
        outcome,
      ),
    );
    if (link) expect(link.getAttribute("href")).toBe("/auth");
  });

  it.each(["recommendations", "catalogSources"])(
    "renders only answer text and source buttons for %s",
    async (field) => {
      const productId = "33333333-3333-4333-8333-333333333333";
      const planId = "44444444-4444-4444-8444-444444444444";
      const content = JSON.stringify({
        productId,
        planId,
        hashInput: "internal-catalog-hash-input",
        description: "Mô tả kỹ thuật trong dữ liệu nguồn",
        priceVnd: 999999,
      });
      respond = () =>
        Response.json({
          ...answer(),
          [field]: [
            {
              id: "catalog",
              kind: "CATALOG",
              content,
              productId,
              productCode: "CLASS/ONE",
              productName: "Quản lý lớp học",
              planId,
              planName: "Nhóm",
              priceVnd: 150000,
              maxActiveDevices: 3,
              durationMonths: 12,
              entitlements: { analytics: true },
            },
          ],
        });
      mount();
      send();
      await screen.findByText("Câu trả lời có căn cứ");
      expect(
        screen
          .getByRole("link", { name: "Xem nguồn: Quản lý lớp học" })
          .getAttribute("href"),
      ).toBe("/products/CLASS%2FONE");
      const visibleText = screen.getByRole("log").textContent;
      for (const technical of [
        content,
        productId,
        planId,
        "hashInput",
        "internal-catalog-hash-input",
        "999999",
      ])
        expect(visibleText).not.toContain(technical);
      expect(screen.queryByText(/Gói đề xuất:/)).toBeNull();
      expect(screen.queryByText(/150.000/)).toBeNull();
      expect(screen.queryByText("Nhóm")).toBeNull();
      expect(screen.getByRole("log").querySelector(".emu-ai-card")).toBeNull();
    },
  );

  it("restores customer history and hands off only on an explicit click, disabling AI afterwards", async () => {
    sessionStorage.setItem("emukey-ai-conversation:buyer", sessionId);
    let handed = false;
    respond = (path) => {
      if (path.endsWith("/messages"))
        return Response.json([
          {
            id: "old",
            clientMessageId: "old-client",
            serverSequence: 1,
            senderType: "AI",
            content: "Lịch sử đã lưu",
          },
        ]);
      if (path.endsWith("/ai-ask"))
        return Response.json(answer("SUPPORT_REQUIRED"));
      if (path.endsWith("/request-support")) handed = true;
      return Response.json({
        id: sessionId,
        status: handed ? "WAITING_SUPPORT" : "AI_ACTIVE",
      });
    };
    mount(customer);
    await screen.findByText("Lịch sử đã lưu");
    send();
    await screen.findByText("Câu trả lời có căn cứ");
    expect(calls.some((c) => c.path.endsWith("/request-support"))).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Liên hệ nhân viên hỗ trợ" }),
    );
    await screen.findByText("Đã chuyển sang nhân viên hỗ trợ.");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(
      true,
    );
    expect(
      calls.find((c) => c.path.endsWith("/request-support"))?.body.reason,
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Mở hội thoại hỗ trợ" })
        .getAttribute("href"),
    ).toContain(sessionId);
  });

  it("isolates public chat for noncustomer accounts", async () => {
    sessionStorage.setItem(
      "emukey-ai-guest-session:guest",
      JSON.stringify({ sessionId, messages: [] }),
    );
    mount({ ...customer, role: "SYSTEM_ADMIN", id: "admin" });
    send();
    await screen.findByText("Câu trả lời có căn cứ");
    expect(calls[0].path).toBe("/public/assistant/ask");
    expect(calls[0].body.sessionId).toBeUndefined();
  });

  it("opens knowledge citations through the shared public help links", async () => {
    respond = () =>
      Response.json({
        ...answer(),
        citationDetails: [
          {
            documentId: "guide",
            documentTitle: "Hướng dẫn cài đặt",
            documentVersion: 1,
            chunkId: "chunk",
            chunkIndex: 0,
            excerpt: "Tải bộ cài chính thức.",
          },
        ],
      });
    mount();
    send();
    await screen.findByText("Câu trả lời có căn cứ");
    expect(
      screen
        .getByRole("link", { name: /Hướng dẫn cài đặt/ })
        .getAttribute("href"),
    ).toBe("/help/guide");
    const excerpt = screen.getByText("Tải bộ cài chính thức.");
    expect(excerpt.closest('details')?.hasAttribute('open')).toBe(false);
    expect(
      screen.getByRole("link", { name: "Xem nguồn: Hướng dẫn cài đặt" }),
    ).toBeTruthy();
  });

  it("uses a fresh UUID when the user edits a failed question", async () => {
    respond = () => Response.json({}, { status: 503 });
    mount();
    send("Câu hỏi đầu");
    await screen.findByRole("alert");
    respond = () => Response.json(answer());
    send("Câu hỏi đã chỉnh sửa");
    await screen.findByText("Câu trả lời có căn cứ");
    expect(calls[1].body.question).toBe("Câu hỏi đã chỉnh sửa");
    expect(calls[1].body.clientMessageId).not.toBe(
      calls[0].body.clientMessageId,
    );
  });

  it("requires an explicit new guest chat after an expired server session", async () => {
    sessionStorage.setItem(
      "emukey-ai-guest-session:guest",
      JSON.stringify({ sessionId, messages: [] }),
    );
    respond = () =>
      Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    mount();
    send();
    await screen.findByRole("alert");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(
      true,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].body.sessionId).toBe(sessionId);
    fireEvent.click(
      screen.getByRole("button", { name: "Bắt đầu hội thoại mới" }),
    );
    respond = () => Response.json(answer());
    send();
    await screen.findByText("Câu trả lời có căn cứ");
    expect(calls[1].body.sessionId).toBeUndefined();
    expect(calls[1].body.clientMessageId).not.toBe(
      calls[0].body.clientMessageId,
    );
  });

  it("reconciles server AI messages whose UUID differs from the submitted intent and restores catalog metadata", async () => {
    sessionStorage.setItem("emukey-ai-conversation:buyer", sessionId);
    let submitted: Record<string, unknown> | undefined;
    respond = (path, body) => {
      if (path.endsWith("/messages"))
        return Response.json(
          submitted
            ? [
                {
                  id: "user-message",
                  clientMessageId: submitted.clientMessageId,
                  serverSequence: 1,
                  senderType: "CUSTOMER",
                  content: submitted.question,
                },
                {
                  id: "server-answer",
                  clientMessageId: "server-derived-answer-uuid",
                  serverSequence: 2,
                  senderType: "AI",
                  content: "Câu trả lời có căn cứ",
                  outcome: "NO_SOURCES",
                  catalogSources: [],
                  recommendations: [],
                },
              ]
            : [],
        );
      if (path.endsWith("/ai-ask")) {
        submitted = body;
        return Response.json(answer("NO_SOURCES"));
      }
      return Response.json({ id: sessionId, status: "AI_ACTIVE" });
    };
    mount(customer);
    await waitFor(() =>
      expect(
        (screen.getByRole("textbox") as HTMLTextAreaElement).disabled,
      ).toBe(false),
    );
    send();
    await screen.findByText("Câu trả lời có căn cứ");
    await waitFor(() =>
      expect(
        calls.filter((c) => c.path.endsWith("/messages")).length,
      ).toBeGreaterThan(1),
    );
    await waitFor(() =>
      expect(screen.getAllByText("Câu trả lời có căn cứ")).toHaveLength(1),
    );
  });
});
