# EmuKey — Kế hoạch sửa toàn bộ vấn đề UI/UX

> **Dành cho người triển khai:** dùng skill `executing-plans`, triển khai tuần tự theo từng task và đánh dấu checkbox sau khi có bằng chứng kiểm thử. Không tự tạo commit, push, reset database hoặc gọi subagent.

**Goal:** xử lý đầy đủ **120 ID duy nhất** trong `EmuKey_UIUX_Issues.md`, xuyên suốt backend, frontend web và mobile. Checkpoint 105 đã thiếu AUTH-01–AUTH-15; ma trận mục 2 của báo cáo issue là nguồn trạng thái hiện tại. Giảm thao tác lặp và giữ kiểm soát dữ liệu/tài chính/bảo mật.

**Architecture:** mở rộng đúng module NestJS hiện có; PostgreSQL là nguồn dữ liệu nghiệp vụ, Redis/BullMQ phục vụ xử lý phụ trợ. Web và mobile dùng cùng hợp đồng API và bảng hành vi; giữ khả năng build độc lập của từng project, không tạo package dùng chung buộc các project phụ thuộc source của nhau.

**Tech Stack:** TypeScript; React/Vite/Ant Design/TanStack Query; NestJS/pg/PostgreSQL/Redis/BullMQ; React Native/Expo; Vitest/Supertest/Playwright/Jest/Maestro. Phiên bản lấy từ manifest/lockfile hiện có khi triển khai.

**Spec:** [EmuKey_UIUX_Issues.md](EmuKey_UIUX_Issues.md). Đối chiếu [nghiệp vụ](chuc_nang_toan_he_thong_ver2.0.md), [SQL baseline](sql_minimal.sql), [kế hoạch tổng](APP_IMPLEMENTATION_PLAN.md), [HDSD](HDSD.md).

**Vị trí chính thức:** file này ở thư mục gốc `D:/TLHT/KLTN/UY/`, theo vị trí người dùng đã chuyển. Không tạo lại bản kế hoạch trong `EmuKey/docs/`. Bổ sung lượt 2 tại mục 8–10; T00–T16 và 76 ID gốc được bảo toàn, T16 chạy cuối sau T17–T30; lượt 3 ngày 01/10/2026 nằm tại mục 11–12.

**Ngày lập:** 30/09/2026. **Trạng thái triển khai:** xem checkpoint 02/10/2026 ở cuối tài liệu. Docker/Testcontainers đã chạy được; Android và external provider vẫn chưa nghiệm thu. Các mục 13–16 lưu bằng chứng lịch sử, không thay thế trạng thái hiện tại trong ma trận issue.

## 13. Tiến độ và bằng chứng ngày 01/10/2026

### Bằng chứng bổ sung — batch 16:20

- Frontend: `lint`, `typecheck`, test **15 file / 88 test pass**.
- Mobile: `lint`, `typecheck`, test **4 suite / 12 test pass**.
- Backend: `lint`, `typecheck`, test **33 file / 158 test pass**. Assertion baseline tại `license-query.service.test.ts:109` đã được sửa.
- Contract fix: web gửi `clientMessageId` khi hỏi AI và `reason` khi chuyển hỗ trợ; test `frontend/test/assistance-contract.test.ts` **2 pass**.
- SUP-01: customer có CTA chuyển nhân viên; SUP-21/22: queue preview/release đã nối vào support console.
- AUTH-03: profile có flow đổi mật khẩu qua `PUT /auth/password`, logout local trong `finally`.
- AUTH-15: mobile login có lối vào forgot-password, không tiết lộ email tồn tại.
- SUP-10: mobile nav hiển thị unread notification count, polling 15 giây.
- SUP-12: public help có tìm kiếm cục bộ, không truy cập knowledge private.
- GBL-08: wildcard route có trang 404 riêng.


### Kết quả kiểm tra đã chạy

| Gate | Kết quả |
|---|---|
| Backend lint | **Pass** — baseline assertion `test/unit/license-query.service.test.ts:109` đã được sửa trong batch 16:20 |
| Backend typecheck | **Pass** |
| Backend test:unit | **Pass** — 33 file / 158 test |
| Backend build | **Pass** |
| Backend baseline:check | **Pass** — 35 capabilities, 18 tables |
| Backend db:verify:terms | **FAIL** — checker và migration lệch tên cột (PAY-08 chưa đóng) |
| Backend openapi:check | **BLOCKED** — env local `SEPAY_SANDBOX_RECEIPT_TIMING=true` khiến app boot fail |
| Frontend lint | **Pass** |
| Frontend typecheck | **Pass** |
| Frontend test | **Pass** — 14 file / 86 test |
| Frontend build | **Pass** |
| Mobile lint | **Pass** |
| Mobile typecheck | **Pass** |
| Mobile test | **Pass** — 4 file / 12 test |
| Mobile build | **Pass** |
| Mobile e2e:maestro | **BLOCKED** — thiếu thiết bị Android/Maestro |
| Backend integration (Testcontainers) | **BLOCKED** — không có Docker runtime |
| `git diff --check` | **Pass** — chỉ còn cảnh báo LF/CRLF của Git |

### ID có thay đổi mã nguồn kèm regression test

Danh sách ID được chia theo lớp hệ thống và ghi rõ test owner:

**Backend (11 ID trực tiếp; PAY-08 là ID đang mở sau khi thêm migration):**
- **NTF-01, NTF-02** — Notification DTO mapper → `test/unit/notification-contract.test.ts`
- **SUP-03, SUP-20, SUP-21, SUP-22** — system message, question persistence, queue preview, release → `test/unit/assistance-support.service.test.ts`, `test/unit/ai-assistance.service.test.ts`
- **KNW-05, KNW-06** — UTF-8 chunking, relevance gate → `test/unit/knowledge-chunking.test.ts`
- **PAY-11, PAY-20** — payment review visibility, provider timestamp → `test/unit/payment.controller.test.ts`, `test/unit/payment-receipt-timing.test.ts`
- **LIC-26** — action resolve endpoint → `test/unit/licensing.service.test.ts`
- **PAY-08** — terms snapshot/version/hash + migration → `test/unit/payment.controller.test.ts` (**chưa đóng** do `db:verify:terms` FAIL)

**Frontend (10 ID):**
- **AUTH-01, AUTH-02, AUTH-09** — session refresh, logout, 403 handling → `frontend/test/buyer-commerce.test.tsx`
- **GBL-01, GBL-03** — error boundary, forbidden page → `frontend/test/app.test.tsx`
- **PAY-04, PAY-12, PAY-13** — checkout intent, no auto-create → `frontend/test/checkout-intent.test.ts`, `frontend/test/buyer-commerce.test.tsx`
- **LIC-01** — confirm trước khi consume key → `frontend/test/buyer-hub.test.tsx`
- **LIC-03** — public verification error mapping → `frontend/test/license-error-mapping.test.ts`
- **LIC-09, LIC-10** — provider command status/row-specific pending → `frontend/test/provider-workspace.test.tsx`
- **CAT-01** — compare screen direct buy CTA → `frontend/test/buyer-commerce.test.tsx`

**Mobile (17 ID):**
- **PAY-22, PAY-23, PAY-19** — terms gate, server snapshot, boolean labels → `mobile/test/unit/phase3-phase4-screens.test.tsx`
- **CAT-01, CAT-05, CAT-06** — compare CTA, catalog search, 4-plan limit → `mobile/test/unit/phase3-phase4-screens.test.tsx`
- **LIC-05, LIC-07, LIC-08, LIC-12** — activation gate, retrieve CTA, renewal preview, poll backoff → `mobile/test/unit/phase3-phase4-screens.test.tsx`
- **SUP-09, SUP-13, SUP-14, SUP-15, SUP-17, SUP-19** — polling, draft isolation, request generation, clientMessageId reuse, close conversation, maxLength → `mobile/test/unit/phase3-phase4-screens.test.tsx`
- **GBL-06, GBL-07, GBL-09** — accessibility state, error clear, loading vs empty → `mobile/test/unit/phase3-phase4-screens.test.tsx`

### ID chưa đóng / bị chặn

**Chưa sửa hoặc chỉ sửa một phần (43 ID):**
- AUTH: AUTH-03 to AUTH-08, AUTH-10 to AUTH-15 (8 ID)
- PAY: PAY-01 to PAY-03, PAY-05 to PAY-07, PAY-09 to PAY-10, PAY-14 to PAY-18, PAY-21 (12 ID)
- LIC: LIC-02, LIC-04, LIC-06, LIC-11, LIC-13 to LIC-25 (16 ID)
- SUP: SUP-01, SUP-02, SUP-04 to SUP-08, SUP-10 to SUP-12, SUP-16, SUP-18 (12 ID)
- GBL: GBL-02, GBL-04 to GBL-10 (7 ID)
- CAT: CAT-02 to CAT-07 (6 ID)
- PRV: PRV-01 to PRV-07 (7 ID)
- KNW: KNW-01 to KNW-04 (4 ID)
- NTF: NTF-01 (partial), NTF-02 (partial) (2 ID)
- HOM: HOM-01 (1 ID)
- OPS: OPS-01 (1 ID)

**Bị chặn bởi môi trường (17 ID):**
- Backend integration/E2E: PAY-08 (migration chưa chạy), PAY-11 (unmatched queue), PAY-20 (provider timestamp), LIC-26 (resolve endpoint) — cần Docker/Testcontainers
- OpenAPI contract: PAY-08, PAY-11, PAY-20, LIC-26 — cần env config cho `openapi:check`
- Mobile E2E: PAY-03 (WebView deep link), LIC-06 (recovery), LIC-21 (clipboard), LIC-25 (remote revoke) — cần thiết bị Android/Maestro
- External provider: AUTH-04 (email verification), AUTH-11 to AUTH-13 (password reset), PAY-05 to PAY-07 (SePay callback/IPN), KNW-01 to KNW-04 (AI provider) — cần credentials/environment thật

### Hành động triển khai còn lại

1. **Chạy migration PAY-08** trên database disposable/thật rồi đồng bộ lại `db:verify:terms` (đặt tên cột nhất quán `service_terms_*_snapshot`).
2. **Cấu hình môi trường OpenAPI** để `openapi:check` bỏ qua `SEPAY_SANDBOX_RECEIPT_TIMING` khi test local.
3. **Cài đặt Android SDK/Maestro** và cấu hình test identity để chạy `e2e:maestro`.
4. **Triển khai các ID còn thiếu** theo thứ tự phụ thuộc: PAY-01/02/03 (idempotency + deep link) → PAY-04 (checkout UI) → PAY-05/06/07 (payment completion) → LIC-02/04/06 (recovery + labels) → SUP-01/04 (escalation UI) → CAT-02/07 → PRV-01/07 → KNW-01/04 → GBL-04/08/10 → HOM-01 → OPS-01 → NTF-01/02 partial → AUTH-03/04/11/12/15.
5. **Cập nhật OpenAPI artifacts** (frontend/mobile `openapi.json`) sau khi backend DTO thay đổi được merge.

Các ma trận ở mục 5, 9 và 12 giữ nguyên ID; chỉ những dòng có bằng chứng kiểm thử mới được chuyển `[x]`.



## 1. Phạm vi, ràng buộc và điều chỉnh sau đối chiếu

- Bao phủ **120 ID**: AUTH 15, PAY 23, LIC 26, SUP 22, GBL 10, CAT 7, PRV 7, KNW 6, NTF 2, HOM 1, OPS 1. Không bỏ P2 khỏi tiêu chí hoàn tất toàn bộ.
- Mọi đường dẫn code bên dưới tính từ `EmuKey/`, trừ tài liệu baseline ở thư mục cha.
- Ưu tiên nghiệp vụ → SQL → công nghệ → kế hoạch. Không đưa Contract PDF, chữ ký hai bên, KMS hoặc iOS vào phạm vi do hướng dẫn skill cũ còn nhắc tới.
- `frontend`, `backend`, `mobile` giữ quyền sở hữu cấu hình, dependencies, lockfile và test riêng. Không tạo HTTP client/auth store/query-key system thứ hai.
- Phân quyền, giá, trạng thái thanh toán, idempotency, nhận key, điều kiện gia hạn phải do backend quyết định. UI chỉ diễn giải và hướng dẫn.
- Đối chiếu lại dòng code trước mỗi task; số dòng trong báo cáo có thể thay đổi. Mỗi vấn đề phải tái hiện hoặc được chứng minh đã hết bằng regression test trước khi đóng.
- Web đã có `usePaymentHistory()` trong `application/orders/orderQueries.ts`, và `PaymentStatusScreen` đã dùng nó. PAY-05 cần hoàn thiện lịch sử/biên lai, không tạo hook lịch sử trùng.
- `PaymentReviewDto` nằm ở `backend/src/modules/commerce-payment/presentation/commerce.dto.ts`; đường dẫn thiếu `presentation` trong báo cáo cần sửa khi cập nhật tài liệu.
- `/knowledge/query` hiện có AuthGuard/RolesGuard; SUP-12 không được giải bằng cách bỏ guard toàn controller.
- Không đổi `INNER JOIN` thành `LEFT JOIN` rồi trả giao dịch không xác định chủ sở hữu cho customer/provider. PAY-11 cần phân biệt lịch sử của chủ sở hữu với hàng đợi đối soát của System.
- `provider_occurred_at` đã có trong SQL. PAY-20 chủ yếu sửa mapping biên lai; không thay thuật toán `payment_effective_time` hoặc quy tắc chấp nhận IPN để sửa một nhãn thời gian.
- Snapshot điều khoản cần migration thực sự: mã đang tải nội dung hiện tại, trong khi baseline nghiệp vụ yêu cầu version/hash. Không dùng việc bỏ cache như giải pháp cho dữ liệu lịch sử.
- Khi refresh bị 401/403 xác nhận phiên không hợp lệ, xóa phiên tập trung. Mất mạng/timeout/5xx không đồng nghĩa phiên hết hạn: cần trạng thái gián đoạn và thử lại, tránh đăng xuất oan.
- Logout offline chỉ bảo đảm thoát ở thiết bị; không được thông báo rằng server đã thu hồi phiên khi request thất bại. Ngăn cookie refresh còn sót tự đăng nhập lại ngay sau reload.
- Persist ID của order/command và ý định thao tác theo tài khoản; không đưa activation key, mật khẩu, action token hoặc entitlement vào URL, localStorage, log, analytics.

## 2. Thứ tự và phụ thuộc

| Đợt | Task | Kết quả cần có trước khi chuyển đợt |
|---|---|---|
| 0 | T00 | Tái hiện, chốt contract và baseline; biết lỗi nào đã có test |
| 1 | T01–T03 | Phiên, lỗi, đổi mật khẩu, xác minh email và quyền truy cập đáng tin cậy |
| 2 | T04–T07 | Tạo đơn chủ động, retry không trùng, snapshot điều khoản, thanh toán và chứng từ đúng |
| 3 | T08–T11 | Nhận/khôi phục/xoay key, gia hạn và trạng thái license đầy đủ trên cả hai client |
| 4 | T12–T14 | Chuyển support, hội thoại, badge và trợ giúp hoạt động xuyên suốt |
| 5 | T15 | Accessibility và ngôn ngữ cho phạm vi ban đầu |
| Bổ sung | T17–T25, xen theo phụ thuộc mục 8 | Đóng 33 ID mới và kiểm tra luồng rút gọn |
| Bổ sung lượt 3 | T26–T30, theo phụ thuộc mục 11 | Đóng thêm 11 ID về support, AI, knowledge, thiết bị và checkout |
| Cuối | T16 | Kiểm thử hồi quy và nghiệm thu đủ 120 ID |

Ưu tiên P0 trong từng đợt. Có thể đưa phần SUP-01 của T12 lên ngay sau T01 vì không phụ thuộc commerce; không chờ hoàn thiện toàn bộ P2 mới xử lý P0. T05 hoàn thành contract trước T06; T08 hoàn thành contract trước T09/T10; T13 dùng dữ liệu hội thoại từ T12. Các task được chia theo kết quả nghiệp vụ, không giao backend và frontend thành hai kế hoạch rời nhau.

## 3. Quy trình chung cho mỗi task

- [ ] Ghi bước tái hiện, tài khoản/role, dữ liệu đầu vào và phản hồi hiện tại; xác định nguyên nhân ở UI, transport, application hoặc persistence.
- [ ] Bổ sung regression test vào test owner liệt kê trong task; chạy test mục tiêu và ghi lỗi trước sửa. Với thay đổi thuần nội dung/CSS, kiểm tra trực tiếp thay vì tạo test mô phỏng implementation.
- [ ] Sửa từ contract/domain/persistence đến hook/screen; bổ sung đúng empty/loading/error/retry/success, quyền và trạng thái sau reload.
- [ ] Chạy lại test mục tiêu, kiểm tra luồng qua API thật khi task có thay đổi backend, rồi chạy quality gate của project bị tác động.
- [ ] Ghi bằng chứng vào bảng ID ở mục 5 và cập nhật tài liệu liên quan. Chỉ tick khi đạt tiêu chí; không coi mock UI pass là bằng chứng tích hợp thật.

## 4. Các task triển khai

