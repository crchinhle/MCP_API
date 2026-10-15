# EmuKey — Báo cáo kiểm tra luồng UX

> Tài liệu tổng hợp 120 ID UX/UI theo phạm vi người dùng yêu cầu. Giữ nguyên ID để truy vết; trạng thái bên dưới phân biệt code/test local với kiểm chứng integration/E2E.

**Cập nhật gần nhất:** 02/10/2026 — sửa SecureStore/publish knowledge; hợp nhất ma trận đủ 120 ID. Kết quả mới nằm tại checkpoint 02/10; chưa nghiệm thu toàn bộ T16.

## 1. Phạm vi và nguồn trạng thái

Ma trận ở mục 2 là nguồn trạng thái duy nhất: **120 dòng / 120 ID unique**. Phân bố: AUTH 15, PAY 23, LIC 26, SUP 22, GBL 10, CAT 7, PRV 7, KNW 6, NTF 2, HOM 1, OPS 1.

Chênh lệch với checkpoint 105 là AUTH-01–AUTH-15. Không suy đoán các mô tả lịch sử chưa khôi phục. Đủ ID không đồng nghĩa đã nghiệm thu T16.

## 2. Ma trận trạng thái đủ 120 ID

> Các dòng dưới đây giữ nguyên ID để truy vết. Một số mô tả chi tiết của báo cáo lịch sử không còn trong checkpoint hiện tại; phần đó được ghi là “chưa khôi phục mô tả”, không suy đoán nội dung. Trạng thái chỉ dựa trên code/test đã đọc và chạy.