### T00 — Chuẩn hóa baseline và bộ ca tái hiện

**Owner:** báo cáo lỗi, tài liệu baseline, các test hiện có. Không thay logic sản phẩm ở bước này.

- [ ] Chạy `git status --short` trong `EmuKey`; lưu trạng thái ban đầu, bảo toàn thay đổi người dùng. Thư mục cha chứa báo cáo không phải Git repository.
- [ ] Kiểm tra scripts/package/lockfile của ba project; đọc `AGENTS.md` áp dụng và tra tài liệu chính thức đúng phiên bản trước khi dùng API thư viện hoặc SDK.
- [ ] Tạo dữ liệu kiểm thử trong database dùng riêng: CUSTOMER A/B, PROVIDER A/B, SYSTEM, SUPPORT A/B; order chờ điều khoản/chờ trả tiền/đã trả/hủy/hết hạn; license pending/active/suspended/expired/revoked/reorg; hội thoại AI/queue/claimed/closed.
- [ ] Với từng ID, ghi kết quả tái hiện vào bảng mục 5. Các lỗi timing phải kiểm tra refresh, back/forward, chạm đúp, hai tab, timeout sau server commit, offline và khởi động lại app.
- [ ] Giữ trace/screenshot/log trong OS temp hoặc output directory đã ignored; không chụp key/mật khẩu/token thật.

**Đầu ra:** bộ fixture và test mở rộng tại owner hiện có; không thêm test account vào dữ liệu thật. Dùng `backend/test/integration/*`, `frontend/test/*`, `mobile/test/unit/*` và các E2E liệt kê ở T16.

### T01 — Phiên, transport và phân quyền giao diện

**ID:** AUTH-01, AUTH-02, AUTH-05, AUTH-09, AUTH-10, GBL-01, GBL-03, GBL-05.

**Sửa:** `frontend/src/application/auth/authContext.tsx`; `frontend/src/presentation/app/App.tsx`; `components/SiteHeader.tsx`, `components/RoleShell.tsx`, `screens/SystemConsoleScreen.tsx` dưới `frontend/src/presentation`; `mobile/src/infrastructure/api/client.ts`; backend `src/platform/http/api-error.dto.ts`, `api-exception.filter.ts` nếu thiếu metadata.

**Tạo có chủ đích:** `frontend/src/presentation/components/AppErrorBoundary.tsx` để cô lập render failure; `frontend/src/presentation/screens/ForbiddenScreen.tsx` để hiển thị 403. Không tạo auth provider mới.

**Contract:** mở rộng `ApiRequestError`/`MobileApiError` hiện có với `traceId?: string`, `retryAfterSeconds?: number`; giữ `status`, `code`. Backend dùng envelope thống nhất, UI map code sang tiếng Việt an toàn, không in stack/SQL/raw message nội bộ.

- [ ] Giữ refresh single-flight; auth endpoints không tự refresh khi mật khẩu sai. Refresh chỉ thử lại request gốc tối đa một lần; thêm timeout cho chính request refresh.
- [ ] Khi phiên thực sự invalid, hủy query đang chạy, xóa dữ liệu riêng tư khỏi QueryClient, xóa token/user một lần và redirect với return path nội bộ đã kiểm tra. Dùng generation/session marker để response cũ không khôi phục user sau logout.
- [ ] Logout clear local state trong `finally`, có pending/disable; lưu dấu đã logout để chặn bootstrap refresh nếu chưa thu hồi cookie server. Xóa dấu khi đăng nhập chủ động thành công; retry revoke khi kết nối lại theo trạng thái phiên hiện hành.
- [ ] Chờ bootstrap trước guard; anonymous → login; authenticated sai role → 403 có đường về workspace hợp lệ. Chặn redirect ngoài origin, `//host`, route auth lặp và route không có quyền.
- [ ] ErrorBoundary có nút tải lại/quay về; session expiry xử lý trong auth transport, không dựa vào ErrorBoundary để bắt lỗi async.

**Test owner:** `frontend/test/app.test.tsx`, `completed-flows.test.tsx`, `internal-consoles.test.tsx`, `frontend/e2e/auth-reload.spec.ts`; `mobile/test/unit/app.test.tsx`.

**Ca bắt buộc:** 5 request cùng 401 chỉ refresh một lần; refresh 401 thoát sạch; refresh timeout hiện retry; logout lỗi mạng rồi reload không tự vào lại; refresh về muộn sau logout không phục hồi phiên; login sai mật khẩu không kích hoạt refresh; role sai không flash login; crash render có fallback.

### T02 — Đổi/reset mật khẩu, xác minh email và đăng ký bền vững

**ID:** AUTH-03, AUTH-04, AUTH-06, AUTH-07, AUTH-11, AUTH-14.

**Sửa web:** `presentation/components/AuthForms.tsx`, `presentation/screens/AuthScreen.tsx`, `presentation/screens/AccountProfileScreen.tsx`, `application/auth/authContext.tsx`.

**Sửa backend:** `modules/identity-access/identity.controller.ts`, `identity.dto.ts`, `identity.service.ts`, `identity.repository.ts`, `infrastructure/identity-email-delivery.ts`; `modules/operations/infrastructure/brevo-email-delivery.ts`, `application/notification.service.ts`, `infrastructure/notification.repository.ts`, `worker/notification.processor.ts` trong `backend/src/`.

- [ ] Thêm form đổi mật khẩu ở profile, gọi `PUT /auth/password`, gồm mật khẩu hiện tại/mới/xác nhận; xử lý chính sách session version hiện có và yêu cầu đăng nhập lại sau thành công nếu server đã thu hồi phiên.
- [ ] Validation mật khẩu khi blur/submit, chỉ dẫn tĩnh khi nhập; không hiển thị lỗi đỏ ngay phím đầu tiên.
- [ ] Link xác minh có email đã URL-encode hoặc ngữ cảnh opaque tương đương; luôn có ô email dự phòng để resend. Email trong URL chỉ là gợi ý, không là bằng chứng sở hữu; tránh ghi email/token vào analytics/referrer.
- [ ] Reset có token URL thì ẩn ô nhập token thủ công; hết hạn/đã dùng có CTA xin link mới, xóa token khỏi URL sau tiêu thụ.
- [ ] Phân biệt sai thông tin, chưa xác minh, bị khóa và rate limit theo code backend được phép công khai; luồng forgot/resend vẫn dùng phản hồi chống dò tài khoản.
- [ ] Tách kết quả tạo account khỏi lỗi giao email. Ghi user + yêu cầu giao email bền vững trong transaction; worker retry bounded/backoff và cho resend khi thất bại. Rà notification delivery hiện hữu trước khi mở rộng để không tạo queue/store trùng. Không ghi verification secret dạng plaintext vào log hoặc payload không bảo vệ.
- [ ] Định nghĩa kết quả thành công đăng ký là account đã được tạo và yêu cầu xác minh đã ghi bền vững; UI nói rõ cần kiểm tra email, có resend. Test crash giữa commit và enqueue để chứng minh không mất delivery intent.

**Dữ liệu:** nếu delivery hiện tại không hỗ trợ intent định danh trước enqueue, thêm migration chuyên biệt `backend/database/migrations/20260930-identity-verification-delivery.sql`; không thêm bảng job chung. Đồng bộ schema baseline theo gate T05.

**Test owner:** backend `test/unit/identity.service.test.ts`, `identity.controller.test.ts`, `brevo-email-delivery.test.ts`, `test/integration/identity/identity-flow.integration.test.ts`; frontend `test/completed-flows.test.tsx`.

**Nghiệm thu:** Brevo lỗi không biến đăng ký đã commit thành “chưa đăng ký”; reload/resend tiếp tục được; resend không kéo dài token cũ tùy tiện; token hết hạn/đã dùng có lối ra; đổi mật khẩu chặn mật khẩu hiện tại sai và vô hiệu phiên theo chính sách backend.

### T03 — Profile và quản lý tài khoản System

**ID:** AUTH-08, AUTH-12, AUTH-13.

**Sửa:** web `screens/AccountProfileScreen.tsx`, `screens/SystemConsoleScreen.tsx`, `components/RoleShell.tsx`; backend `identity.dto.ts`, `identity.service.ts`, `identity.repository.ts`.

- [ ] Đồng bộ form bằng dữ liệu user mới nhưng không ghi đè trường đang dirty; refetch sau save và reset form sau thành công.
- [ ] Chốt PATCH semantics: omitted = giữ nguyên; `null` = xóa phone/address; UI trim chuỗi trắng rồi gửi null. Sửa type, DTO, repository và OpenAPI đồng bộ; không đổi chuỗi rỗng thành giá trị giả.
- [ ] Thêm tìm user qua `q` với debounce; query key chứa bộ lọc; phân biệt không có kết quả và lỗi.
- [ ] Chỉ hiện transition backend cho phép; DISABLED không có nút Khóa. Dialog nhập lý do bắt buộc và xác nhận; xử lý conflict nếu status đã đổi ở tab khác.
- [ ] Thêm mục Hồ sơ trên shell System với route có guard đúng role.

**Test owner:** frontend `test/internal-consoles.test.tsx`, `completed-flows.test.tsx`; backend `test/integration/identity/identity-flow.integration.test.ts`.

**Nghiệm thu:** tìm kiếm gọi đúng q; clear phone/address lưu được; form cập nhật sau đổi user; DISABLED không gửi transition bị cấm; user không phải System gọi API quản trị bị từ chối.

### T04 — Ý định mua hàng, idempotency và gia hạn không cần secret

**ID:** PAY-01, PAY-02, PAY-04.

**Sửa:** web `application/orders/orderQueries.ts`, `screens/BuyerCheckoutScreen.tsx`, `screens/BuyerRenewalScreen.tsx`; mobile `src/infrastructure/api/client.ts`, `src/presentation/EmuKeyMobileApp.tsx`; backend commerce `application/commerce.service.ts`, `infrastructure/commerce.repository.ts`, `presentation/commerce.controller.ts`, `presentation/commerce.dto.ts`.

**Contract:** giữ `POST /orders` + `Idempotency-Key`; payload chỉ gồm dữ liệu nghiệp vụ như `planId`, `targetLicenseId`, không activation key. Cùng actor + key + payload → cùng order; cùng key khác payload → 409. Backend vẫn khóa/unique để chống hai request đồng thời.

- [ ] Mount/reload trang checkout chỉ đọc, không tạo order. Nút Tạo đơn hàng là điểm phát mutation, có pending và thông báo kết quả.
- [ ] Tạo một intent ID trước gửi request; persist theo user + plan + targetLicense + intent, lưu cả orderId khi nhận được. Timeout không rõ server đã commit thì retry cùng key; chỉ tạo key mới khi người dùng chủ động bắt đầu giao dịch mới hoặc giao dịch trước terminal.
- [ ] Không dùng key vĩnh viễn chỉ theo cặp plan/license vì sẽ chặn mua/gia hạn lần sau. Không dùng UUID mới mỗi lần gọi API. Kiểm tra hai tab để resume cùng intent đã lưu.
- [ ] Mobile bỏ input/yêu cầu activation key khi gia hạn; kiểm tra ownership và `canRenew` ở server. Giữ tương thích client cũ trong cửa sổ chuyển đổi nhưng không sử dụng secret làm quyền gia hạn.

**Test owner:** backend `test/unit/create-order-validation.test.ts`, `test/integration/commerce/commerce-flow.integration.test.ts`; frontend `test/buyer-commerce.test.tsx`; mobile `test/unit/phase3-phase4-screens.test.tsx`.

**Nghiệm thu:** chạm đúp, reload, timeout sau commit đều một order; user B không resume intent user A; chủ động mua lần tiếp theo tạo order mới; chỉ mở URL không tạo đơn.

### T05 — Snapshot điều khoản và vòng đời đơn/phiên thanh toán

**ID:** PAY-07, PAY-08, PAY-13.

**Sửa:** backend commerce service/repository/DTO, `src/platform/terms/service-terms-content.ts`, `src/modules/commerce-payment/worker/order-timeout.processor.ts` nếu cần; web `application/orders/orderQueries.ts`, `screens/BuyerCheckoutScreen.tsx`, `screens/BuyerOrdersScreen.tsx`; mobile checkout/order detail trong `EmuKeyMobileApp.tsx`.

**Tạo:** `backend/database/migrations/20260930-order-service-terms-snapshot.sql`. Đồng bộ `backend/database/schema.sql`, `../sql_minimal.sql` và baseline validator theo quy ước hiện có.

**Contract đề xuất, phải cập nhật OpenAPI:** order có `serviceTermsVersion`, `serviceTermsHash`; GET điều khoản theo order trả `{content, version, hash}`; accept gửi `{accepted: true, version, hash}`. Server so với snapshot bất biến của order, không so với bản mới nhất toàn hệ thống. Deadline trả từ server gồm `paymentDueAt` và `expiresAt` của checkout attempt hiện tại.

- [ ] Snapshot nội dung/version/hash lúc tạo order trong cùng transaction; accept chỉ thành công với đúng version/hash đã hiển thị. Giữ bằng chứng acceptedAt.
- [ ] Migration additive trước; đối với đơn cũ chỉ backfill nếu truy được nội dung lịch sử đáng tin cậy. Nếu không có, đánh dấu nguồn legacy/không xác định, giữ acceptedAt thật; không gán bản hiện tại như thể đã chấp thuận. Đơn chưa chấp thuận phải xem và chấp thuận snapshot xác lập mới trước checkout.
- [ ] Cache terms theo order/version; Infinity chỉ hợp lệ với snapshot thật sự bất biến. Khi version mismatch, tải lại và yêu cầu đọc/xác nhận lại.
- [ ] Hiện nút hủy cho các trạng thái backend cho phép, gồm WAITING_PAYMENT; confirm lý do/kết quả, invalidate order/list/checkout. Backend serialize cancel với IPN/timeout; nếu payment đã được chấp nhận thì trả conflict và UI refetch.
- [ ] Hiện riêng hạn đơn và hạn phiên thanh toán, không hard-code 30/15 phút. Hết attempt nhưng đơn còn hạn thì cho tạo phiên mới; đơn hết hạn thì chặn theo server. Dùng server time/deadline để hạn chế lệch đồng hồ thiết bị.

**Test owner:** `backend/test/integration/commerce/commerce-flow.integration.test.ts`, `test/integration/database/baseline-schema.integration.test.ts`; frontend `test/buyer-commerce.test.tsx`; mobile `test/unit/phase3-phase4-screens.test.tsx`.

**Nghiệm thu:** publish terms mới không đổi nội dung đơn cũ; sai hash bị 409; migration chạy trên dữ liệu cũ không bịa lịch sử; cancel/IPN cạnh tranh không phát hai kết quả nghiệp vụ; countdown phản ánh đúng hai deadline.

### T06 — Thanh toán chủ động và kết quả WebView

**ID:** PAY-03, PAY-09, PAY-10, PAY-12.

**Sửa:** web `screens/PaymentStatusScreen.tsx`, `components/OrderSummary.tsx`; mobile `src/presentation/EmuKeyMobileApp.tsx`, `src/infrastructure/api/client.ts`, cấu hình Expo hiện có; backend `infrastructure/sepay-payment.gateway.ts` và `application/ports/payment-gateway.port.ts` trong commerce nếu callback contract thiếu thông tin.

- [ ] Bỏ tự tạo checkout/requestSubmit khi mount; hiển thị số tiền/đơn/điều khoản và CTA Thanh toán. Trở về từ cổng chỉ query trạng thái, không tự tạo một phiên trả tiền nữa.
- [ ] Bổ sung allowlist callback/deep link và xử lý navigation WebView, đóng/hủy, cold start và resume Android. Chỉ nhận đường dẫn/host/scheme cấu hình; server kiểm tra order ownership.
- [ ] Deep link `success` chỉ là tín hiệu query, không phải bằng chứng đã trả tiền. Backend IPN đã xác thực mới chuyển trạng thái tài chính; chain finality mới cho license sẵn sàng.
- [ ] State UI gồm chờ thanh toán, đang xác nhận, đã trả/chờ cấp license, license sẵn sàng, gia hạn đang xử lý/hoàn tất, cần kiểm tra, đã hủy/hết hạn, lỗi mạng. Sau 30 giây chưa xác nhận, hiển thị kiểm tra lại/liên hệ hỗ trợ, không kết luận thất bại hoặc tự trả lần nữa.
- [ ] Poll khi màn foreground và order còn nonterminal; backoff khi lỗi, dừng khi unmount/logout/terminal. License pending có poll riêng, không giữ WebView che kết quả.
- [ ] Mobile OrderDetail có tên sản phẩm/gói, giá, deadline, terms, trạng thái tiếng Việt và action hợp lệ; sau mua nối luồng nhận key T08.

**Test owner:** `frontend/e2e/payment-status-flow.spec.ts`, `user-purchase-flow.spec.ts`; `mobile/test/unit/phase3-phase4-screens.test.tsx`, `mobile/e2e/phase6-license-flow.yaml`; backend `test/unit/sepay-payment.gateway.test.ts`.

**Nghiệm thu:** back từ WebView, app bị kill rồi mở link, IPN đến trước/sau callback, callback giả success, thanh toán muộn và cancel đều cho kết quả đúng. Có bằng chứng Android thật/emulator; unit test không đủ để đóng PAY-03.

### T07 — Lịch sử, biên lai và hàng đợi đối soát

**ID:** PAY-05, PAY-06, PAY-11, PAY-16, PAY-20.

**Sửa:** backend commerce repository/service/controller/DTO; web `application/orders/orderQueries.ts`, `application/operations/operationsQueries.ts`, `screens/BuyerOrdersScreen.tsx`, `screens/PaymentStatusScreen.tsx`, `screens/ProviderOperationsScreen.tsx`, `components/PaymentReviewPanel.tsx`; mobile API/order detail.

- [ ] Dùng lại GET `/payments/history`, GET `/payments/:id/receipt`; thêm xem/in chứng từ từ giao dịch hợp lệ. Đây là biên lai thanh toán của hệ thống, không tự gọi là hóa đơn điện tử thuế.
- [ ] Quy tắc cảnh báo ưu tiên `reviewStatus === OPEN`, kể cả classification MATCHED có review đang mở; RESOLVED/CLOSED_NO_ACTION hiển thị kết quả đã xử lý. Không suy luận reviewStatus chỉ từ classification.
- [ ] Customer chỉ thấy giao dịch chứng minh thuộc đơn mình; provider chỉ thấy đơn thuộc mình. Giao dịch order_id null chỉ vào queue System cho đến khi có căn cứ gắn chủ sở hữu. Không gán theo email/nội dung chuyển khoản người dùng tự nhập.
- [ ] Mở rộng review DTO với order/customer/product context nullable, timestamp, amount/currency, reason và action hợp lệ; chỉ trả thông tin cần thiết, không raw IPN/secret. Reconcile/resolve cần audit, idempotency và bảo vệ khỏi xử lý hai lần.
- [ ] Dùng `provider_occurred_at` cho `paidAt`, giữ `receivedAt` riêng khi cần giải thích trễ IPN; không sửa chính sách sandbox/timing_basis của fulfillment. Chuẩn hóa múi giờ và format.
- [ ] Nhãn classification/review tiếng Việt, giữ mã kỹ thuật ở phần chi tiết cho System khi cần hỗ trợ.

**Test owner:** backend `test/unit/payment.controller.test.ts`, `test/integration/commerce/commerce-flow.integration.test.ts`, `test/security/http-authorization-negative.test.ts`; frontend `test/buyer-commerce.test.tsx`, `internal-consoles.test.tsx`, `provider-workspace.test.tsx`.

**Nghiệm thu:** unmatched vẫn xuất hiện ở queue System; không lộ chéo customer/provider; resolved hết cảnh báo mở; biên lai dùng thời điểm provider, không thời điểm webhook đến.

### T08 — Nhận key một lần và tra cứu công khai

**ID:** LIC-01, LIC-03, LIC-07, LIC-15, LIC-21.

**Sửa:** backend `modules/blockchain/application/license-query.service.ts`, `infrastructure/license-projection.repository.ts`, `presentation/license.dto.ts`, `presentation/license.controller.ts`; web `application/licenses/licenseQueries.ts`, `screens/BuyerLicenseHubScreen.tsx`, `screens/PaymentStatusScreen.tsx`, `screens/PublicVerificationScreen.tsx`; mobile client và màn license/payment.

- [ ] Tách nhận key với nhập key đã lưu; confirm nêu rõ chỉ nhận một lần trước khi gọi consume. Không vô hiệu nút âm thầm vì ô paste đang nhập dở.
- [ ] Sau ownership check, phân biệt pending chain, không trusted, chưa active và envelope unavailable bằng code ổn định. Không khẳng định “đã nhận” nếu backend chỉ biết envelope không còn: có thể hết TTL hoặc response bị mất. Non-owner vẫn nhận lỗi không tiết lộ license.
- [ ] Không retry tự động thao tác consume khi timeout: lần đầu có thể đã tiêu thụ. Đưa về kiểm tra trạng thái/khôi phục key có xác minh thay vì hứa trả lại secret cũ.
- [ ] Hiện key trong vùng che mặc định, sao chép có phản hồi; web cho tải file text từ bộ nhớ và revoke object URL; mobile có hành động lưu an toàn/chia sẻ rõ chủ đích nếu nền tảng hỗ trợ. Không tạo QR chứa secret trong phạm vi mặc định. Chỉ thêm clipboard/file/share dependency sau search-first và kiểm tra phiên bản Expo tương thích.
- [ ] Public verify validate input, 400 hướng dẫn sửa, 429 có `Retry-After` từ TTL limiter và countdown, lỗi mạng/5xx có retry, NOT_FOUND là kết quả riêng. Không auto-retry 429 liên tục.

**Test owner:** backend `test/unit/license-query.service.test.ts`, `test/integration/blockchain/phase5-golden-flow.integration.test.ts`; frontend `test/buyer-hub.test.tsx`, `public-verification.test.tsx`; mobile `test/unit/license-screens.test.tsx`.

**Nghiệm thu:** hủy confirm không consume; hai lần consume chỉ một lần có key; mất response có lối khôi phục; non-owner không nhận metadata nhạy cảm; public 400/429/404-kết-quả/network phân biệt; sao chép thành công/thất bại có thông báo.

### T09 — Phục hồi/xoay key có resume và retry đúng semantics

**ID:** LIC-02, LIC-06, LIC-11, LIC-12, LIC-17, LIC-18, LIC-19, GBL-07.

**Sửa:** web `application/licenses/licenseQueries.ts`, `components/LicenseRecoveryPanel.tsx`, `screens/BuyerLicenseHubScreen.tsx`; mobile client và `EmuKeyMobileApp.tsx`; backend `modules/licensing/licensing.service.ts`, `licensing.dto.ts`, `modules/blockchain/application/activation-envelope-recovery.service.ts`, `chain-command.service.ts`, `modules/identity-access/identity.service.ts`.

**Contract:** phản hồi challenge nên có `expiresAt`, `resendAvailableAt`, `attemptsRemaining`; UI không tự diễn giải giới hạn gửi mã thành số lần nhập sai. Status command kèm capability an toàn như `canRetry` chỉ khi backend xác định chắc chắn được.

- [ ] Web nối hook xoay key đã có; mobile bổ sung phục hồi. Giải thích xoay làm key cũ mất hiệu lực và ảnh hưởng thiết bị theo chính sách hiện hữu; xác nhận trước gửi lệnh.
- [ ] Persist `{userId, licenseId, commandId, action}` theo tài khoản; web URL chỉ chứa ID, mobile SecureStore. Khi reload đọc lại command từ backend, kiểm tra ownership và resume. Không lưu action token hoặc secret trong URL.
- [ ] Tách lỗi từng mutation/query; successful retry xóa lỗi tương ứng. Poll 2→5→10→15 giây khi lỗi/chờ lâu, dừng background/terminal, tôn trọng 429 và cho kiểm tra lại thủ công.
- [ ] Hiện thời điểm bắt đầu, thời gian đã chờ, trạng thái tiếng Việt, hỗ trợ kèm command ID. Không hứa ETA blockchain chính xác.
- [ ] DEAD_LETTER chỉ cho bắt đầu lại sau backend kiểm tra side effect; SUBMITTED_UNKNOWN phải reconcile trước, không gửi giao dịch trùng. Nếu không hỗ trợ hủy on-chain, dùng “Đóng theo dõi” và giải thích lệnh vẫn chạy, không hiện nút Hủy gây hiểu nhầm.
- [ ] Hiện TTL 15 phút và giới hạn gửi mã đúng scope server; hết hạn dẫn về yêu cầu mã mới. Disable trong lúc mutation, giữ idempotency intent, pull-to-refresh danh sách license.

**Test owner:** backend `test/unit/licensing.service.test.ts`, `chain-command.service.test.ts`, `activation-envelope-recovery.service.test.ts`; frontend `test/buyer-hub.test.tsx`; mobile `test/unit/license-screens.test.tsx`; E2E license của cả hai client.

**Nghiệm thu:** xoay/khôi phục tiếp tục sau reload và app restart; user khác không resume; retry mạng không tạo command thứ hai; key mới chỉ được nhận khi canonical confirmed; reorg chặn trusted state; thành công xóa lỗi cũ.

### T10 — License, thiết bị, entitlement và gia hạn nhất quán

**ID:** LIC-04, LIC-05, LIC-08, LIC-13, LIC-16, LIC-20, LIC-23, PAY-15, PAY-19.

**Sửa:** web `application/licenses/licenseQueries.ts`, `application/orders/orderQueries.ts`, `domain/buyerHome.ts`, `screens/BuyerLicenseHubScreen.tsx`, `screens/BuyerRenewalScreen.tsx`; mobile `EmuKeyMobileApp.tsx`, API client; backend licensing DTO/service và commerce renewal preview nếu metadata thiếu.

- [ ] Chuẩn hóa thuật ngữ: “Bản quyền” là license, “Mã tra cứu công khai” là publicLicenseId, “Mã kích hoạt bí mật” là activation key, “Mã xác minh thao tác” là action token. Dùng cùng bảng nhãn/hành vi ở hai project, không import source chéo thư mục.
- [ ] Pending chain/projection stale/reorg có giải thích, action hợp lệ và kiểm tra lại. Trạng thái lạ hiện “Chưa xác định” và mã hỗ trợ ở chi tiết, không mặc định hết hạn.
- [ ] Mobile không gửi activate khi thiếu key, thiếu device identity hoặc license chưa đủ điều kiện; cho nhập/lưu key an toàn. Map riêng invalid key, hết slot, thiết bị đã tồn tại, pending chain, hết hạn/bị thu hồi.
- [ ] Gia hạn dùng renewal preview từ backend: giá hiện tại hoặc giá snapshot của pending order, `canRenew`, pending order để resume, hạn cũ/hạn dự kiến. ACTIVE/EXPIRED/SUSPENDED theo capability backend, REVOKED không được tự cho phép. Không sửa UI bằng giá order gốc.
- [ ] Giải thích tại chỗ suspended/expired/revoked, lý do recovery không khả dụng. Home hiển thị thiết bị pending riêng hoặc trạng thái chưa tải, không quy mọi giá trị chưa biết về 0.
- [ ] Entitlement có mục chuyên sâu trên web/mobile, hiển thị quyền sử dụng và TTL dễ đọc. Token chỉ ở memory, hết 300 giây yêu cầu token mới theo backend; không tự gia hạn token cũ hoặc bỏ proof/device-signature checks. ISO raw không là nội dung chính.
- [ ] Mobile so sánh quyền lợi false phải hiển thị “Không hỗ trợ” hoặc loại khỏi danh sách quyền lợi đã bật, giữ đúng giá trị số/chữ; không liệt kê false như quyền lợi có sẵn.

**Test owner:** frontend `test/buyer-home-selectors.test.ts`, `buyer-hub.test.tsx`, `buyer-commerce.test.tsx`; mobile `test/unit/license-screens.test.tsx`, `phase3-phase4-screens.test.tsx`; backend `test/unit/licensing.service.test.ts`, `renewal-policy.test.ts`.

**Nghiệm thu:** parity trạng thái/giá/hạn/CTA giữa web-mobile; expired/suspended được xử lý đúng chính sách; entitlement hết TTL có lối cấp mới; số thiết bị pending không bị báo 0 sai.

### T11 — Provider thao tác license có trạng thái theo từng hàng

**ID:** LIC-09, LIC-10, LIC-14, LIC-22.

**Sửa:** web `screens/ProviderLicensesScreen.tsx`, `screens/SystemConsoleScreen.tsx`, `application/licenses/licenseQueries.ts`, `application/operations/operationsQueries.ts`; backend command DTO nếu thiếu capability/explorer metadata.

- [ ] Dialog riêng cho license/action, lý do được reset mỗi lần mở; confirm suspend/reactivate/revoke theo tác động thực tế. Spinner/disable theo licenseId và command hiện hành, không chung mọi hàng.
- [ ] Không nuốt `.catch`; thông báo lỗi tại thao tác và xóa khi thành công. Sau request accepted hiển thị lệnh đang xử lý, không cập nhật giả license đã đổi khi chưa confirmed.
- [ ] Map command/finality tiếng Việt, phần kỹ thuật có thể mở rộng cho vận hành; System hiển thị metrics bằng nhãn/số thay JSON raw.
- [ ] Link transaction dùng explorer cấu hình theo chain, URL allowlist, không hard-code Sepolia. Mạng local không có explorer thì cho copy hash.

**Test owner:** frontend `test/provider-workspace.test.tsx`, `internal-consoles.test.tsx`; backend `test/unit/chain-command.service.test.ts`, `test/security/authorization-negative.test.ts`.

**Nghiệm thu:** thao tác hàng A không spin hàng B, lý do không rò sang license khác; lỗi rồi thành công không còn alert cũ; chưa confirmed không hiện hoàn tất; provider khác không tác động license ngoài phạm vi.

### T12 — Chuyển nhân viên và hội thoại có trạng thái rõ ràng

**ID:** SUP-01, SUP-03, SUP-04, SUP-06, SUP-07, SUP-08.

**Sửa web:** `application/assistance/assistanceQueries.ts`, `supportQueries.ts`, `screens/BuyerAssistanceScreen.tsx`, `screens/SupportConsoleScreen.tsx`, `components/AiAssistantLauncher.tsx`, `components/ConversationPanel.tsx`; mobile AssistanceScreen trong `EmuKeyMobileApp.tsx` và client.

**Sửa backend:** `modules/assistance-support/assistance-support.service.ts`, `assistance-support.controller.ts`, `infrastructure/assistance-support.repository.ts`, `ai-assistance.service.ts`.

- [ ] Thêm CTA gọi POST `/conversations/:id/request-support`; backend owner-check và xử lý idempotent khi đang chờ/đã được nhận. Closed có CTA mở hội thoại mới theo chính sách hiện có.
- [ ] Không âm thầm đổi `AI_ACTIVE` chỉ vì customer gửi message. Đặt transition ở application use case: request support rõ ràng hoặc escalation policy có lý do. Ghi SYSTEM message trong cùng transaction khi chuyển queue.
- [ ] AI thiếu căn cứ hiện lời giải thích nhẹ, ví dụ cách hỏi lại, link trợ giúp và nút chuyển người thật; không biến lỗi Gemini thành câu từ chối như đã có câu trả lời hợp lệ.
- [ ] Timeline là dữ liệu chuẩn từ backend, gồm AI/CUSTOMER/SUPPORT/SYSTEM, sắp theo serverSequence, deduplicate theo message ID/clientMessageId. Invalidate/refetch messages sau ai-ask; bỏ câu trả lời riêng bên ngoài timeline để tránh biến mất/lặp.
- [ ] Persist conversationId theo user, nối link lịch sử; 403/404 thì bỏ pointer và cho tạo mới. Logout xóa pointer/cache riêng tư.
- [ ] Agent chưa claim: disable composer và hướng dẫn Nhận xử lý; backend vẫn kiểm tra assignment. Claim đồng thời chỉ một người thắng, người còn lại thấy đã được nhận.

**Test owner:** backend `test/unit/assistance-support.service.test.ts`, `ai-assistance.service.test.ts`, `test/integration/assistance/phase7-assistance.integration.test.ts`; frontend `test/internal-consoles.test.tsx`, `api-backed-screens.test.tsx`; mobile `test/unit/phase3-phase4-screens.test.tsx`.

**Nghiệm thu:** AI → queue → claim → reply → close xuyên suốt; customer biết mình đang chờ người thật; mở lại launcher giữ hội thoại; hai agent không cùng claim; không lộ hội thoại người khác.

### T13 — Cập nhật tin nhắn và thông báo có giới hạn

**ID:** SUP-02, SUP-05, SUP-09, SUP-10, SUP-11.

**Sửa:** web `application/assistance/assistanceQueries.ts`, `supportQueries.ts`, `application/notifications/notificationQueries.ts`, `components/NotificationCenter.tsx`, `screens/SupportConsoleScreen.tsx`; mobile assistance/notification screen và API client; backend `modules/operations/presentation/notification.controller.ts`, `application/notification.service.ts`, `infrastructure/notification.repository.ts` và message DTO/repository nếu cần pagination.

- [ ] Foreground conversation poll 5 giây, support queue/badge 10 giây; background/unmount/logout dừng. Lỗi tăng khoảng chờ tối đa 30 giây, tôn trọng Retry-After; reconnect/refocus tải lại và success xóa lỗi cũ.
- [ ] Tin nhắn lấy tăng dần theo serverSequence hoặc cursor đã có, dedup và giữ vị trí scroll khi xem lịch sử. Không ép cuộn cuối nếu người dùng đang đọc tin cũ.
- [ ] Badge dựa unreadCount toàn bộ dữ liệu từ backend, không đếm 8/100 hàng đang tải. Mark read invalidate count/list, xử lý hai tab/thiết bị.
- [ ] Popover giữ preview 8 mục và link Xem tất cả; danh sách đầy đủ có cursor/load more. Backend giới hạn page size và lọc owner trước pagination. Mobile badge + pull-to-refresh, có loading/error/empty/retry.
- [ ] Tạo `frontend/src/presentation/screens/NotificationsScreen.tsx` nếu chưa có owner cho danh sách đầy đủ; route mới dùng cùng query/guard, không tạo notification store thứ hai.