| ID | Trạng thái | Bằng chứng ngắn |
|---|---|---|
| AUTH-01 | Đã sửa, kiểm tra cục bộ | refresh/logout session tests |
| AUTH-02 | Đã sửa, kiểm tra cục bộ | logout finally/session tests |
| AUTH-03 | Đã sửa, kiểm tra cục bộ | PUT dùng authenticated requestJson; min 12 ký tự/onBlur; Playwright kiểm tra Bearer |
| AUTH-04 | Chờ integration/E2E | verification URL email field; Brevo external pending |
| AUTH-05 | Đã sửa, kiểm tra cục bộ | backend error code/message mapping |
| AUTH-06 | Đã sửa, kiểm tra cục bộ | login guidance by code/status |
| AUTH-07 | Chưa triển khai | durable registration/email delivery semantics |
| AUTH-08 | Đã sửa, kiểm tra cục bộ | user search + DISABLED action guard |
| AUTH-09 | Đã sửa, kiểm tra cục bộ | dedicated forbidden route |
| AUTH-10 | Đã sửa, kiểm tra cục bộ | requestJson/describeApiError system console |
| AUTH-11 | Đã sửa, kiểm tra cục bộ | URL token hidden + new-link CTA |
| AUTH-12 | Đang triển khai | DTO clear-field + form sync; acceptance test pending |
| AUTH-13 | Đã sửa, kiểm tra cục bộ | RoleShell có Hồ sơ cho System/Support; E2E chưa chạy |
| AUTH-14 | Đang triển khai | password validation timing still needs UX test |
| AUTH-15 | Đã sửa, kiểm tra cục bộ | mobile forgot-password flow |
| PAY-01 | Đã sửa, kiểm tra cục bộ | mobile renewal no activation secret |
| PAY-02 | Chờ integration/E2E | SecureStore key hợp lệ; network-failure/retry unit pass; Android E2E pending |
| PAY-03 | Chờ integration/E2E | WebView deep link reloads backend order |
| PAY-04 | Đã sửa, kiểm tra cục bộ | explicit web checkout intent |
| PAY-05 | Đang triển khai | receipt/history UI boundary pending |
| PAY-06 | Đang triển khai | review state UI partial |
| PAY-07 | Đang triển khai | cancellation path partial |
| PAY-08 | Chờ integration/E2E | terms migration not applied to current DB |
| PAY-09 | Đã sửa, kiểm tra cục bộ | mobile Vietnamese payment states |
| PAY-10 | Đã sửa, kiểm tra cục bộ | mobile OrderDetail snapshot fields |
| PAY-11 | Chờ integration/E2E | commerce PostgreSQL integration pass trên Docker cô lập; external sandbox chưa chạy |
| PAY-12 | Đã sửa, kiểm tra cục bộ | explicit checkout submission |
| PAY-13 | Đã sửa, kiểm tra cục bộ | server payment expiry displayed |
| PAY-14 | Đã sửa, kiểm tra cục bộ | OrderSummary server snapshot |
| PAY-15 | Đã sửa, kiểm tra cục bộ | status labels |
| PAY-16 | Đã sửa, kiểm tra cục bộ | review classifications |
| PAY-17 | Đã sửa, kiểm tra cục bộ | compare/catalog CTA |
| PAY-18 | Đã sửa, kiểm tra cục bộ | entitlement value rendering |
| PAY-19 | Đã sửa, kiểm tra cục bộ | mobile comparison values |
| PAY-20 | Chờ integration/E2E | provider timestamp unit pass |
| PAY-21 | Đang triển khai | support/order context partial |
| PAY-22 | Đã sửa, kiểm tra cục bộ | checkout/renewal terms gate, retry cùng order; web/mobile gửi version/hash |
| PAY-23 | Đã sửa, kiểm tra cục bộ | checkout và renewal mobile dùng giá snapshot, cảnh báo thay đổi |
| LIC-01 | Đã sửa, kiểm tra cục bộ | retrieve confirmation |
| LIC-02 | Đang triển khai | rotation resume UI pending |
| LIC-03 | Đã sửa, kiểm tra cục bộ | verification error mapping |
| LIC-04 | Đang triển khai | finality labels partial |
| LIC-05 | Đã sửa, kiểm tra cục bộ | activation gate/error mapping |
| LIC-06 | Đang triển khai | recovery UI pending |
| LIC-07 | Đã sửa, kiểm tra cục bộ | payment-to-license CTA |
| LIC-08 | Đã sửa, kiểm tra cục bộ | renewal preview |
| LIC-09 | Đã sửa, kiểm tra cục bộ | provider command labels |
| LIC-10 | Đã sửa, kiểm tra cục bộ | row-specific pending |
| LIC-11 | Đang triển khai | recovery ETA/cancel pending |
| LIC-12 | Đã sửa, kiểm tra cục bộ | polling backoff/error clear |
| LIC-13 | Đang triển khai | status/action UX partial |
| LIC-14 | Đang triển khai | status/action UX partial |
| LIC-15 | Đang triển khai | status/action UX partial |
| LIC-16 | Đang triển khai | status/action UX partial |
| LIC-17 | Đang triển khai | status/action UX partial |
| LIC-18 | Đã sửa, kiểm tra cục bộ | refresh/action pending states |
| LIC-19 | Đang triển khai | per-action retry incomplete |
| LIC-20 | Đang triển khai | entitlement memory/TTL incomplete |
| LIC-21 | Đang triển khai | clipboard dependency/device test pending |
| LIC-22 | Đang triển khai | status/action UX partial |
| LIC-23 | Đang triển khai | status/action UX partial |
| LIC-24 | Đang triển khai | status/action UX partial |
| LIC-25 | Chờ integration/E2E | remote revoke UI/device E2E pending |
| LIC-26 | Chờ integration/E2E | web resolve đúng license/action, xóa token URL, retry lỗi mạng; Playwright mock pass; email thật pending |
| SUP-01 | Đã sửa, kiểm tra cục bộ | customer escalation CTA/contract |
| SUP-02 | Đã sửa, kiểm tra cục bộ | support/message polling |
| SUP-03 | Đã sửa, kiểm tra cục bộ | reason/system message |
| SUP-04 | Đang triển khai | AI fallback UI partial |
| SUP-05 | Đã sửa, kiểm tra cục bộ | notification polling |
| SUP-06 | Đang triển khai | support workflow partial |
| SUP-07 | Đã sửa, kiểm tra cục bộ | claim/release controls |
| SUP-08 | Đang triển khai | support workflow partial |
| SUP-09 | Đã sửa, kiểm tra cục bộ | mobile foreground polling |
| SUP-10 | Đã sửa, kiểm tra cục bộ | mobile unread badge |
| SUP-11 | Đang triển khai | web Xem thêm trong popover theo từng 8 mục; server pagination còn mở |
| SUP-12 | Đã sửa, kiểm tra cục bộ | public help search |
| SUP-13 | Đã sửa, kiểm tra cục bộ | per-conversation drafts |
| SUP-14 | Đã sửa, kiểm tra cục bộ | stale request generation guard |
| SUP-15 | Đã sửa, kiểm tra cục bộ | explicit clientMessageId |
| SUP-16 | Đã sửa, kiểm tra cục bộ | order CTA giữ drawer khi lỗi, hiện lỗi và retry; Playwright pass |
| SUP-17 | Đã sửa, kiểm tra cục bộ | close/read-only conversation |
| SUP-18 | Đang triển khai | source metadata pending |
| SUP-19 | Đã sửa, kiểm tra cục bộ | maxLength/counter |
| SUP-20 | Đã sửa, kiểm tra cục bộ | question persistence/idempotency |
| SUP-21 | Đã sửa, kiểm tra cục bộ | queue preview |
| SUP-22 | Đã sửa, kiểm tra cục bộ | release endpoint/UI |
| GBL-01 | Đã sửa, kiểm tra cục bộ | error boundary |
| GBL-02 | Đã sửa, kiểm tra cục bộ | lang + route document.title |
| GBL-03 | Đã sửa, kiểm tra cục bộ | forbidden page |
| GBL-04 | Đang triển khai | skip/mobile navigation partial |
| GBL-05 | Đang triển khai | error consistency partial |
| GBL-06 | Đã sửa, kiểm tra cục bộ | accessibility roles/states |
| GBL-07 | Đã sửa, kiểm tra cục bộ | per-action error clearing partial |
| GBL-08 | Đã sửa, kiểm tra cục bộ | 404 route |
| GBL-09 | Đã sửa, kiểm tra cục bộ | loading vs empty |
| GBL-10 | Đang triển khai | responsive/accessibility E2E pending |
| CAT-01 | Đã sửa, kiểm tra cục bộ | comparison purchase CTA |
| CAT-02 | Đã sửa, kiểm tra cục bộ | product detail chọn public plan đầu tiên; không hardcode 25 devices |
| CAT-03 | Đã sửa, kiểm tra cục bộ | entitlement false/zero/object values giữ nguyên |
| CAT-04 | Đã sửa, kiểm tra cục bộ | search lấy từ URL; Playwright kiểm tra thay đổi history khi component còn mounted |
| CAT-05 | Đã sửa, kiểm tra cục bộ | catalog search |
| CAT-06 | Đã sửa, kiểm tra cục bộ | four-plan selection gate |
| CAT-07 | Đã sửa, kiểm tra cục bộ | each comparison column has its own buy CTA |
| PRV-01 | Đã sửa, kiểm tra cục bộ | billing cycle/duration sync |
| PRV-02 | Đã sửa, kiểm tra cục bộ | empty entitlements sends `{}` |
| PRV-03 | Đã sửa, kiểm tra cục bộ | published edit guard |
| PRV-04 | Đã sửa, kiểm tra cục bộ | dirty-form confirmation |
| PRV-05 | Đã sửa, kiểm tra cục bộ | provider form state preserved |
| PRV-06 | Đã sửa, kiểm tra cục bộ | provider catalog validation |
| PRV-07 | Chưa triển khai | chưa khôi phục mô tả gốc |
| KNW-01 | Đã sửa, kiểm tra cục bộ | detail/chunks + version guard; PostgreSQL concurrency và HTTP 409/400/403 đã kiểm tra |
| KNW-02 | Đã sửa, kiểm tra cục bộ | detail/chunks + version guard; PostgreSQL concurrency và HTTP 409/400/403 đã kiểm tra |
| KNW-03 | Chờ integration/E2E | PLAN parent public và retrieval theo license đã kiểm tra PostgreSQL; nguồn presales public chưa triển khai |
| KNW-04 | Chờ integration/E2E | ORDER/PLAN retrieval và customer isolation đã kiểm tra PostgreSQL; toàn bộ AI acceptance còn mở |
| KNW-05 | Đã sửa, kiểm tra cục bộ | UTF-8 byte-safe chunking |
| KNW-06 | Đã sửa, kiểm tra cục bộ | relevance gate |
| NTF-01 | Chờ integration/E2E | mapper unit pass; PostgreSQL HTTP pending |
| NTF-02 | Chờ integration/E2E | target/read mapping; PostgreSQL HTTP pending |
| HOM-01 | Chưa triển khai | chưa khôi phục mô tả gốc |
| OPS-01 | Chưa triển khai | chưa khôi phục mô tả gốc |

## 3. Checkpoint lịch sử 01/10/2026 20:11

> Bằng chứng tại thời điểm cũ; xem checkpoint 02/10 cho kết quả mới.

- AUTH-04/05/06/08/10/11: backend email verify URL, frontend error guidance, system search/state guard, reset-token UX đã có code và targeted/full tests; Brevo integration vẫn chờ.
- AUTH-12/13: profile clear-field DTO và `initialValues` sync đã sửa; System profile navigation vẫn cần hoàn thiện.
- PAY-02/03/09/10: mobile idempotency persistence, `emukey://payment/*` return handling và Vietnamese payment/order-detail labels đã sửa; 12 mobile tests pass, Android/SePay E2E chờ.
- GBL-02: route-specific `document.title` đã sửa.
- CAT-04/07 (một phần): catalog search `q` được giữ trên URL để reload/back-forward không mất lọc.
- LIC-04/19 (một phần): finality/reorg labels chuẩn hóa ở web; retry/action granularity vẫn cần tiếp tục.
- OpenAPI backend/frontend/mobile generate/check: **pass** bằng generator chính thức; không sửa tay generated files.
- AUTH-12: profile DTO cho phép clear optional fields và form sync theo user hiện tại; frontend/backend gates pass.
- AUTH-13/14: System/Support shell có Hồ sơ trực tiếp; login validation chạy onBlur; cần test accessibility/UX chuyên sâu.
- PRV-01/02/03/04/05/06: billing cycle tự đồng bộ duration, entitlements rỗng gửi `{}`, published plan không sửa trực tiếp, dirty-form cancel có confirm; frontend gates pass.
- Catalog: filter `q` giữ trong URL; route document title cập nhật theo màn hình.