**Test owner:** backend `test/unit/notification.service.test.ts`, `test/integration/operations/phase7-notification.integration.test.ts`; frontend `test/api-backed-screens.test.tsx`, `internal-consoles.test.tsx`; mobile `test/unit/phase3-phase4-screens.test.tsx`.

**Nghiệm thu:** customer thấy reply trong một chu kỳ poll khi foreground; badge cập nhật khi popover đóng; đọc thông báo giảm count đúng; >100 thông báo duyệt được không lặp; background không giữ timer gây request vô hạn.

### T14 — Tìm kiếm trợ giúp an toàn

**ID:** SUP-12.

**Sửa:** web `screens/PublicHelpScreen.tsx`, `application/assistance/knowledgeQueries.ts`; backend `modules/assistance-support/knowledge.controller.ts`, `knowledge.service.ts`, `knowledge.dto.ts`, `infrastructure/knowledge.repository.ts`.

- [ ] Giữ `/knowledge/query` đã xác thực. Bổ sung endpoint public chỉ trả FAQ/document đã publish, current và được phép công khai, qua cùng search use case với visibility policy riêng.
- [ ] Public DTO chỉ có tiêu đề, trích đoạn, link công khai an toàn; không private storage URL, draft, tài liệu tenant nội bộ, hoặc dữ liệu hội thoại. Nếu schema chưa biểu diễn visibility, thêm trường/migration tại owner knowledge; mặc định dữ liệu cũ private, không tự public toàn bộ.
- [ ] Search có giới hạn độ dài, debounce, rate limit, empty/loading/error/retry, link nguồn. Không dùng AI sinh câu trả lời thay cho tìm kiếm nguồn khi không cần.

**Test owner:** backend `test/unit/knowledge-response.test.ts`, `test/integration/assistance/phase7-assistance.integration.test.ts`, `test/security/http-authorization-negative.test.ts`; frontend `test/api-backed-screens.test.tsx`.

**Nghiệm thu:** guest tìm được FAQ công khai; tài liệu private/draft/tenant khác không lọt vào nội dung/snippet/link; người đã login vẫn dùng search có quyền hiện hữu.

### T15 — Hoàn thiện nội dung, điều hướng và accessibility

**ID:** PAY-14, PAY-17, PAY-18, GBL-02, GBL-04, GBL-06.

**Sửa:** `frontend/index.html`; web `presentation/app/App.tsx`, `components/OrderSummary.tsx`, `SiteHeader.tsx`, `CustomerLayout.tsx`, `screens/ComparePlansScreen.tsx`, `screens/CatalogScreen.tsx`, `presentation/styles.css` và các stylesheet đang import; mobile `EmuKeyMobileApp.tsx`.

- [ ] `lang=vi`, title theo route có tên ứng dụng; route thay đổi thông báo dễ hiểu cho screen reader.
- [ ] Skip-to-content trỏ main có focus target; customer navigation mobile có menu, active item, focus/close bằng keyboard; không che CTA, không cuộn ngang ở 320/375/768px.
- [ ] Card catalog có một link chính có tên rõ, không nested interactive/role link giả. Mobile Pressable có accessibilityRole/label/state và focus/pressed/disabled rõ ràng.
- [ ] Chọn gói ở trang public lưu ngữ cảnh plan/return path an toàn qua login; sau login đến đúng màn xem lại, chưa tạo đơn tự động.
- [ ] OrderSummary lấy snapshot server cho tên sản phẩm/gói, thời hạn, thiết bị, quyền lợi, tổng tiền; không dùng giá hiện tại để thay lịch sử order.

**Test owner:** frontend `test/workspace-foundation.test.tsx`, `buyer-commerce.test.tsx`, `app.test.tsx`, `color-contrast.test.tsx`; mobile `test/unit/phase3-phase4-screens.test.tsx`.

**Nghiệm thu:** keyboard-only thao tác được login/catalog/checkout/key/support; focus không mất sau modal; screen reader đọc đúng tiếng Việt, loading/error/copy announcement; menu mobile dùng được ở font lớn. Chụp visual regression vào output ignored.

### T16 — Nghiệm thu toàn bộ và cập nhật hướng dẫn

- [ ] Chạy các gate ở mục 6, ghi số pass/fail/skip thật, kiểm tra migration trên database disposable với cả dữ liệu mới và legacy.
- [ ] Chạy E2E thật: đăng ký/xác minh/đổi mật khẩu/expiry/logout; mua/terms/thanh toán/biên lai; nhận key/activate/recover/rotate/renew; AI/support/notification; quyền System/Provider và public help.
- [ ] Chạy ma trận mất mạng, reload, hai tab, hai thiết bị, timeout sau commit, IPN trễ/trùng/sai tiền, reorg, DEAD_LETTER, rate limit. Không suy từ mock/happy path rằng external integration đã đạt.
- [ ] Cập nhật `../HDSD.md`, báo cáo lỗi nguồn và trạng thái liên quan trong `../APP_IMPLEMENTATION_PLAN.md` bằng kết quả đã kiểm chứng; ghi hạn chế external gate còn thiếu nếu có.
- [ ] Review final diff; không secrets, artifact, lockfile churn vô cớ, source import chéo project, HTTP client/query store trùng; chạy `git diff --check` và `git status --short`.

### Bổ sung 02/10/2026 — device source of truth

- Individual device state is operational data owned by PostgreSQL. Blockchain does not store device identity. Blockchain stores only an asynchronously synchronized aggregate active-device count. License lifecycle finality remains on-chain.
- Activation/revoke commit `license_devices` immediately under the locked license transaction; `max_active_devices` is counted from PostgreSQL `ACTIVE` rows. Entitlement requires chain-confirmed license plus DB-active device, never device finality.
- Aggregate sync uses durable `SYNC_DEVICE_COUNT` payload `{licenseId, activeDeviceCount, deviceStateVersion, protocolVersion, commandId}`. It never contains deviceRef, device signer, device id, hardware id, activation key, or action token.
- Migration `backend/database/migrations/20261002-device-postgres-source-of-truth.sql` is additive and preserves legacy chain events. Legacy `PENDING_ONCHAIN` rows are treated as backend-validated activations and promoted to `ACTIVE` with `activated_at=created_at`; production application must review this policy against deployment history before applying.
- Contract v2 must be deployed to testnet before real relayer/indexer use. This turn compiled and tested the contract and exported ABI only; no testnet/mainnet deployment was performed.

## 5. Ma trận bao phủ 76 vấn đề ban đầu

Mỗi ô trạng thái ban đầu là `[ ]`; khi triển khai, thay bằng `[x]` và thêm đường dẫn test/kết quả thực chạy. Mỗi dòng có một task chịu trách nhiệm đóng chính.

| ID | Mức | Task | Tiêu chí đóng cụ thể | Đạt |
|---|---|---|---|---|
| AUTH-01 | P0 | T01 | Phiên invalid xóa token/user/cache, điều hướng một lần; offline có retry | [ ] |
| AUTH-02 | P0 | T01 | Logout lỗi mạng vẫn thoát local, reload không tự vào lại, có pending | [ ] |
| AUTH-03 | P0 | T02 | Form đổi mật khẩu gọi API thật, kiểm tra mật khẩu cũ và phiên sau đổi | [ ] |
| AUTH-04 | P0 | T02 | Link email và fallback resend hoạt động cả khi thiếu email/token hết hạn | [ ] |
| AUTH-05 | P1 | T01 | Auth giữ code/status/traceId và thông báo đúng loại lỗi | [ ] |
| AUTH-06 | P1 | T02 | Login có hướng dẫn xác minh/khóa/rate limit theo contract an toàn | [ ] |
| AUTH-07 | P1 | T02 | Giao email lỗi không làm account đã commit bị báo đăng ký thất bại | [ ] |
| AUTH-08 | P1 | T03 | Search q, lý do nhập thật, DISABLED không có transition bị cấm | [ ] |
| AUTH-09 | P1 | T01 | Authenticated sai role vào 403, không flash login | [ ] |
| AUTH-10 | P1 | T01 | System dùng parser lỗi chuẩn và xử lý conflict/quyền/phiên | [ ] |
| AUTH-11 | P2 | T02 | URL có token ẩn input thủ công; expired có xin link mới | [ ] |
| AUTH-12 | P2 | T03 | Profile đồng bộ user, clear phone/address xuyên DTO đến DB | [ ] |
| AUTH-13 | P2 | T03 | System có mục Hồ sơ và guard đúng | [ ] |
| AUTH-14 | P2 | T02 | Password validate blur/submit, không báo lỗi ngay khi bắt đầu nhập | [ ] |
| PAY-01 | P0 | T04 | Gia hạn mobile không hỏi/gửi activation key | [ ] |
| PAY-02 | P0 | T04 | Double tap/retry/reload cùng intent chỉ một order | [ ] |
| PAY-03 | P0 | T06 | WebView return/cold start/cancel kết thúc đúng qua trạng thái server | [ ] |
| PAY-04 | P1 | T04 | Mount không tạo order, CTA chủ động và intent bền qua reload | [ ] |
| PAY-05 | P1 | T07 | Lịch sử và xem/in biên lai có API thật, kiểm tra ownership | [ ] |
| PAY-06 | P1 | T07 | Review resolved/closed không còn cảnh báo đang cần kiểm tra | [ ] |
| PAY-07 | P1 | T05 | Hủy WAITING_PAYMENT được, race với IPN có kết quả nhất quán | [ ] |
| PAY-08 | P1 | T05 | Nội dung/version/hash theo order bất biến, accept exact snapshot | [ ] |
| PAY-09 | P1 | T06 | Mobile đầy đủ trạng thái sau trả tiền và nối nhận key | [ ] |
| PAY-10 | P1 | T06 | Mobile chi tiết đơn có snapshot, terms và CTA đúng trạng thái | [ ] |
| PAY-11 | P1 | T07 | Unmatched có ở queue có quyền; DTO đủ context; không lộ chéo tenant | [ ] |
| PAY-12 | P2 | T06 | Không tự submit SePay khi tải trang | [ ] |
| PAY-13 | P2 | T05 | Hạn order/attempt riêng, lấy từ server, có resume khi attempt hết hạn | [ ] |
| PAY-14 | P2 | T15 | Summary đủ gói/thời hạn/thiết bị/quyền lợi/giá snapshot | [ ] |
| PAY-15 | P2 | T10 | Enum lạ hiển thị chưa xác định, không gán hết hạn | [ ] |
| PAY-16 | P2 | T07 | Classification và review có nhãn tiếng Việt | [ ] |
| PAY-17 | P2 | T15 | Public chọn gói → login → đúng ngữ cảnh, chưa tự tạo order | [ ] |
| PAY-18 | P2 | T15 | Card chỉ một link chính, keyboard/screen reader dùng được | [ ] |
| PAY-19 | P2 | T10 | Quyền lợi false không hiển thị như được cấp trên mobile | [ ] |
| PAY-20 | P2 | T07 | Biên lai paidAt từ provider, receivedAt riêng | [ ] |
| LIC-01 | P0 | T08 | Confirm consume, tách paste, lỗi unavailable không kết luận sai | [ ] |
| LIC-02 | P0 | T09 | Web/mobile resume rotation sau reload/restart bằng commandId | [ ] |
| LIC-03 | P0 | T08 | Public verify 400/429/network khác nhau, có countdown/retry | [ ] |
| LIC-04 | P1 | T10 | Mobile giải thích pending/stale/reorg và nhãn license | [ ] |
| LIC-05 | P1 | T10 | Không activate với key rỗng, lỗi key/device/capacity phân biệt | [ ] |
| LIC-06 | P1 | T09 | Recovery và rotation có trên cả web/mobile | [ ] |
| LIC-07 | P1 | T08 | Mobile nhận key sau mua với semantics một lần | [ ] |
| LIC-08 | P1 | T10 | Gia hạn preview đúng giá/hạn/canRenew/pending order trên mobile | [ ] |
| LIC-09 | P1 | T11 | Command nhãn rõ, tx link/copy phù hợp chain, lỗi không bị nuốt | [ ] |
| LIC-10 | P1 | T11 | Loading và reason theo license/action, không dùng chung sai hàng | [ ] |
| LIC-11 | P1 | T09 | Theo dõi có elapsed/retry an toàn/support; không giả hủy on-chain | [ ] |
| LIC-12 | P1 | T09 | Mobile poll backoff, thành công xóa lỗi của poll trước | [ ] |
| LIC-13 | P2 | T10 | Thuật ngữ thống nhất và phân biệt public ID với secret | [ ] |
| LIC-14 | P2 | T11 | Không raw enum/JSON ở nội dung chính, kỹ thuật ở chi tiết | [ ] |
| LIC-15 | P2 | T08 | Có lưu/tải key chủ động, không lưu secret tự động vào URL/cache | [ ] |
| LIC-16 | P2 | T10 | Giải thích suspended/expired/revoked và lý do recovery không khả dụng | [ ] |
| LIC-17 | P2 | T09 | TTL và giới hạn challenge hiển thị theo server, hết hạn có xin mới | [ ] |
| LIC-18 | P2 | T09 | Pull-to-refresh, pending/disable và idempotency khi chạm đúp | [ ] |
| LIC-19 | P2 | T09 | Mobile map code theo thao tác, có retry hợp lệ | [ ] |
| LIC-20 | P2 | T10 | Entitlement UI hai client, TTL rõ, token chỉ memory, hết hạn cấp mới | [ ] |
| LIC-21 | P2 | T08 | Copy mobile có phản hồi accessibility, web có aria-live | [ ] |
| LIC-22 | P2 | T11 | Provider xác nhận trước suspend/reactivate/revoke | [ ] |
| LIC-23 | P2 | T10 | Thiết bị pending/unknown không bị đếm mặc định thành 0 | [ ] |
| SUP-01 | P0 | T12 | CTA chuyển nhân viên ở web/mobile gọi endpoint thật | [ ] |
| SUP-02 | P1 | T13 | Message/queue/notification cập nhật foreground trong chu kỳ đã định | [ ] |
| SUP-03 | P1 | T12 | Escalation có nguyên nhân và system message, không chuyển âm thầm | [ ] |
| SUP-04 | P1 | T12 | AI không trả lời được có hướng dẫn hỏi lại/help/support | [ ] |
| SUP-05 | P1 | T13 | Badge cập nhật khi popover đóng và sau mark-read | [ ] |
| SUP-06 | P2 | T12 | AI answer lưu/đọc trong timeline, reload không mất hoặc lặp | [ ] |
| SUP-07 | P2 | T12 | Agent chưa claim không gửi, được hướng dẫn nhận xử lý | [ ] |
| SUP-08 | P2 | T12 | Launcher giữ conversation theo user, có link lịch sử | [ ] |
| SUP-09 | P2 | T13 | Mobile thấy reply mới khi đang mở hội thoại | [ ] |
| SUP-10 | P2 | T13 | Mobile unread badge và pull-to-refresh hoạt động | [ ] |
| SUP-11 | P2 | T13 | Preview có Xem tất cả, phân trang vượt 100 mục | [ ] |
| SUP-12 | P2 | T14 | Help search nguồn public thật, private/draft không bị lộ | [ ] |
| GBL-01 | P0 | T01 | Render error có fallback, 401 xử lý ở session coordinator | [ ] |
| GBL-02 | P1 | T15 | lang vi và title đúng theo route | [ ] |
| GBL-03 | P1 | T01 | Sai role có màn 403 riêng | [ ] |
| GBL-04 | P1 | T15 | Skip link và nav customer ở màn nhỏ dùng được | [ ] |
| GBL-05 | P1 | T01 | Error envelope/parser/action nhất quán trên client | [ ] |
| GBL-06 | P2 | T15 | Mobile Pressable có label/role/state/focus phù hợp | [ ] |
| GBL-07 | P2 | T09 | Error theo thao tác trên mobile, success không để lỗi cũ tồn tại | [ ] |

## 6. Lệnh kiểm chứng và bằng chứng cần lưu

Chạy từ từng project độc lập. Các lệnh dưới đây là **lệnh dự kiến khi triển khai**, chưa được chạy để chứng nhận các bản sửa trong lần lập kế hoạch này. Nếu môi trường pnpm cần workaround hiện có, thêm `--config.verify-deps-before-run=false` sau `pnpm`; không đổi lockfile để né lỗi môi trường.

Ví dụ chạy focused test trước, chọn đúng owner của task:

```powershell
# cwd: EmuKey/backend
corepack pnpm exec vitest run test/unit/identity.service.test.ts
corepack pnpm exec vitest run test/integration/commerce/commerce-flow.integration.test.ts --maxWorkers=1

# cwd: EmuKey/frontend
corepack pnpm exec vitest run test/buyer-commerce.test.tsx
corepack pnpm exec playwright test e2e/auth-reload.spec.ts

# cwd: EmuKey/mobile
corepack pnpm test --runTestsByPath test/unit/license-screens.test.tsx
```

Sau khi focused pass, chạy gate của mỗi project bị tác động:

```powershell
# cwd: EmuKey/backend
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm baseline:check
corepack pnpm openapi:check
corepack pnpm delivery:check

# cwd: EmuKey/frontend
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm openapi:check
corepack pnpm e2e

# cwd: EmuKey/mobile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm openapi:check
corepack pnpm e2e:check
corepack pnpm e2e:maestro

# cwd: EmuKey
git diff --check
git status --short
```

- Nếu đổi DTO/schema: regenerate OpenAPI bằng scripts hiện có ở backend rồi frontend/mobile; review diff contract trước `openapi:check`. Không sửa tay generated types.
- Backend integration cần PostgreSQL/Redis và Docker/Testcontainers theo setup test; license E2E cần RPC/worker/indexer và fixture tài khoản. Test bị skip vì thiếu điều kiện không tính là pass nghiệp vụ.
- Web E2E mở rộng tại `frontend/e2e/auth-reload.spec.ts`, `user-purchase-flow.spec.ts`, `payment-status-flow.spec.ts`, `buyer-ui-recovery.spec.ts`, `phase6-license-flow.spec.ts`, `user-license-run.spec.ts`. Giữ timing experiment riêng, không dùng nó thay regression thanh toán.
- Mobile unit dùng `mobile/test/unit/*`; mở rộng Maestro `mobile/e2e/phase6-license-flow.yaml` và thêm flow auth/payment/support dưới cùng thư mục khi cần. `expo export` không thay được thử WebView/deep link trên Android.
- E2E Brevo/SePay/Gemini và blockchain external phải ghi môi trường thực tế; local fake/Hardhat chỉ chứng minh local, không chứng minh Sepolia hay production.

### Ca kiểm thử contract mẫu cho các lỗi khó

Các đoạn sau là đặc tả kiểm thử, không phải helper đã tồn tại; khi viết test dùng fixture/HTTP harness hiện có ở test owner tương ứng.

```text
Idempotency:
  A gửi POST /orders, key K, payload P; server commit nhưng response bị mất.
  A retry key K, payload P => orderId giống, DB chỉ có 1 order cho A/K.
  A gửi key K, payload khác P => 409, không mutate order cũ.
  B dùng key K => không đọc được order của A.

Terms:
  Tạo O với version V1/hash H1/content C1; publish V2.
  GET terms(O) => C1/V1/H1; accept V2/H2 => conflict.
  Accept V1/H1 => lưu acceptedAt; GET terms(O) vẫn C1 sau reload.

Payment return:
  Callback success, server WAITING_PAYMENT => UI đang xác nhận, chưa có key.
  IPN đã xác thực, license PENDING_ONCHAIN => UI đã trả tiền/chờ cấp.
  Canonical confirmed + trusted ACTIVE => có CTA nhận key.

One-time key:
  Hủy confirm => không gọi consume.
  Consume thành công => đúng một secret; lần tiếp theo => unavailable.
  Response consume mất => không blind retry; recovery có xác minh mới.

Authorization:
  Customer A/B và Provider A/B gọi order/receipt/license/command/conversation của nhau
  => bị từ chối, không trả metadata riêng tư; unmatched chỉ System có quyền thấy.
```

## 7. Migration, triển khai và điều kiện hoàn tất

1. **Expand:** migration additive cho snapshot terms và các dữ liệu mới thực sự cần; chạy thử trên bản dữ liệu disposable, kiểm tra legacy và constraints. Không reset database thật.
2. **Backend trước:** phục vụ field/endpoint mới theo hướng tương thích. Với terms exact version/hash, deploy client hiểu field mới trước khi bật yêu cầu bắt buộc; không giữ fallback bỏ xác minh vô thời hạn. Client mobile cũ cần thông báo nâng cấp nếu không còn đáp ứng contract bắt buộc.
3. **Web/mobile:** nối contract mới, regenerate types, kiểm thử release Android/deep links. Không triển khai backend bật trường bắt buộc khi mobile phát hành chưa sẵn sàng.
4. **Observe:** theo dõi refresh failure, duplicate intent/order, callback return nhưng IPN chưa xác nhận, pending/dead-letter command, email delivery retry và support queue age. Log trace/ID đã redact, không secret hoặc raw email token.
5. **Rollback:** rollback client trước hoặc giữ backend tương thích; migration additive giữ dữ liệu, không drop snapshot/accepted evidence/transaction. Không rollback bằng cách xóa lịch sử payment/chain command.
6. **Đóng toàn bộ:** 120 dòng tại mục 5, mục 9 và mục 12 đạt, E2E backend-web-mobile qua boundary thật, migrations/contract đồng bộ, test có bằng chứng, hướng dẫn cập nhật và diff đúng phạm vi. Nếu external gate chưa chạy, ghi rõ chưa xác nhận phần external; không ghi “fix triệt để toàn bộ” chỉ dựa trên unit test.

**Bằng chứng bàn giao tối thiểu cho mỗi đợt:** ID đã đóng; file đã đổi; test và lệnh/exit code; pass/fail/skip; ảnh/video khi cần; migration/config; phần chưa kiểm chứng. Tài liệu này hiện hoàn tất ở mức lập kế hoạch, tất cả checkbox triển khai còn mở.


## 8. Bổ sung lượt 2 — 33 vấn đề mới và luồng rút gọn

**Nguồn:** mục 8 của báo cáo lỗi. Giữ nguyên 76 ID ban đầu, không coi các bổ sung là đã sửa. Tại thời điểm lượt 2, kế hoạch gồm **26 task T00–T25**; lượt 3 mở rộng thành **31 task T00–T30**, trong đó T16 là gate cuối, không phải chạy trước phần bổ sung.