- KNW-01/02: provider knowledge detail trả chunks theo thứ tự; publish khóa current row và reject `KNOWLEDGE_VERSION_CONFLICT` khi expected version stale. Regression `knowledge-response.test.ts`; backend unit hiện 159 tests.
- KNW-03/04: conversation context ORDER/LICENSE được kiểm tra ownership customer; PLAN/PRODUCT chỉ nhận bản công bố public. Backend unit pass; PostgreSQL integration còn blocked vì Docker daemon.

- CAT-02: product detail chọn gói public đầu tiên thay vì hardcode 25 thiết bị; regression `app.test.tsx` đã cập nhật, frontend 88 tests pass.
- CAT-03/CAT-07: bảng so sánh hiển thị đầy đủ boolean/number/object entitlement và có CTA mua theo từng cột/gói; frontend 88 tests pass.

| Gate | Kết quả |
|---|---|
| Backend lint/typecheck/build | Pass |
| Backend unit | Pass — 33 files / 159 tests |
| Backend OpenAPI generate/check | Pass |
| Frontend lint/typecheck/build | Pass |
| Frontend tests | Pass — 15 files / 88 tests |
| Mobile lint/typecheck/build | Pass |
| Mobile tests | Pass — 4 suites / 12 tests |
| `git diff --check` | Pass; chỉ cảnh báo line ending LF/CRLF |
| `db:verify:terms` | Fail — current DB thiếu 3 snapshot columns; không reset/apply vào DB đang có dữ liệu |
| Backend integration/Testcontainers | Skip/blocked — Docker CLI có nhưng daemon unavailable |
| Android/Maestro | Skip/blocked — adb không có device, Maestro chưa cài |
| External SePay/Brevo/Gemini/blockchain | Skip — không credentials/giao dịch ngoài phạm vi |

## 4. API/schema/config đã thay đổi

- `orders.service_terms_version_snapshot`, `service_terms_hash_snapshot`, `service_terms_content_snapshot` và immutability guard; migration `backend/database/migrations/20260930-order-service-terms-snapshot.sql` chưa áp dụng vào DB hiện tại.
- `OrderTermsDto`/`AcceptServiceTermsDto` thêm version/hash.
- `AiAskDto.clientMessageId` và `RequestSupportDto.reason` bắt buộc; web/mobile callers đã cập nhật; generated OpenAPI clients đã regenerate.
- Notification public mapper camelCase + allowlisted target.
- `POST /licenses/action-verification/resolve`, queue preview và conversation release.
- OpenAPI generation test env explicitly disables sandbox receipt timing; không nới runtime validation.