**Phương pháp:** đánh giá theo [usability heuristics NN/g](https://www.nngroup.com/articles/ten-usability-heuristics/), tham chiếu [WCAG Redundant Entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html) và [Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html). Dùng các nguyên tắc này để kiểm tra quyết định thiết kế, không tuyên bố đã đạt WCAG từ đọc code.

### 8.1. Phụ thuộc và thứ tự ghép vào công việc hiện có

| Task mới | Ghép sau / cùng | Lý do |
|---|---|---|
| T17 — Chọn và so sánh | T04, T15 | Dùng checkout chủ động và redirect an toàn |
| T18 — Tìm kiếm và giữ ngữ cảnh | T10, T15 | Chuẩn hóa query params/filter với license/home |
| T19 — Form danh mục Provider | T01, trước T17 nghiệm thu dữ liệu | Loại bỏ form không lưu được, tạo fixture plan đúng contract |
| T20 — Bảo vệ thay đổi danh mục | T19 | Dùng capability và draft state đã thống nhất |
| T21 — Phiên bản/preview tri thức | T14, T19 | Giữ visibility/ownership, dùng đúng product context |
| T22 — Composer an toàn | T12, trước nghiệm thu T13 | Polling phải cập nhật đúng thread và không phá draft |
| T23 — Nối order/license/support | T06, T08, T12, T21 | Có trạng thái cấp license và metadata nguồn có quyền |
| T24 — Contract và liên kết thông báo | T01, trước/đồng thời T13 | Sửa isRead trước khi tăng polling |
| T25 — Hoàn thiện recovery/navigation | T02, T15 | Tận dụng auth flow và khung accessibility hiện có |
| T16 — Nghiệm thu cuối | Sau tất cả T00–T15, T17–T30 | Đủ 120 ID, local và external evidence tách riêng |

**Quyết định rút gọn:** dùng mục 8.3 của báo cáo làm acceptance cho journey. Không thêm dialog cho mọi click; chỉ xác nhận khi có nguy cơ mất nội dung, archive không hoàn tác hoặc thay version công bố. Không gộp create/accept terms thành hành động ngầm. Người dùng vẫn đọc snapshot order trước chấp thuận. Các CTA quan trọng phải nói việc sẽ xảy ra: Tạo đơn, Đồng ý và tiếp tục thanh toán, Chọn gói này, Xem bản quyền, Tạo phiên bản nháp.

### T17 — So sánh dẫn trực tiếp đến đúng lựa chọn

**ID:** CAT-01, CAT-02, CAT-03, CAT-07. **Phạm vi:** web/mobile catalog; backend comparison chỉ bổ sung dữ liệu nếu contract hiện có chưa đủ.

**Sửa:** `frontend/src/presentation/screens/ComparePlansScreen.tsx`, `ProductDetailScreen.tsx`; `frontend/src/application/catalog/catalogQueries.ts`; `mobile/src/presentation/EmuKeyMobileApp.tsx` (ComparePlansScreen, RootStackParamList), `mobile/src/infrastructure/api/client.ts`; backend `src/modules/catalog/application/compare-plans.query.ts` và `presentation/catalog.dto.ts` nếu thiếu định danh để điều hướng.

- [ ] Thêm regression với 5 plan, plan thứ 5 đang chọn; object entitlement có false/0/5/50/string; click mua cột thứ 2.
- [ ] Bỏ ưu tiên hard-code 25 thiết bị. Giữ lựa chọn trong URL nếu còn hợp lệ; lần đầu chọn gói có tổng giá thấp nhất một cách minh bạch, ghi rõ đó là giá toàn kỳ và số thiết bị, không tự gọi là gói khuyến nghị. Giá hòa chọn thứ tự ổn định từ dữ liệu; CTA nêu tên gói.
- [ ] Nút So sánh từ detail xây danh sách bắt đầu bằng selectedPlan.id rồi tối đa 3 ID khác không trùng. Sản phẩm một gói giải thích giới hạn và cho chọn thêm từ catalog.
- [ ] Mỗi cột/card có Chọn gói này. Web preserve product/plan qua login; mobile điều hướng Checkout theo ID cụ thể. Không tạo order hoặc charge từ màn so sánh; checkout refetch giá/capability server trước commit.
- [ ] Sửa formatter giữ giá trị quyền lợi: false → Không hỗ trợ, true → Có hỗ trợ, 0 → 0, number/string → giá trị thật với nhãn. Có fallback hiển thị hợp lệ cho kiểu dữ liệu chưa được UI hỗ trợ; không bỏ mất âm thầm.
- [ ] Test chọn từng gói đến đúng checkout, back/reload vẫn đúng ý định, gói vừa archive có giải thích/refetch.

**Test owner:** `frontend/test/buyer-commerce.test.tsx`, `frontend/e2e/user-purchase-flow.spec.ts`; `mobile/test/unit/phase3-phase4-screens.test.tsx`; `backend/test/unit/compare-plans.query.test.ts`.

**Đầu ra:** chọn gói bất kỳ từ so sánh bằng một action. Không thay domain giá hoặc mặc định quyền sử dụng.

### T18 — Giữ bộ lọc và tìm đúng bản ghi

**ID:** CAT-04, CAT-05, CAT-06, LIC-24, HOM-01.

**Sửa:** web `CatalogScreen.tsx`, `ComparePlansScreen.tsx`, `BuyerOrdersScreen.tsx`, `BuyerLicenseHubScreen.tsx`, `BuyerHomeScreen.tsx` dưới `frontend/src/presentation/screens/`; `frontend/src/domain/buyerHome.ts`; mobile CatalogScreen/LicensesScreen trong `EmuKeyMobileApp.tsx`.

**Contract điều hướng đề xuất:** catalog `q/sort/page`; compare `ids`; orders `q/status/tab/page/orderId`; licenses `q/status/licenseId/expiringWithin`. Các trường là dữ liệu không nhạy cảm, parser kiểm tra enum/range và bỏ tham số không hợp lệ; không đưa secret vào URL. Không bắt backend hỗ trợ server pagination mới chỉ để persist UI state hiện tại.

- [ ] Viết test với nhiều trang, back/forward/reload, URL query thay đổi khi component đang mount; kiểm tra invalid page/ID và query xung đột.
- [ ] Đồng bộ source of truth với search params; gõ search dùng replace/debounce để không tạo một history entry mỗi ký tự; chuyển trang/đối tượng dùng navigation có chủ đích.
- [ ] Thêm search mobile catalog, giữ selectedPlanIds khi lọc; khi đủ 4 thì các ô chưa chọn disabled có giải thích, ô đã chọn vẫn bỏ được.
- [ ] License list bổ sung plan name/expiry/public ID rút gọn; search chỉ dùng dữ liệu công khai trong phạm vi account. Không đổi selected license ngầm khi đang submit hành động nhạy cảm; selection bị lọc mất phải giải thích.
- [ ] Cảnh báo home link `/buyer/licenses?expiringWithin=30`, dùng cùng quy tắc thời gian/status với metric. Hiển thị khoảng lọc và cho bỏ lọc. Client không tự suy canRenew nếu backend không cho.
- [ ] Kiểm tra fixture 50 product, 10 license cùng tên sản phẩm; xác nhận không có secret trong URL, state người A không sang B sau logout.

**Test owner:** `frontend/test/buyer-home-selectors.test.ts`, `buyer-hub.test.tsx`, `buyer-commerce.test.tsx`; `frontend/e2e/buyer-ui-recovery.spec.ts`; `mobile/test/unit/phase3-phase4-screens.test.tsx`, `license-screens.test.tsx`.

### T19 — Tạo/sửa gói theo nghiệp vụ, không bắt hiểu cấu trúc dữ liệu

**ID:** PRV-01, PRV-02, PRV-04, PRV-05, PRV-07.

**Sửa:** `frontend/src/presentation/screens/ProviderCatalogScreen.tsx`; `frontend/src/application/catalog/catalogQueries.ts`; backend `src/modules/catalog/presentation/catalog.dto.ts`, `application/catalog-admin.service.ts`, `infrastructure/catalog-admin.repository.ts`. Tận dụng endpoint createProduct/createPlan/version allocation và imageUrl hiện có.

- [ ] Viết test published không được save bằng update, xóa quyền lợi bằng empty object, chu kỳ/tháng đồng bộ, tạo gói cho parent draft và parent archived.
- [ ] Chọn MONTHLY/YEARLY tự điền durationMonths 1/12 ở UI. Backend vẫn reject payload cặp sai; không bỏ validation phía server.
- [ ] Thay ô JSON mặc định bằng control desktop theo kiểu giá trị hiện có. Dữ liệu scalar/khóa backend đã hỗ trợ phải giữ nguyên nếu không sửa; mở phần nâng cao chỉ khi cần, có nhãn kiểu rõ. Gửi `entitlements: {}` khi người dùng chủ động xóa hết; omitted chỉ có nghĩa không thay đổi.
- [ ] Published plan có Xem chi tiết và Tạo phiên bản nháp, không Sửa trực tiếp. Tạo nháp copy dữ liệu có thể chỉnh, giữ product/code; server cấp version tiếp theo trong transaction hiện có. Rà unique constraints để hai thao tác đồng thời không trùng version; giữ nguyên planId/version/commitment của bản đã công bố.
- [ ] Lưu product xong có Lưu và thêm gói hoặc CTA tiếp theo; productId prefill. Nút Tạo gói chỉ bật khi có product hợp lệ. Công bố plan kiểm tra parent PUBLISHED, hướng dẫn công bố product trước bằng link/CTA; không tự publish parent ngầm.
- [ ] Thêm imageUrl, preview và xóa ảnh vào form product; đồng bộ type/DTO nếu nullable khác nhau. Dùng URL policy hiện hữu, không bổ sung upload service/dependency ngoài phạm vi cần thiết.
- [ ] Regenerate OpenAPI khi đổi contract; test role/provider ownership, price/entitlements snapshot của order cũ không bị thay sau tạo version mới.

**Test owner:** `frontend/test/provider-workspace.test.tsx`; `backend/test/unit/catalog-admin.service.test.ts`, `test/integration/catalog/catalog-lifecycle.integration.test.ts`.

**Schema:** chưa mặc định cần bảng/migration mới. Nếu chính sách version hiện có không cho tạo nháp cùng code trong trường hợp cụ thể, ghi bằng chứng constraint và sửa contract/schema đồng bộ; không biến published update thành đường tắt.

### T20 — Không làm mất thay đổi hoặc lưu trữ nhầm

**ID:** PRV-03, PRV-06. **Sửa:** ProviderCatalogScreen và mutations catalog; backend giữ transition đã có, chỉ thêm metadata capability nếu cần cho ảnh hưởng hiển thị.

- [ ] Test Escape/click ngoài/Hủy khi form dirty, save pending/save fail, archive product đang có plan published.
- [ ] Theo dõi dirty so với dữ liệu form khi mở, không theo một cờ từng gõ bất kỳ. Form không đổi đóng ngay; có đổi hỏi Bỏ thay đổi/Tiếp tục sửa, mặc định an toàn; lỗi save giữ dữ liệu.
- [ ] Trong request save chưa xác định kết quả, giữ dialog trạng thái chờ; nếu timeout cho kiểm tra lại đối tượng trước gửi lại. Không đóng/reset rồi báo lỗi ở màn ngoài làm mất nội dung.
- [ ] Archive confirm nêu rõ đối tượng, ngừng xuất hiện trong catalog/khả năng mua-gia hạn theo backend và không có restore trong state machine hiện tại. Backend vẫn kiểm tra trạng thái/ownership lúc commit; 409 tải lại thay vì lặp action.
- [ ] Không thêm confirm cho các thao tác đọc như xem, tìm kiếm, đổi tab hoặc chọn gói. Điều khiển dialog dùng keyboard/screen reader và trả focus đúng nút gọi.

**Test owner:** `frontend/test/provider-workspace.test.tsx`, `backend/test/integration/catalog/catalog-lifecycle.integration.test.ts`. Nghiệm thu archive không đổi license/order đã tồn tại và dirty form không mất khi người dùng chọn tiếp tục sửa.

### T21 — Cập nhật và công bố tri thức với version tường minh

**ID:** KNW-01, KNW-02. **Sửa:** `frontend/src/presentation/screens/AiKnowledgeScreen.tsx`, `application/assistance/knowledgeQueries.ts`; backend `src/modules/assistance-support/knowledge.controller.ts`, `knowledge.dto.ts`, `knowledge.service.ts`, `infrastructure/knowledge.repository.ts`.

**Contract đề xuất:** tạo document group với key ổn định do server cấp khi không chỉ định nhóm; cập nhật phiên bản bằng ID document/group đã chọn và ownership check. Thêm GET `/knowledge/documents/:id` trả metadata + preview text/chunks được giới hạn, không public storage URL. Publish mang expected-current-version/ID để phát hiện người khác đã thay bản hiện hành, trả 409 yêu cầu xem lại. Định danh cụ thể phải phản ánh model logicalDocumentKey hiện có, không mở một hệ quản trị tài liệu thứ hai.

- [ ] Test tên bỏ dấu/truncate trùng, cùng file đổi tên, chọn nhầm product, upload response timeout, preview ngoài owner và concurrent publish.
- [ ] Tách Thêm tài liệu mới và Cập nhật phiên bản ngay tại tài liệu hiện hữu. Nhóm logic không suy ra từ tên file nữa; dữ liệu cũ giữ nguyên key/history, không tự merge hai nhóm dựa trên tên giống.
- [ ] Upload intent dùng request key/checksum + group đã chọn để retry không tạo version mới ngoài ý muốn; checksum không tự gộp tài liệu của hai owner/group. Chỉ thêm constraint/migration tại knowledge nếu model hiện tại thiếu bảo đảm.
- [ ] Preview cho biết product, tên, version mới, version đang dùng, số lượng/trích đoạn chunks và lỗi extraction; không cần đưa file PDF vào viewer mới nếu text preview đáp ứng kiểm tra nội dung.
- [ ] Công bố mới cần xem lại thay thế nguồn; giữ old current khi transaction thất bại/conflict. Không gọi publish ngay sau upload.
- [ ] Test tài liệu private vẫn private, public help T14 không truy được preview owner-only; ghi rõ trạng thái rỗng/trích xuất không thành công và cách tải tệp khác.

**Test owner:** `backend/test/integration/assistance/phase7-assistance.integration.test.ts`, `test/unit/knowledge-response.test.ts`; `frontend/test/api-backed-screens.test.tsx`. Nếu cần test UI upload chuyên biệt, tạo `frontend/test/knowledge-workflow.test.tsx` với owner riêng, không nhân đôi fixtures API.

### T22 — Gửi tin nhắn không mất bản nháp hoặc nhầm hội thoại

**ID:** SUP-13, SUP-14, SUP-15, SUP-19.

**Sửa:** web `components/ConversationPanel.tsx`, `screens/BuyerAssistanceScreen.tsx`, `screens/SupportConsoleScreen.tsx`, `components/AiAssistantLauncher.tsx`, hooks assistance/support; mobile AssistanceScreen/client; backend `assistance-support.dto.ts`, `assistance-support.service.ts`, `ai-assistance.service.ts`, các repository xử lý messages.

**State đề xuất:** draft và outgoing intent theo `userId/conversationId`; mỗi outgoing gồm `clientMessageId, content, status`. Draft giữ memory khi đổi thread, không lưu lên URL hoặc log. Retry cùng intent giữ ID; hai lần gửi chủ động khác nhau luôn có ID khác dù nội dung giống nhau.

- [ ] Test A draft → B → A; A response chậm/B response nhanh; gửi thành công nhưng response mất; đang gửi A rồi mở B; AI câu hỏi giống nhau nhưng là hai ý định gửi mới.
- [ ] Lift draft đến owner tồn tại qua đổi thread, hoặc map theo conversation tại owner; composer nhận đúng draft. Với web rời trang có draft không rỗng, cảnh báo mất nội dung; logout xóa draft/cache.
- [ ] Mobile không setMessages/setAiAnswer toàn màn từ response đã lỗi thời. Guard generation + conversation ID hoặc cache per-ID; giữ nội dung cũ chỉ khi thuộc chính thread đang hiển thị.
- [ ] UI khóa gửi cùng intent pending; failed/unknown có Retry tái dùng ID. Server unique/dedup theo conversation/clientMessageId, cùng ID khác content trả conflict; AI explicit clientMessageId để không dùng hash câu hỏi thay ý định của người dùng. Đối chiếu lưu question/answer để một intent không sinh cặp trùng.
- [ ] Composer hiển thị giới hạn 4.000 cho AI, 8.000 cho message; không truncate draft tự động, không clear khi validation/network lỗi. Khi gửi thành công chỉ clear snapshot draft đã gửi, không xóa nội dung mới đang soạn.
- [ ] Khi T13 refetch/poll, draft và scroll không reset. Bộ UI gửi thống nhất theo trạng thái AI/support như mục 8.3 báo cáo, vẫn có chuyển người thật riêng.

**Test owner:** `frontend/test/api-backed-screens.test.tsx`, `internal-consoles.test.tsx`; `mobile/test/unit/phase3-phase4-screens.test.tsx`; backend `test/unit/ai-assistance.service.test.ts`, `assistance-support.service.test.ts`, `test/integration/assistance/phase7-assistance.integration.test.ts`.

**Không coi pass nếu:** chỉ disable button mà timeout retry vẫn sinh ID mới; hoặc message đúng nhưng draft từ A bị chuyển sang B.

### T23 — Nối ngữ cảnh từ giao dịch đến hỗ trợ và nguồn AI

**ID:** PAY-21, SUP-16, SUP-17, SUP-18.

**Sửa:** web BuyerOrdersScreen/PaymentStatusScreen/BuyerLicenseHubScreen/BuyerAssistanceScreen/AiAssistantLauncher/ConversationPanel và hooks hiện hữu; mobile OrderDetail/Assistance/client; backend assistance controller/DTO/service/repository, knowledge search/source DTO và commerce read DTO khi cần.

- [ ] Paid order có CTA Xem tiến trình nếu license còn pending, Xem bản quyền nếu đã sẵn sàng; dùng ID từ server, gia hạn đi targetLicenseId. Không tạo license mới hoặc mở consume key khi chỉ bấm xem.
- [ ] CTA hỗ trợ từ order/license dẫn đến `/buyer/support?contextType=ORDER&contextId=...` hoặc params native tương đương, cho chọn vấn đề/tiêu đề có ý nghĩa. Hiển thị context đã gắn và cho sửa trước gửi; backend xác nhận user có quyền với object, không chỉ validate enum/UUID.
- [ ] Khi đã có hội thoại đang mở cùng context, đưa lựa chọn tiếp tục rõ ràng; không tự gộp hai yêu cầu khác vấn đề. List thread có title + trạng thái + preview/thời gian nếu server cung cấp, không đòi khách nhớ UUID.
- [ ] Customer có Đã giải quyết/Đóng yêu cầu gọi endpoint close hiện có. Backend đảm bảo close retry an toàn, giữ audit; closed composer read-only cả web/mobile. Nếu agent đóng khi khách còn draft, giữ draft và gợi ý tạo yêu cầu mới cùng context, không silently reopen.
- [ ] Nguồn AI có `id/title/version/excerpt` gắn message; endpoint đọc source kiểm tra conversation ownership/role và visibility. Preview đúng version đã trích; nếu bị thu hồi quyền thì trả thông báo unavailable, không tìm nguồn khác thay thế.
- [ ] Không trả raw private storage URL, PII khách khác hoặc secret license trong context/nguồn. Regenerate DTO và test role âm.

**Test owner:** `frontend/test/buyer-commerce.test.tsx`, `api-backed-screens.test.tsx`; `mobile/test/unit/phase3-phase4-screens.test.tsx`; backend `test/integration/assistance/phase7-assistance.integration.test.ts`, `test/security/http-authorization-negative.test.ts`.

### T24 — Thông báo đọc bền và mở đúng công việc

**ID:** NTF-01, NTF-02. Thực hiện sửa mapper trước gate polling/badge của T13.

**Sửa:** backend `src/modules/operations/infrastructure/notification.repository.ts`, `application/notification.service.ts`, `presentation/notification.controller.ts`; web `application/notifications/notificationQueries.ts`, NotificationCenter/NotificationsScreen (owner từ T13); mobile client/NotificationsScreen.

**Tạo có chủ đích nếu chưa có:** `backend/src/modules/operations/presentation/notification.dto.ts` cho response HTTP. Không dùng `NotificationRecord` khai báo camelCase để ép kiểu row SQL snake_case rồi trả thẳng.

**Contract đề xuất:**
```ts
type NotificationTarget =
  | { kind: 'ORDER' | 'LICENSE' | 'CONVERSATION'; id: string }
  | null;
type NotificationView = {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  target: NotificationTarget;
};
```
Đây là contract sẽ triển khai, không phải type đã có. List/read đều trả mapper nhất quán; pagination/unreadCount dùng contract T13, không làm thêm endpoint count trùng.

- [ ] Viết test SQL thật tạo notification unread, gọi HTTP list, read, list lần nữa, assert isRead true và không còn field is_read ở contract public.
- [ ] Map dates/nullable fields tường minh. Nếu mark-read DTO chỉ trả id/isRead/readAt thì khai báo đúng DTO riêng và client merge; không giả vờ là NotificationView đầy đủ.
- [ ] Derive target từ event type + data ID đã xác minh; unknown type không có target. Không expose toàn bộ data nội bộ ra client.
- [ ] Mở chi tiết xác định route theo role và allowlist kind; destination thực hiện authorization lại. Không cho URL từ payload điều hướng tùy ý; target đã xóa/không còn quyền có fallback.
- [ ] Mark-read lỗi hiện retry nhưng không ngăn xem chi tiết khi người dùng có quyền; optimistic update nếu dùng phải rollback. Reload/app restart giữ trạng thái từ DB.
- [ ] Kiểm tra notification của user B không list/read/open được từ user A và unreadCount không phụ thuộc 8 hàng preview.

**Test owner:** `backend/test/integration/operations/phase7-notification.integration.test.ts`, `test/unit/notification.service.test.ts`, `test/security/http-authorization-negative.test.ts`; frontend `test/api-backed-screens.test.tsx`; mobile `test/unit/phase3-phase4-screens.test.tsx`.

### T25 — Lối phục hồi, trạng thái tải và thao tác bằng bàn phím

**ID:** AUTH-15, OPS-01, GBL-08, GBL-09, GBL-10. Các phần này dùng chung gate T15 nhưng có ca độc lập để không đóng gộp khi còn lỗi.

**Sửa:** mobile LoginScreen/OrdersScreen/NotificationsScreen; web `presentation/app/App.tsx`, `screens/PublicHomeScreen.tsx`, `components/AuditLogPanel.tsx`; `application/operations/operationsQueries.ts` và backend audit DTO/service nếu cần danh sách filter có quyền.

**Tạo có chủ đích:** `frontend/src/presentation/screens/NotFoundScreen.tsx`, phân biệt với ForbiddenScreen của T01.

- [ ] AUTH-15: thêm Quên mật khẩu trên Android, ưu tiên nối flow backend hiện có; nếu mở web, dùng base URL cấu hình allowlist + mode=forgot và hướng dẫn quay lại app, không hard-code localhost. Không cần tạo hệ reset password thứ hai.
- [ ] GBL-08: wildcard hiển thị 404, route có thật nhưng sai role vẫn 403; guest chưa login vào route protected vẫn login đúng return path. Trang 404 giữ điều hướng theo trạng thái user và không thay session.
- [ ] GBL-09: thêm initial loading/loaded/error/refreshing phân biệt cho Orders/Notifications mobile; giữ dữ liệu đã tải khi refresh, không render “chưa có” trên request đang chờ hoặc lỗi.
- [ ] GBL-10: inactive slide không focusable bằng inert hoặc cơ chế tương đương đúng phiên bản React/DOM; xử lý focus khi resize làm thay số card/trang. Các dot dùng semantics và keyboard interaction phù hợp; tôn trọng reduced-motion.
- [ ] OPS-01: audit filter chuyển combobox có nhãn từ action codes thật trong code/audit, cho nhập mã nâng cao; không invent danh mục không tồn tại. Render fields/outcome/role thành nhãn dễ đọc, mã lạ có fallback; giữ audit readonly/metadata redaction.
- [ ] Chạy unit/interaction test từng phần, Playwright keyboard tab carousel và unknown route, Android recovery/loading trên thiết bị hoặc emulator. Không ghi chuẩn accessibility đã đạt chỉ nhờ DOM snapshot.

**Test owner:** `frontend/test/app.test.tsx`, `avatar-carousel.test.tsx`, `internal-consoles.test.tsx`; `mobile/test/unit/app.test.tsx`, `phase3-phase4-screens.test.tsx`; backend `test/unit/audit-api.test.ts` nếu đổi API. Tạo `frontend/e2e/navigation-accessibility.spec.ts` khi chưa có flow tương đương để kiểm tra focus/404/back-forward thực.


## 9. Ma trận 33 vấn đề bổ sung

Kết hợp mục 5 thành 109 dòng duy nhất; tất cả trạng thái vẫn mở. Tiêu chí cụ thể và vị trí nguồn nằm tại mục 8.2 của báo cáo.

| ID | Mức | Task | Tiêu chí đóng cụ thể | Đạt |
|---|---|---|---|---|
| AUTH-15 | P1 | T25 | Từ login Android đi đến gửi yêu cầu reset và quay lại login được, không dò lộ email tồn tại. | [ ] |
| CAT-01 | P1 | T17 | Chọn gói thứ 2/3/4 đi đúng checkout bằng một hành động, không sửa danh sách so sánh. | [ ] |
| CAT-02 | P2 | T17 | Fixture có gói 1/5/25 thiết bị không tự ưu tiên 25; CTA nêu đúng gói đã chọn. | [ ] |
| CAT-03 | P1 | T17 | true/false/0/5/50/chuỗi cho kết quả khác nhau và giữ đủ ý nghĩa trên hai client. | [ ] |
| CAT-04 | P2 | T18 | Lọc → trang 2 → chi tiết → Back giữ trạng thái; URL mới đồng bộ component; ID đã mất có giải thích. | [ ] |
| CAT-05 | P2 | T18 | Fixture 50 sản phẩm tìm đúng gói, xóa lọc khôi phục lựa chọn; không lẫn empty ban đầu và không có kết quả. | [ ] |
| CAT-06 | P2 | T18 | Chọn đủ 4 rồi chạm gói thứ 5 thấy lý do, bỏ 1 gói thì chọn được; không khóa các ô đã chọn. | [ ] |
| CAT-07 | P2 | T17 | Chọn plan thứ 5 → So sánh vẫn có plan đó; sản phẩm chỉ một plan có action hợp lệ. | [ ] |
| PRV-01 | P2 | T19 | Đổi tháng ↔ năm luôn gửi 1 ↔ 12; payload sửa tay sai vẫn bị backend từ chối. | [ ] |
| PRV-02 | P1 | T19 | Gói có quyền lợi → xóa → save → reload vẫn rỗng; số/chữ giữ nguyên khi chưa sửa. | [ ] |
| PRV-03 | P1 | T20 | Hủy dialog không đổi dữ liệu; confirm chỉ archive đối tượng đã xem; giải thích license/order lịch sử vẫn được bảo toàn. | [ ] |
| PRV-04 | P1 | T19 | PUBLISHED không vào form save bị cấm; draft mới có version riêng, order/license cũ không đổi. | [ ] |
| PRV-05 | P2 | T19 | Tạo product → thêm gói không chọn lại product; không có select rỗng giả là thao tác hợp lệ; publish không gặp điều kiện ẩn. | [ ] |
| PRV-06 | P1 | T20 | Nhập dài → Escape/click ngoài giữ dữ liệu khi chọn tiếp tục; save lỗi còn nguyên form; không báo thành công cho nhầm đối tượng. | [ ] |
| PRV-07 | P2 | T19 | Sửa ảnh trên form → reload danh mục/chi tiết thấy đúng ảnh; bỏ ảnh và URL lỗi có hành vi rõ. | [ ] |
| KNW-01 | P1 | T21 | Hai tên chuẩn hóa trùng không tự thay cùng tài liệu; đổi tên file khi cập nhật vẫn đúng nhóm; retry không tạo version ngoài ý muốn. | [ ] |
| KNW-02 | P1 | T21 | Preview đúng dữ liệu server; publish nhầm bị ngăn; cross-provider không đọc preview; bản cũ giữ current nếu publish thất bại. | [ ] |
| SUP-13 | P1 | T22 | Viết A → B → A còn draft A, B không nhận draft A; logout xóa drafts; gửi thành công chỉ xóa draft đã gửi. | [ ] |
| SUP-14 | P1 | T22 | Mock A chậm hơn B, cuối cùng header và messages luôn cùng B; response send/AI của A không xuất hiện trong B. | [ ] |
| SUP-15 | P1 | T22 | Server lưu rồi client timeout → retry chỉ một message; chủ động gửi hai lần cùng nội dung vẫn là hai intent, không mất tin hợp lệ. | [ ] |
| SUP-16 | P2 | T23 | Từ order O mở support có O tự điền; backend kiểm tra ownership context; thread khác phân biệt được mà không đọc UUID. | [ ] |
| SUP-17 | P1 | T23 | Customer đóng hội thoại của mình được, không của người khác; status đổi từ phía agent khóa composer và bảo toàn draft chưa gửi. | [ ] |
| SUP-18 | P2 | T23 | Nguồn mở được đúng phiên bản, quyền kiểm tra phía server, revoked/unavailable giải thích rõ; không lộ private URL. | [ ] |
| SUP-19 | P2 | T22 | 4.001 ký tự chặn Hỏi AI nhưng vẫn gửi support khi dưới 8.001; lỗi giữ draft và focus đúng chỗ. | [ ] |
| NTF-01 | P2 | T24 | Thông báo support → đúng thread trong một lần bấm; link target mất/quyền thay đổi có fallback; không điều hướng URL tùy ý. | [ ] |
| NTF-02 | P1 | T24 | POST read rồi GET/reload hai client vẫn read, unreadCount đúng; request read lỗi không đánh dấu thành công giả. | [ ] |
| GBL-08 | P2 | T25 | URL gõ sai có 404 ở cả guest/user, không gọi refresh/logout và không tạo vòng redirect. | [ ] |
| GBL-09 | P2 | T25 | API chậm không hiện chưa có; API lỗi không hiện empty đồng thời; empty chỉ sau response rỗng thành công. | [ ] |
| GBL-10 | P1 | T25 | Tab không đi vào link ngoài viewport/aria-hidden; đổi trang dùng keyboard đến được card mới; không đoán mức tương phản từ source. | [ ] |
| LIC-24 | P2 | T18 | Fixture 10 license cùng sản phẩm chọn đúng theo plan/expiry/public ID trước thao tác; list không lộ secret. | [ ] |
| PAY-21 | P2 | T23 | Từ đơn đã trả đến đúng license hoặc trang chờ cấp trong một action, gia hạn đến đúng targetLicense, không nhận nhầm key. | [ ] |
| HOM-01 | P2 | T18 | Số cảnh báo khớp danh sách đích ở cùng mốc thời gian; expired/suspended theo quy tắc rõ; một click đến nhóm cần xử lý. | [ ] |
| OPS-01 | P2 | T25 | Chọn Khóa tài khoản lọc đúng action thực tế, mã lạ vẫn đọc được; dữ liệu audit chỉ đọc và scope không đổi. | [ ] |

## 10. Nghiệm thu bổ sung và kiểm soát mức rút gọn

Chạy quality gate ở mục 6 cho project bị tác động. T16 chỉ đóng sau phần bổ sung. Không cần cài dependency mới chỉ để đánh giá heuristic hoặc ghi tài liệu.

### 10.1. Kịch bản bắt buộc

```text
Notification DB-to-HTTP:
  Tạo notification is_read=false cho A.
  GET /notifications => isRead=false.
  POST /notifications/:id/read rồi GET lại => isRead=true.
  Reload web/mobile => vẫn đã đọc; B không truy cập notification đó.

Conversation isolation:
  Nhập draft A; chuyển B => không có draft A.
  Gửi request messages A chậm rồi B nhanh => chỉ render B.
  Timeout sau lưu message M; retry cùng clientMessageId => DB chỉ có M một lần.
  Chủ động gửi nội dung giống M lần mới => ID mới và message mới hợp lệ.

Catalog lifecycle:
  Product DRAFT + plan DRAFT => hướng dẫn publish product trước.
  Plan PUBLISHED => xem hoặc tạo version nháp, không mở update bị cấm.
  Xóa entitlement => reload vẫn {}; archive phải xem và xác nhận tác động.
  Đổi YEARLY => durationMonths=12; payload giả YEARLY/1 vẫn bị server chặn.

Navigation:
  Lọc catalog/trang 2 => xem detail => Back giữ bộ lọc/trang.
  Chọn plan 5 => So sánh có plan 5 => chọn đúng cột đến checkout.
  Đơn PAYMENT_ACCEPTED nhưng license pending => đi trang theo dõi, không nhận key.
  Tab carousel => không có focus trong inactive slide.
```

### 10.2. Cách đo trước/sau

Với cùng fixture, role, viewport và trạng thái đăng nhập, ghi số hành động có ý nghĩa từ điểm bắt đầu đến mục tiêu; tách network wait khỏi thời gian đọc/ra quyết định. Mục tiêu:

- Từ cột so sánh bất kỳ đến trang xem lại đúng gói: **1 action**, cộng bước login nếu chưa có phiên.
- Từ thông báo hợp lệ đến đúng thread/order/license: **1 action**; không bắt mark-read trước.
- Từ cảnh báo sắp hết hạn đến danh sách đúng nhóm: **1 action**; chỉ gia hạn sau người dùng chọn license.
- Tạo plan mới: **0 lần nhập durationMonths bằng tay** và không chọn lại product nếu xuất phát từ product.
- Hỗ trợ từ order/license: **0 lần chép mã đối tượng bằng tay**; vẫn cho người dùng nhập vấn đề.
- Back/reload: **0 lần nhập lại bộ lọc** còn hợp lệ; không đặt mục tiêu giữ mật khẩu/secret trên URL hoặc cache.
- Một lần retry sau timeout: **0 order/message/version trùng ngoài ý muốn**; xác minh ở DB và API, không chỉ nhìn một hàng UI.

Các con số này là acceptance mục tiêu chưa đo. Không mặc định giảm số click luôn tốt: xem trước thay nguồn AI, confirm archive/đốt lượt nhận key và giữ terms snapshot là bước có giá trị cần giữ.

### 10.3. Bàn giao sau triển khai

- [ ] 76 ID ở mục 5 + 33 ID ở mục 9 + 11 ID ở mục 12 đều có evidence, không tính trùng giữa polling và contract, giữa redirect và CTA chọn gói.
- [ ] Thêm E2E journey Provider catalog → version → knowledge preview/publish; System audit/read notification; buyer order → license/support; Android comparison → checkout/recovery.
- [ ] DTO/generated types đúng dữ liệu HTTP thật; test không tự mock camelCase rồi bỏ qua SQL snake_case.
- [ ] Nếu thêm endpoint preview/source/filter, có test cross-owner và response tối thiểu; migrations additive có legacy test và rollback phù hợp.
- [ ] Ghi rõ local fake/Hardhat, emulator và external provider nào đã chạy; chưa chạy thì không đánh dấu external pass.
- [ ] Cập nhật HDSD/báo cáo theo kết quả thật. File kế hoạch gốc là owner duy nhất, không khôi phục bản cũ trong docs.


## 11. Bổ sung lượt 3 — 01/10/2026

Tổng hiện tại **120 ID**, **31 task T00–T30**. Mục 5 chứa 76 ID ban đầu, mục 9 chứa 33 ID lượt 2, mục 12 chứa 11 ID lượt 3. Giữ task cũ, mở rộng theo bằng chứng code trong mục 9 của báo cáo; chưa đánh dấu triển khai hoàn tất.

| Task | Phụ thuộc / ghép vào | Mục tiêu |
|---|---|---|
| T26 | T12/T13, trước gate T16 | Claim đúng quyền và trả việc chưa xong về queue |
| T27 | T14/T21/T22/T23 | Lịch sử hỏi/đáp đầy đủ, nguồn đúng context/visibility/relevance |
| T28 | T21 | Upload tiếng Việt chia đoạn đúng giới hạn byte |
| T29 | T08/T09/T10 | Thu hồi từ xa và email dẫn đúng subject/action |
| T30 | T04/T05/T06 | Mobile chốt giá server và không accept khi terms chưa đọc |
| T16 | Sau toàn bộ T00–T15, T17–T30 | Nghiệm thu đủ 120 ID, không gộp mock với external evidence |

### T26 — Nhận và trả hội thoại đúng quyền

**ID:** SUP-21, SUP-22.

**Sửa:** web `frontend/src/presentation/screens/SupportConsoleScreen.tsx`, `application/assistance/supportQueries.ts`; backend `src/modules/assistance-support/assistance-support.controller.ts`, `assistance-support.dto.ts`, `assistance-support.service.ts`, `infrastructure/assistance-support.repository.ts`. Dùng state machine release đã có trong baseline; không mở quyền đọc toàn bộ thread chờ cho mọi staff.

- [ ] Test queue item chưa claim không gọi messages; claim thành công mới enabled, mất assignment thì cancel/remove cache thread không còn quyền.
- [ ] Thêm POST `/conversations/:conversationId/release` nhận lý do có độ dài giới hạn, SUPPORT_STAFF đang được assign mới được gọi; idempotency/retry phải phân biệt đã release với đã bị người khác claim lại.
- [ ] Transaction khóa conversation, kiểm tra status/version/owner, chuyển SUPPORT_ACTIVE → WAITING_SUPPORT, xóa assignment/claimed metadata theo schema, ghi audit và SYSTEM message. Không sửa lịch sử message cũ, không dùng close để trả queue.
- [ ] UI có Trả về hàng đợi, lý do và pending theo thread; thông báo khách đang chờ nhân viên tiếp theo; invalidate queue/selected-thread ở các client. Poll thực hiện theo T13.
- [ ] Không tự release khi đổi tab/route: trình duyệt có thể đóng bất ngờ và mạng chậm không chứng minh nghỉ ca. Luồng nghỉ ca dùng action rõ; trường hợp staff không còn hoạt động cần quy trình reassignment có quyền và audit trước khi thêm tự động hóa.
- [ ] Test A release đồng thời close/B claim, chỉ có transition hợp lệ; A không đọc/gửi tiếp sau B claim; không mất queue item hoặc lộ thread cho người chưa nhận.

**Test owner:** `backend/test/unit/assistance-support.service.test.ts`, `test/integration/assistance/phase7-assistance.integration.test.ts`, `test/security/http-authorization-negative.test.ts`; `frontend/test/internal-consoles.test.tsx`. SQL chỉ thêm migration nếu audit/idempotency thực sự thiếu dữ liệu, không tạo bảng queue mới thay conversations.

### T27 — AI giữ lịch sử và chỉ dùng nguồn phù hợp

**ID:** SUP-20, KNW-03, KNW-04, KNW-06.

**Sửa:** backend `src/modules/assistance-support/assistance-support.service.ts`, `ai-assistance.service.ts`, `assistance-support.module.ts`, `assistance-support.dto.ts`, `infrastructure/assistance-support.repository.ts`, `infrastructure/knowledge.repository.ts`; application interfaces của catalog/commerce/licensing để resolve context; web/mobile timeline và hooks từ T22/T23.

**Contract thiết kế:** một AI request có `clientMessageId` của intent, question được lưu riêng với sender CUSTOMER, answer riêng sender AI; có liên kết request và trạng thái pending/succeeded/failed. Kiểm tra schema/index hiện tại trước thêm field: không dùng cùng unique clientMessageId cho cả hai message nếu unique theo conversation. Retry cùng intent trả cùng question/answer, không gọi model nhiều lần khi kết quả đã có.

- [ ] Viết regression hỏi AI → reload thấy cả hỏi/đáp; provider timeout vẫn có câu hỏi và trạng thái retry; request lặp không tạo hai cặp. Không dùng `appendMessage` hiện tại mà vô tình chuyển AI_ACTIVE sang WAITING_SUPPORT.
- [ ] Commit question/intent trước external AI call, lưu answer và cập nhật last_message_at/updated_at đúng transaction. Không giữ DB lock qua network AI. Nếu hội thoại đóng/chuyển support trong lúc gọi AI, giữ kết quả lịch sử có nhãn phù hợp, không tự mở lại/giành quyền xử lý.
- [ ] Resolve GENERAL/PRODUCT/PLAN/ORDER/LICENSE qua application interfaces, xác nhận ownership đối với private order/license trước search. PLAN/PRODUCT public phải published; không truy repository của module khác trực tiếp để nối tắt.
- [ ] Presales dùng catalog public và tài liệu public đã được phân loại bởi T14; hậu mãi dùng tài liệu có quyền. Người chưa có license không được đọc private knowledge; khi chưa có nguồn đủ, trả no-match với CTA catalog/compare/support có ý nghĩa.
- [ ] Retrieval lọc quyền trước ranking; thay ORDER BY LIKE-only bằng tìm kiếm có điều kiện liên quan và nhánh zero-result. Đánh giá PostgreSQL full-text/token matching hiện hữu với câu hỏi tiếng Việt trước thêm vector service/dependency; không hứa semantic search khi chỉ match literal.
- [ ] Tạo bộ đánh giá gồm câu hỏi đúng sản phẩm, sai sản phẩm, không liên quan, PLAN/ORDER của chính user, license cũ, khách mới, tài liệu private/public. Xác định expected source IDs; query không liên quan phải trả rỗng thay vì 5 đoạn gần nhất.
- [ ] UI timeline dùng persistence thật, có pending/error theo request, retry cùng intent; source metadata/version theo T23. Không giữ câu hỏi chỉ ở local state.

**Test owner:** `backend/test/unit/ai-assistance.service.test.ts`, `assistance-support.service.test.ts`, `knowledge-response.test.ts`, `test/integration/assistance/phase7-assistance.integration.test.ts`; frontend `test/api-backed-screens.test.tsx`; mobile `test/unit/phase3-phase4-screens.test.tsx`.

**Schema/rollout:** nếu phải thêm AI request linkage/status, migration additive tại owner assistance, đồng bộ baseline schema; legacy answer không có question phải ghi rõ không có dữ liệu lịch sử, không sinh câu hỏi giả. Fake AI tests chỉ chứng minh orchestration; chất lượng Gemini cần bộ câu hỏi external riêng.

### T28 — Chia tài liệu theo giới hạn UTF-8

**ID:** KNW-05. **Sửa:** `backend/src/modules/assistance-support/infrastructure/knowledge.repository.ts` chunkText/extractChunks và truyền limits; `knowledge.service.ts`/HTTP error mapping; web `AiKnowledgeScreen.tsx`/knowledgeQueries để hiển thị lỗi thực.

- [ ] Regression dùng ASCII, tiếng Việt có dấu, emoji, dấu tổ hợp, đoạn dài không khoảng trắng; mặc định file 30KB nằm dưới upload limit nhưng phải chia thành nhiều chunk <=12.000 byte.
- [ ] Chunker nhận maxChunkBytes thực từ cấu hình thay vì số 10.000 ký tự cố định; iterate theo Unicode code point để không tách surrogate pair, ưu tiên sentence/paragraph boundary khi trong ngân sách. Không làm mất nội dung có nghĩa hoặc nhân đôi text khi chia.
- [ ] Kiểm tra maxFileBytes/maxChunks/maxChunkBytes độc lập. Input không thể đáp ứng quota trả lỗi có code/limit giúp chọn file khác, không generic 500; đừng chấp nhận loại file nguy hiểm chỉ để tránh false rejection.
- [ ] UI giữ file/đích/version đang chọn khi upload lỗi; sửa file/retry không tạo version thừa (kết hợp T21). Công bố vẫn chờ READY/preview.
- [ ] Test byte count của mọi chunk, nối nội dung theo quy tắc normalization, storage/DB rollback khi extraction/validation lỗi; không có orphan document/storage ngoài ý muốn.

**Test owner:** `backend/test/integration/assistance/phase7-assistance.integration.test.ts`. Tạo có chủ đích `backend/test/unit/knowledge-chunking.test.ts` nếu tách helper nội bộ từ repository là cần thiết để test trực tiếp; không tạo utility Unicode dùng chung toàn project khi chưa có caller khác.

**Bằng chứng lượt review:** phép đếm cục bộ xác nhận 10.000 × ắ =30.000 byte; chưa chạy API upload hoặc PDF parser integration.

### T29 — Thiết bị từ xa và link email đúng thao tác

**ID:** LIC-25, LIC-26.

**Sửa:** web `BuyerLicenseHubScreen.tsx`, `LicenseRecoveryPanel.tsx`, `AuthScreen.tsx`, `application/licenses/licenseQueries.ts`; mobile LicensesScreen/client; backend licensing controller/service/DTO, identity action verification/delivery và Brevo template.

- [ ] Nối hook/API remoteRevokeDevice đã tồn tại vào UI. Mỗi row hiển thị định danh có thể nhận biết, trạng thái và action theo capability; remote revoke xác minh mật khẩu hiện tại + token bound device. Self-revoke chỉ dùng khi có đúng private key thiết bị đích; không suy chỉ từ deviceRef hiển thị nếu backend đã opaque/HMAC.
- [ ] Confirm tên/ID thiết bị và tác động; sau accepted theo dõi command, giữ slot/trạng thái theo server cho đến canonical confirmation. Lỗi/mất mạng/reorg dùng recovery/poll từ T09, không revoke lần hai mù quáng.
- [ ] Thêm bước resolve action context sau đăng nhập: endpoint authenticated nhận token qua body hoặc opaque action intent, trả licenseId/action/deviceId được phép cùng expiresAt; không consume token. Owner/user binding luôn kiểm tra phía server, không decode token trên client như dữ liệu tin cậy.
- [ ] Email nêu hành động và đối tượng an toàn; link tiếp tục đúng intent. Khi mở, chuyển token khỏi URL sang memory/safe handoff theo T09 trước render điều hướng; không ghi token vào log/referrer/analytics.
- [ ] Chọn đúng panel theo action: KEY_RECOVERY, ROTATE_KEY, REVOKE_DEVICE, REMOTE_REVOKE_DEVICE. Không đưa mọi action vào LicenseRecoveryPanel hoặc license đầu danh sách.
- [ ] Thử tài khoản có A/B và nhiều thiết bị, email cho B; login đúng/sai user, token expired/used, link mở hai tab, confirm/cancel. Mở link/resolve không tự thực hiện lệnh hay consume token; submit mới kiểm tra binding và consume atomic.

**Test owner:** backend `test/unit/licensing.service.test.ts`, `identity.service.test.ts`, `brevo-email-delivery.test.ts`, `test/integration/blockchain/phase5-golden-flow.integration.test.ts`; web `test/buyer-hub.test.tsx`, `completed-flows.test.tsx`; mobile `test/unit/license-screens.test.tsx`; mở rộng E2E license hiện có.

**Không đổi invariant:** không bỏ proof đối với self action, không dùng email link như lệnh tự thực thi, không cho remote revoke không xác minh, không công bố secret device/private key.

### T30 — Checkout mobile chỉ xác nhận thông tin thực sự đã tải

**ID:** PAY-22, PAY-23.

**Sửa:** CheckoutScreen/RenewalScreen trong `mobile/src/presentation/EmuKeyMobileApp.tsx`, `mobile/src/infrastructure/api/client.ts`; contract terms/order từ T04/T05. Không tạo endpoint pricing thứ hai.

- [ ] Test create order thành công rồi GET terms timeout/500; kiểm tra checkbox/CTA disabled, lỗi đúng bước và có Retry điều khoản.
- [ ] Tách states order creating/created, terms loading/error/ready và accept pending. Retry terms chỉ đọc cùng orderId; không gọi createOrder mới; reset accepted khi orderId/version/hash đổi.
- [ ] Terms chưa tải/chưa hiển thị đúng snapshot thì không accept dù state accepted cũ true. Backend vẫn bắt exact version/hash ở T05; UI loading không thay thế gate server.
- [ ] Sau create dùng product/plan/price snapshot từ order; route params chỉ là quote hiển thị ban đầu. Khi giá tăng/giảm hoặc điều kiện gói thay đổi, nêu trước/sau, yêu cầu người dùng xem lại; giữ lựa chọn quay lại/hủy theo backend.
- [ ] CTA không tự submit SePay khi state chuyển; thanh toán và retry đi theo T06. Order terminal khi tải terms phải chuyển sang trạng thái terminal, không cho đồng ý trên order hết hạn.
- [ ] Test catalog 100.000 → order 120.000, back/reload, terms stale, accept request response mất; server không tin giá client và không tạo order trùng.

**Test owner:** `mobile/test/unit/phase3-phase4-screens.test.tsx`, `mobile/e2e/phase6-license-flow.yaml`; `backend/test/integration/commerce/commerce-flow.integration.test.ts`. Unit pass không thay Android WebView/SePay test thực.


## 12. Ma trận 11 vấn đề lượt 3

Tất cả còn mở. Nghiệm thu toàn bộ cần đủ 120 dòng ở mục 5, 9 và 12; T16 chạy sau T30 và các task trước.

| ID | Mức | Task | Tiêu chí đóng cụ thể | Đạt |
|---|---|---|---|---|
| SUP-20 | P1 | T27 | Hỏi AI → reload → chuyển nhân viên vẫn thấy đúng cặp hỏi/đáp theo thứ tự; retry không trùng; Gemini lỗi không làm mất câu hỏi. | [ ] |
| SUP-21 | P2 | T26 | Mở queue item chưa claim không phát request messages/alert lỗi; claim thành công tải thread; claim thua người khác có thông báo đúng. | [ ] |
| SUP-22 | P1 | T26 | A claim → release → B claim thành công, messages còn nguyên; A không gửi tiếp sau release; release/close/claim cạnh tranh chỉ một transition hợp lệ. | [ ] |
| KNW-03 | P1 | T27 | Khách không có license hỏi về gói nhận câu trả lời từ catalog public hoặc fallback đúng lý do; không truy được private docs của người khác. | [ ] |
| KNW-04 | P1 | T27 | Cùng khách và product có nguồn: PRODUCT/PLAN/ORDER/LICENSE resolve đúng; order người khác bị từ chối; order chưa cấp license chỉ dùng nguồn public được phép. | [ ] |
| KNW-05 | P1 | T28 | TXT tiếng Việt 30KB dưới tổng giới hạn tạo được nhiều chunk hợp lệ; nối lại không mất nội dung; emoji không bị cắt hỏng; vượt tổng quota có lỗi rõ. | [ ] |
| KNW-06 | P1 | T27 | Câu hỏi không liên quan trả no-match/fallback, từ khóa/ngữ nghĩa trong tập đánh giá trả đúng chunk; không lấy nguồn private để tăng recall. | [ ] |
| LIC-25 | P1 | T29 | Từ máy A thu hồi B qua remote flow không cần private key B; self action trên B không gửi proof A; không giải phóng slot trước canonical confirmation. | [ ] |
| LIC-26 | P1 | T29 | Tài khoản có license A/B: email cho B mở đúng B và đúng rotate/recovery/revoke; account khác bị chặn; mở link không tự thực hiện thao tác hoặc đốt token. | [ ] |
| PAY-22 | P1 | T30 | Tạo order thành công + terms 500: không thể accept, hiện retry, retry chỉ GET terms cùng order; version đổi reset checkbox. | [ ] |
| PAY-23 | P1 | T30 | Catalog 100.000, backend chốt 120.000: UI hiện 120.000 và thay đổi rõ trước chấp thuận; không tự trả tiền, order cũ vẫn giữ giá snapshot. | [ ] |

## 16. Checkpoint tiếp tục remediation — 01/10/2026 20:44

- KNW-01/02: knowledge detail/chunks và publish optimistic version conflict; backend unit **159 tests** pass.
- KNW-03/04: conversation context ORDER/LICENSE ownership và public PLAN/PRODUCT checks; local gates pass, DB integration pending.
- CAT-02: product detail bỏ hardcode 25 devices, chọn public plan đầu tiên; regression app test pass.
- CAT-03/07: compare render đủ entitlement values và CTA mua riêng từng plan.
- SUP-16: order detail có CTA tạo conversation context ORDER qua API ownership-guarded backend.
- PRV-01–06: provider catalog cycle/entitlements/publish/dirty-form batch đã pass frontend gates.
- Final frontend: lint/typecheck/build/OpenAPI pass; 15 files/88 tests.
- Full matrix remains 120/120; unresolved/partial IDs remain explicitly marked, no T16 acceptance claim.


### Đã triển khai thêm

- Khôi phục ma trận **120 dòng** trong `EmuKey_UIUX_Issues.md`; 15 ID chênh lệch với checkpoint 105 là AUTH-01–15, không gộp ngầm.
- AUTH-04/05/06/08/10/11/12/13/14: email verification context, auth error guidance, system search/state guard, reset-token UX, profile clear/sync, role shell profile, validation onBlur.
- PAY-02/03/09/10: mobile idempotency key bền qua timeout/retry, payment deep-link return chỉ re-fetch backend order, labels/order detail tiếng Việt.
- GBL-02, CAT-04: route-specific document title và catalog `q` URL state.
- PRV-01–06: billingCycle tự cập nhật duration, entitlements rỗng gửi `{}`, published plan không cho sửa trực tiếp, dirty-form cancel confirmation.
- LIC-04/19 partial: finality/reorg labels chuẩn hóa ở web.
- Backend OpenAPI generation test environment isolated; frontend/mobile generated clients regenerated through official generator; all three OpenAPI checks pass.

- KNW-01/02: thêm `GET /knowledge/documents/:id` trả metadata/chunks theo provider ownership; publish nhận `expectedCurrentVersion` và reject stale concurrent publish. Regression `knowledge-response.test.ts`; backend unit hiện **159 tests**.


- Backend: lint/typecheck/build pass; unit **33 files / 159 tests pass**; OpenAPI pass.
- Frontend: lint/typecheck/build pass; **15 files / 88 tests pass**; OpenAPI pass.
- Mobile: lint/typecheck/build pass; **4 suites / 12 tests pass**; OpenAPI pass.
- `git diff --check`: pass; Git chỉ cảnh báo LF/CRLF conversion.

### Chưa thể nghiệm thu

- DB integration/migration: `db:verify:terms` vẫn fail vì current DB chưa có snapshot columns; Docker CLI có nhưng daemon unavailable, không reset/apply vào DB hiện tại.
- Android E2E: adb không có device, Maestro chưa cài.
- SePay/Brevo/Gemini/blockchain external: skip vì thiếu sandbox credentials/không tạo giao dịch ngoài phạm vi.
- Các ID trạng thái Chưa triển khai/Đang triển khai/Chờ integration trong ma trận 120 dòng chưa phải nghiệm thu cuối T16.



### Đối chiếu phạm vi

- Full scope được khôi phục là **120 ID**, không phải 105.
- Chính xác 15 ID chênh lệch là **AUTH-01–AUTH-15**. Không có ID bị gộp ngầm; mô tả AUTH được khôi phục từ session/tool history và giữ nguyên ID.
- Ma trận đầy đủ 120 ID, trạng thái `chưa triển khai / đang triển khai / đã sửa kiểm tra cục bộ / chờ integration-E2E` nằm tại `EmuKey_UIUX_Issues.md`.

### Batch đã triển khai thêm

- AUTH-04: email verification URL thêm email; test Brevo xác nhận query chứa email.
- AUTH-05/06: login UI giữ mã backend và hiển thị guidance cho unverified/locked/rate-limit.
- AUTH-08/10: System console có search `q`, không lock tài khoản DISABLED, dùng `requestJson/describeApiError`.
- AUTH-11: reset token lấy từ URL và field token bị ẩn; lỗi có CTA yêu cầu link mới.
- PAY-02: mobile idempotency key được giữ trong SecureStore theo user+intent cho đến khi server response thành công.
- PAY-03: mobile WebView xử lý `emukey://payment/*`, đóng WebView và đọc lại order từ backend; callback không tự xác nhận thanh toán.
- PAY-09/10: mobile thanh toán hiển thị status tiếng Việt và OrderDetail hiển thị sản phẩm/gói/giá/thời hạn/thiết bị.
- OpenAPI: backend generator dùng test env cô lập (`SEPAY_SANDBOX_RECEIPT_TIMING=false`); backend/frontend/mobile OpenAPI generate/check pass; generated clients không sửa tay.

### Gate và blocker hiện tại

- Backend: lint/typecheck/build/unit `33 files / 159 tests` pass; OpenAPI pass.
- Frontend: lint/typecheck/build/test `15 files / 88 tests` pass; OpenAPI client check pass.
- Mobile: lint/typecheck/build/test `4 suites / 12 tests` pass; OpenAPI client check pass.
- `db:verify:terms`: fail đúng vì DB hiện tại chưa áp dụng migration terms snapshot; không reset/apply vào DB chứa dữ liệu.
- Docker: CLI hiện diện nhưng daemon unavailable; Testcontainers/integration skip.
- Android: adb không có device; Maestro chưa cài; Android E2E skip.
- External provider flows (SePay/Brevo/Gemini/blockchain) skip do thiếu credentials/sandbox boundary.
- `git diff --check`: pass, chỉ cảnh báo line ending LF/CRLF.

### Bảo đảm giữ nguyên

Không tự accept terms, không coi payment redirect/IPN callback là proof thanh toán, không retry mù consume key, không bỏ ownership/role/proof/finality, và không lưu token/secret vào URL/log/cache không phù hợp.

## 17. Checkpoint sửa lỗi 02/10/2026

- Sửa SecureStore key cho order intent, activation key và device identity; kiểm tra retry khi mất phản hồi.
- Publish knowledge gửi observed version từ web; 0 biểu thị chưa có current. PostgreSQL advisory lock bảo vệ lần publish đầu và publish cạnh tranh. Conflict được trả HTTP 409 giữ mã lỗi, UI cho tải lại danh sách.
- Đồng bộ OpenAPI backend/web/mobile và regenerate; check phát hiện input client cũ khi backend cùng có trong checkout.
- Khôi phục dependencies mobile theo frozen lockfile; sửa fixture terms thiếu version/hash và fixture checkout web tự hết hạn theo lịch.
- Ma trận chi tiết đã đủ 120 dòng unique, gồm 7 PRV; AUTH-13 theo mã RoleShell đã có Hồ sơ. Không nghiệm thu các ID còn mở.
- Gates: backend 33 files / 160 unit tests; frontend 15 files / 89 tests; mobile 5 suites / 14 tests. Lint/typecheck/build/OpenAPI cả ba pass.
- Integration PostgreSQL: 6 files / 24 tests pass, 2 blockchain tests skip. Docker đã hoạt động. Knowledge có regression PostgreSQL và HTTP 409/400/403; không thay thế acceptance đầy đủ cho KNW-03/04.
- DB hiện tại vẫn chưa apply snapshot migration; không reset DB. Android và external sandbox chưa chạy. Không commit/push/deploy.

Chi tiết gate và trạng thái hiện tại: `EmuKey_UIUX_Issues.md`, mục 2 và 6.

## 18. Review tiếp ngày 02/10/2026

Đã sửa payload chấp nhận điều khoản ở web/mobile để gửi đúng version/hash đã hiển thị, gate tải điều khoản và retry cùng đơn cho gia hạn mobile, giá snapshot gia hạn, HTTP 404 cho knowledge detail và PLAN context không public khi product cha DRAFT/ARCHIVED.

Test: backend 161 unit, PostgreSQL integration 25 pass / 2 blockchain skip, frontend 89, mobile 16. Chi tiết hiện tại xem `EmuKey_UIUX_Issues.md` mục 7. Không coi các test này là nghiệm thu đầy đủ retrieval/AI, Android hoặc external sandbox; DB có dữ liệu chưa apply migration.

## 19. Review toàn nhóm luồng ngày 02/10/2026

### Kế hoạch hoàn thiện luồng ứng dụng theo yêu cầu tiếp theo

- [ ] Thông báo: thêm cursor phía backend, tải tiếp web/mobile, xử lý lỗi đọc và điều hướng target; kiểm tra ownership và nhiều trang trên PostgreSQL.
- [ ] Auth: đăng ký ghi nhận yêu cầu gửi email bền vững cùng user; worker retry qua adapter hiện tại; resend/reset có trạng thái rõ; kiểm tra delivery thất bại không tạo tài khoản mắc kẹt.
- [ ] License web/mobile: remote revoke và rotation có xác nhận, đúng action token, trạng thái finality, tiếp tục theo command ID; không lưu activation secret hoặc mật khẩu vào URL/storage.
- [ ] AI trước mua: chỉ đưa dữ liệu catalog đã công bố vào nguồn công khai; giữ tài liệu knowledge riêng sau entitlement; hiện citation và hành động chuyển nhân viên khi không đủ nguồn.
- [ ] Thanh toán/support/global: hoàn thiện các hành động còn thiếu từ ma trận, receipt/history/cancel/review, retry và navigation/a11y; đối chiếu từng mục với test thực tế.
- [ ] Regenerate OpenAPI, chạy focused → unit/integration → lint/typecheck/build, cập nhật trạng thái từng ID và danh sách E2E thật còn phụ thuộc môi trường.

Module hiện tại sẽ được mở rộng; không tạo API client hoặc database connection song song. Migration nếu cần chỉ chạy trên PostgreSQL cô lập. Không commit/push/deploy/reset DB. Các ID chưa khôi phục mô tả gốc giữ nguyên ghi chú, không tự đặt yêu cầu để đánh dấu hoàn tất.

Đã sửa 10 nhóm lỗi ở đổi mật khẩu, thông báo, URL search, CTA hỗ trợ đơn, grounded/citation AI, trạng thái hội thoại, retry tin nhắn/câu trả lời, retrieval ORDER/PLAN, email recovery và snapshot quyền lợi. Chi tiết bằng chứng và giới hạn ở `EmuKey_UIUX_Issues.md` mục 8.

Gates mới: backend 166 unit; integration 27 pass / 2 blockchain skip; security 15; frontend 90; mobile 16; Playwright 16 buyer regressions + 6 workspace tests. Các browser test dùng API mock. Lint/typecheck/build/OpenAPI cả ba pass; build mobile là Expo export, chưa chạy thiết bị. Các ID chưa triển khai/chờ integration không được nâng thành nghiệm thu T16.