## 5. Blockers còn lại

- Docker daemon đã hoạt động; integration chạy trên container cô lập. DB hiện tại vẫn thiếu snapshot columns, chưa áp dụng migration vào DB có dữ liệu.
- Cần Android emulator/device + Maestro/test identity cho WebView/deep-link/remote revoke E2E.
- Cần external provider sandbox credentials nếu muốn kiểm tra SePay/Brevo/Gemini/blockchain thật; không tạo giao dịch thật.
- Các ID trạng thái “Chưa triển khai/Đang triển khai” ở ma trận trên không được coi là nghiệm thu.

## 6. Checkpoint sửa lỗi 02/10/2026

- PAY-02: intent SecureStore dùng SHA-256 hex từ user + payload; giữ key khi mất phản hồi, xóa sau khi nhận order. Sửa dấu `:` không hợp lệ ở key activation/device. Test gọi API client thật với SecureStore mock kiểm tra đúng tập ký tự native.
- KNW-01/02: web gửi `expectedCurrentVersion`, dùng 0 khi chưa có bản công bố; conflict hiển thị hướng dẫn tải lại. Backend khóa theo provider + logical document trước khi đọc current version, kiểm tra cả trường hợp chưa có current; trả HTTP 409 với `KNOWLEDGE_VERSION_CONFLICT`.
- PostgreSQL regression kiểm tra first publish cạnh tranh, stale version và provider ownership; HTTP kiểm tra 409/400/403. Không suy rộng thành đã nghiệm thu KNW-03/04.
- Đồng bộ OpenAPI web/mobile từ backend và regenerate. Check nay phát hiện input client lệch backend khi chạy trong monorepo; vẫn hỗ trợ checkout standalone.
- Khôi phục dependencies mobile bằng `pnpm install --frozen-lockfile`; không đổi lockfile. Fixture terms có version/hash; fixture checkout web dùng hạn tương đối để không tự hết hạn khi sang ngày mới.
- Mục 2 có đúng **120 dòng / 120 ID unique**, gồm 7 PRV; bỏ bảng trạng thái trùng và cập nhật AUTH-13 theo RoleShell hiện tại.

| Gate chạy trong lượt sửa | Kết quả |
|---|---|
| Backend lint/typecheck/build/OpenAPI | Pass |
| Backend unit | 33 files / 160 tests pass |
| Backend integration, RUN_PHASE7_INTEGRATION=true | 6 files / 24 tests pass; 2 blockchain tests skip do thiếu cấu hình EVM local |
| Frontend lint/typecheck/build/OpenAPI | Pass |
| Frontend tests | 15 files / 89 tests pass |
| Mobile lint/typecheck/build/OpenAPI | Pass; build là Expo Android export, không phải device E2E |
| Mobile tests | 5 suites / 14 tests pass |
| Ma trận / workspace hygiene / diff check | 120 unique / pass / pass |

DB có dữ liệu chưa được áp dụng migration snapshot. Android/device, external sandbox và các ID đang mở vẫn chưa nghiệm thu T16. Không commit/push/deploy. Cảnh báo không chặn gate còn có jsdom getComputedStyle, Vite chunk size và Metro package export fallback.

## 7. Review tiếp ngày 02/10/2026

- Tái hiện và sửa việc web/mobile gửi thiếu version/hash khi chấp nhận điều khoản. Cả checkout, chi tiết đơn web và gia hạn gửi metadata của điều khoản đã hiển thị; không tự lấy bản mới để thay thế consent.
- Gia hạn mobile không cho đồng ý khi GET terms lỗi; retry chỉ đọc điều khoản cùng order, không tạo đơn mới. Hiển thị giá snapshot sau khi tạo đơn và cảnh báo chênh giá. Đơn đã qua bước đồng ý tiếp tục sang Payment, không accept lại.
- Web reset consent khi order/version/hash đổi và chặn submit khi terms đang refetch/lỗi.
- Knowledge detail trả 404 với mã `KNOWLEDGE_DOCUMENT_NOT_FOUND` thay vì generic 500. Unit và HTTP regression pass.
- PLAN context yêu cầu cả plan và product ở trạng thái PUBLISHED. PostgreSQL regression kiểm tra product DRAFT/PUBLISHED/ARCHIVED. Retrieval public/ORDER/LICENSE và toàn bộ KNW-03/04 chưa được nghiệm thu.
- Kết quả test mới: backend **33 files / 161 unit tests**, integration **6 files / 25 tests pass, 2 blockchain tests skip**; frontend **15 files / 89 tests**; mobile **5 suites / 16 tests**.
- Không thêm dependency/migration, không apply vào DB có dữ liệu; giữ nguyên các thay đổi của lượt trước. Android và external sandbox vẫn chưa chạy.

## 8. Review luồng và sửa lỗi tiếp ngày 02/10/2026

Đợt này phát hiện và sửa 10 nhóm lỗi. Đây là bằng chứng cục bộ, không phải nghiệm thu toàn bộ 120 ID:

1. Đổi mật khẩu web thiếu Bearer token: dùng requestJson, đồng bộ minimum 12 ký tự với backend, validation onBlur và popover vừa màn hình nhỏ.
2. Thông báo vượt 8 mục dẫn tới route không tồn tại: chuyển sang Xem thêm ngay trong popover, có lỗi khi đánh dấu đã đọc thất bại.
3. Tìm kiếm catalog không theo thay đổi URL/history: URL là nguồn dữ liệu của ô tìm kiếm.
4. Tạo hỗ trợ từ đơn hàng bị lỗi không có phản hồi: giữ drawer, hiện lỗi và cho thử lại.
5. AI được đánh dấu grounded khi không có citation: từ chối câu trả lời không trích nguồn hợp lệ.
6. AI vẫn ghi tin vào hội thoại CLOSED hoặc đã chuyển nhân viên: kiểm tra trạng thái dưới khóa transaction, trả conflict; áp dụng cả câu trả lời đang xử lý khi trạng thái thay đổi.
7. Retry tin nhắn cùng ID nhưng nội dung khác: trả conflict. Retry câu trả lời AI trả nội dung đã lưu thay vì kết quả mới khác lịch sử. Chưa tối ưu tránh gọi gateway lần nữa khi retry.
8. ORDER/PLAN không lấy được knowledge dù khách có license: bổ sung truy xuất đúng context, giữ điều kiện entitlement và ownership. PostgreSQL test tạo license qua payment ingestion, kiểm tra khách khác và khách chưa có license không đọc được tài liệu riêng.
9. Email action token bị gắn vào license đầu tiên: resolve qua backend, mở đúng license/action, xóa token khỏi URL; chỉ KEY_RECOVERY đi vào form recovery. Lỗi mạng có retry; action thiết bị/rotation hướng dẫn quay lại ứng dụng thực hiện.
10. Snapshot quyền lợi đơn hàng bỏ false/0 và hiển thị object sai: giữ đủ giá trị trong OrderSummary và drawer.

| Gate | Kết quả mới nhất |
|---|---|
| Backend lint/typecheck/build/OpenAPI | Pass |
| Backend unit | 33 files / 166 tests pass |
| Backend PostgreSQL/Redis integration | 6 files / 27 tests pass; DB/application invariants tested without blockchain runtime |
| Security scan + negative tests | Pass; 2 files / 15 tests |
| Frontend lint/typecheck/build/OpenAPI | Pass |
| Frontend unit/component | 15 files / 90 tests pass |
| Playwright buyer regressions | 16 tests pass; API mock, không phải thanh toán/email thật |
| Playwright workspace navigation | 6 tests pass, bao phủ 15 route/view Provider/Support/System ở 390px và 1280px; API mock |
| Mobile lint/typecheck/build/OpenAPI | Pass; Expo Android export |
| Mobile unit | 5 suites / 16 tests pass |

Các nhóm AUTH/PAY/LIC/SUP/GBL/CAT/PRV/KNW/NTF được đối chiếu mã nguồn và các bộ kiểm tra trên; không suy rộng smoke navigation thành nghiệm thu mọi thao tác CRUD hoặc mọi failure state. HOM-01/OPS-01/PRV-07 vẫn thiếu mô tả gốc.

Chưa thể kết luận toàn bộ luồng đã chuẩn UX. Phần còn mở gồm delivery email đăng ký bền vững (AUTH-07), rotation/resume và remote revoke đầy đủ trên web, phân loại tài liệu công khai để AI hỗ trợ trước mua, Android device/deep-link, email/payment/AI/blockchain sandbox. Cảnh báo còn có Vite chunk size, jsdom pseudo-style và Metro package export fallback.

## 9. Cập nhật triển khai ngày 02/10/2026

- **Đã viết code:** backend notification có cursor ổn định `(created_at, id)`, giới hạn 1–50, trả `{items,nextCursor}`; web dùng infinite query và tải thêm từ backend; mobile giữ `readAt/target`, tải thêm và kiểm tra lỗi mutation bằng `json()`; worker đã import `OperationsModule` để đăng ký notification processor/scheduler. Reset password kiểm tra lại customer không DISABLED trước khi cập nhật.
- **Đã triển khai trên môi trường demo:** migration additive `20260930-order-service-terms-snapshot.sql` đã áp dụng trên Neon demo, không reset/xóa dữ liệu. `db:verify:terms` trả `REAL_VERIFIED`, 18 bảng, đủ ba cột snapshot và trigger.
- **Đã kiểm chứng:** backend unit 33 file/166 test pass trước patch; notification contract sau patch pass; web 15 file/90 test pass trước patch; mobile 5 suite/16 test pass sau patch; backend/frontend/mobile typecheck pass; backend lint pass. Đây là kiểm chứng code/Neon schema, chưa phải nghiệm thu external E2E.
- **Chưa nghiệm thu luồng thật:** Redis vẫn cấu hình `redis://127.0.0.1:6379` và không reachable; chưa có domain HTTPS/CORS callback được xác định; chưa chạy worker queue thật, Brevo email tới hộp thư chỉ định, Gemini thật qua luồng UI, SePay sandbox callback, hoặc giao dịch Sepolia có transaction hash/receipt/indexer finality. Mobile chưa kiểm tra trên thiết bị Android thật.
- Không ghi secret/credential vào bằng chứng; không commit, push, reset hoặc deploy công khai.

## 10. B2B activation authorization 03/10/2026

- License/customer ownership xác định tài khoản được quyền quản lý License; không dùng để cấp quyền activate phần mềm.
- Activation key là bearer activation credential do quản trị viên doanh nghiệp cung cấp. Thiết bị không cần purchaser/customer session để tạo challenge hoặc activate.
- Backend resolve License từ activation key commitment, kiểm tra License usable/quota, challenge một lần và EIP-191 device proof. Activation không chuyển ownership, không tạo customer và không cấp management permission.
- Entitlement issue/refresh/verify là device protocol; kiểm tra license lifecycle, device ACTIVE, binding generation, key version và proof, không kiểm tra purchaser identity. Device state vẫn do PostgreSQL sở hữu; không thêm blockchain wait hoặc per-device finality.
- Các API list/license details/key retrieve/rotate/recover/renew/device management/lifecycle vẫn giữ ownership và role checks.

## 12. Refactor kiến trúc thiết bị 02/10/2026

- Individual device state is operational data owned by PostgreSQL. Blockchain does not store device identity. Blockchain stores only an asynchronously synchronized aggregate active-device count. License lifecycle finality remains on-chain.
- Activation/revoke ghi trạng thái `ACTIVE`/`REVOKED` trong cùng transaction PostgreSQL, khóa license để enforce quota và tăng `device_state_version`; entitlement không chờ device chain event.
- `SYNC_DEVICE_COUNT` là command bất đồng bộ, chỉ chứa aggregate count/version; retry hoặc reorg chỉ cập nhật reconciliation metadata, không sửa `license_devices`.
- Migration `backend/database/migrations/20261002-device-postgres-source-of-truth.sql` chuyển legacy `PENDING_ONCHAIN` đã qua flow cũ sang `ACTIVE` với `activated_at=created_at`, giữ nguyên chain history.
- Contract surface mới là `syncActiveDeviceCount`; cần deploy contract version mới lên testnet trước khi chạy relayer thật. Lượt này chỉ compile/test/ABI export, chưa deploy testnet.

### Verification refactor thiết bị

- Backend unit: 33 files / 166 tests pass.
- Contract: compile, 6 tests và public-surface check pass; ABI đã export.
- Frontend: lint, typecheck, 15 files / 90 tests, build và OpenAPI check pass.
- Mobile: lint, typecheck, 5 suites / 16 tests, Expo Android export và OpenAPI check pass.
- Chưa chạy PostgreSQL integration concurrency trong lượt này; chưa có bằng chứng external testnet/Android device.
