# EmuKey — audit, remediation và bằng chứng kiểm chứng 17/11/2026

Baseline: `562bbc6` (`kiem tra chuc nang`), working tree ban đầu sạch. Không tạo commit/branch, push, deploy, reset database vận hành, gửi thanh toán thật hay gửi email/push tới người dùng thật. Schema vật lý `EmuKey/backend/database/schema.sql` không thay đổi.

Đây là báo cáo theo từng boundary, **không phải chứng nhận production-ready**. Inventory 34 capability ở [feature inventory](2026-11-17-feature-inventory.md). Kế hoạch và phạm vi mở rộng có bằng chứng ở [audit plan](../plans/2026-11-17-system-audit.md).

## Findings và remediation

Đếm **24 nhóm nguyên nhân**: **22 nhóm xử lý và kiểm chứng local**, **F23 chờ bước vận hành**, **F24 khắc phục một phần, chưa nghiệm thu semantic consistency với model thật**. Không cộng số test FAIL hoặc số đường dẫn phụ thuộc thành số lỗi sản phẩm độc lập. Có remediation không đồng nghĩa mọi boundary đã nghiệm thu; kết quả provider thật và các hạn chế được ghi riêng phía dưới.

| ID | Feature / mức độ | Owner và nguyên nhân | Sửa / quyết định | Kiểm chứng |
|---|---|---|---|---|
| F01 | Mobile / P1 | `mobile/package.json`, lockfile: Expo 57.0.32 không đạt khuyến nghị SDK | Đúng bản vá `~57.0.33`; không nâng SDK/React Native hàng loạt | Expo compatibility, mobile checks, APK debug |
| F02 | Frontend gates / P1 | Help, HelpDetail, Verification: 11 lỗi lint gồm import thừa và Promise navigation không xử lý rõ | Xóa biến/import không dùng, đánh dấu navigation `void` theo owner hiện có | Frontend lint |
| F03 | Buyer metrics / P1 | `domain/buyerHome.ts`: cộng cả provider-managed và coi thiếu measurement là 0 | Total thiết bị là `null` khi không đo được; UI hiện `—` và giải thích. Legacy measured zero vẫn là 0 | Selector RED/GREEN và dashboard regression |
| F04 | Buyer loading/error / P1 | `BuyerHomeScreen`: chỉ kiểm tra lỗi/loading Licenses, bỏ qua Orders | Chờ cả hai nguồn; lỗi Orders có retry, không trình bày metrics như dữ liệu đã tải đủ | Commerce regression về initial home failure |
| F05 | Public metadata / P1 | `PublicVerificationScreen`: tự gán gói, issuer, perpetual và 0 thiết bị | Missing metadata thành “Chưa có thông tin”; provider chỉ nêu quyền tối đa/quản lý bởi bên bán | Public verification RED/GREEN; không thêm PII vào API |
| F06 | Public chain truth / P1 | Cùng màn hình coi mọi state khác NOT_FOUND là hợp lệ/active | Pending, stale và reorg không được báo “hợp lệ/đang hoạt động” | Ba regression RED/GREEN cho các state |
| F07 | Help / P2 | `PublicHelpScreen`: nhãn Demo cố định | Xóa nhãn; giữ dữ liệu API và trạng thái empty/error | App public Help test |
| F08 | Help navigation / P2 | Search input chỉ lấy `q` khi mount | Đồng bộ draft khi committed URL query thay đổi, kể cả Back/Forward | URL history regression RED/GREEN |
| F09 | Home selection / P2 | Sáu sản phẩm đầu được gọi “nổi bật” dù không có tiêu chí editorial/popularity | Preview catalog công khai A–Z, tie-break bằng slug, nhãn “Sản phẩm đang phát hành” | Carousel ordering + keyboard regression |
| F10 | Terms readiness / P1 | `ServiceTermsContent`: version cố định, production không kiểm tra approval nội dung | Version cấu hình tối đa 40 ký tự, approved SHA-256 bắt buộc; kiểm tra startup và mỗi snapshot; test/dev giữ fixture | Missing approval, hash change, version length, order snapshot/ownership tests |
| F11 | Purchase benefits / P2 | `OrderSummary` chỉ giữ entitlement bằng true, ẩn cả excluded benefit đã khai báo | Hiện giá trị không bao gồm cho các key được phép; unknown/internal keys vẫn không xuất raw JSON | Purchase/commerce regression |
| F12 | Renewal summary / P2 | `BuyerRenewalScreen` truyền mỗi total vào summary | Truyền product/plan/duration và metadata snapshot thực khi có; không tự dựng buyer/provider data | Renewal and payment UI tests |
| F13 | Mobile API drift / P1 | Mobile OpenAPI thiếu mode/idempotency/initial message và message timestamp mới | Đồng bộ input từ backend, sinh lại generated types bằng tool hiện có | Mobile OpenAPI consistency, typecheck/tests |
| F14 | Supply chain / P1 | Audit runtime ghi 8 advisory entries backend, 16 mobile; gồm critical | Pin security fixes; bỏ optional `abitype>zod` không dùng ở runtime, giữ Zod 3 cho Hardhat; thêm audit gate vào hai bộ CI. Decoder 0.5.1 cần patch export CommonJS cho query-string 7, giữ nguyên thuật toán đã vá. Mobile Dockerfile copy patch trước frozen install | Frozen installs, production audit high/critical, HTTP/crypto/mobile regressions; navigation URL regression; Docker missing-patch RED và build/runtime checks |
| F15 | Proxy trust / P1 | API production mặc định tin toàn bộ forwarded chain | `TRUST_PROXY_CIDRS` chỉ IP/CIDR rõ ràng; mặc định false, cấm global /0 và hostname/hop count | Config negative tests; HTTP spoofed-forwarded-IP contract |
| F16 | Stale assertions / P2 | Public allowlist, purchase/renewal DOM, nút/summary, citation DOM và navigation expectations lỗi thời | Giữ exact allowlist đã rà PII; cập nhật locator theo boundary hiện hành. Consent vẫn phải chặn checkout; giữ hash/version/order sequencing/idempotency assertions | Full frontend, API contract, browser regressions |
| F17 | Provider fixture / P1 | Fixture dùng `postgres:15-alpine` nhưng schema cần vector; child import lại suite lớn trước khi sẵn sàng | Dùng `pgvector/pgvector:pg15`; tách subprocess và runtime fixture dùng chung; thêm readiness handshake. Giữ lost-response, restart và receipt assertions | Provider storage/delivery integration; mọi lần fail/rerun được ghi trong results |
| F18 | Proxy fixture / P2 | Caddy test dùng SSH host forwarding không ổn định trên Docker Desktop | Windows dùng host bridge của Docker Desktop; giữ đường exposeHostPorts trên Linux; request có timeout chẩn đoán | Hai Caddy body-size integration tests |
| F19 | Notification test isolation / P2 | Timeout 100 ms có thể xảy ra trước khi vendor nhận HTTP; failure để lại delivery ảnh hưởng test tiếp | Bắt đầu timeout sau khi server nhận request; kiểm tra backoff 60 s và đưa mốc retry của đúng fixture tới quá khứ để kiểm tra due retry | 10 notification integration tests, gồm restart Redis và dead-letter |
| F20 | Worker crash fixture / P2 | Child support worker phải import lại toàn bộ HTTP/AI/knowledge test suite trước khi heartbeat | Chuyển nguyên fixture sang file riêng, giữ real PostgreSQL/Redis, SIGKILL/restart, lease assertions và thời hạn cũ | Focused worker recovery và full integration |
| F21 | Backup/restore / P1 | Unix-socket readiness nhận bootstrap server trước TCP; failed container start nằm ngoài cleanup; metadata ghi cứng PostgreSQL 18 | Probe TCP như pg_restore, cleanup bao cả start failure; evidence nêu đúng image cấu hình | Disposable dump/restore PASS, giữ một user sentinel; không đụng database vận hành |
| F22 | Documentation drift / P2 | README/current context có 18/23 bảng, hướng dẫn reset như upgrade, mô tả Terms nằm trong plan commitment, traceability gọi chat là socket protocol | Cập nhật 24 bảng/pgvector; tách immutable Order Terms khỏi frozen plan commitment; mô tả chat HTTP/polling và đúng source owners; quy trình backup, migration/recovery rõ ràng | Baseline/traceability check và final diff |
| F23 | Configured database drift / P1 vận hành | `db:verify` đọc được 25 bảng: extra `schema_versions`; không thiếu/mismatch critical columns/constraints/indexes/extensions | Thêm `db:migrate` giới hạn đúng transition archive ledger, mặc định rehearsal rollback. Từ chối drift khác, target có sẵn; giữ OID và rows; có kiểm tra recovery/no-op | CLI integration disposable PASS. **Chưa apply trên database hiện hữu**; verify ở đó vẫn FAIL đúng với drift đã ghi nhận |
| F24 | AI semantic consistency / P2, PARTIAL | Gemini thật trả intent PRODUCT_QA kèm tham chiếu hội thoại; các lượt sau chọn ORDINAL/ALL cho câu hỏi LATEST, đôi lúc bỏ reference | Chuẩn hóa PRODUCT_QA + reference hợp lệ thành FOLLOW_UP, giữ technical/support intents; làm rõ prompt. Không thêm keyword matcher hoặc dùng history làm catalog fact. **Chưa sửa dứt điểm** model-generated reference | Bốn regression unit RED/GREEN. Live full cuối 35/38 (2 semantic fail, 1 AbortError); focused cuối 5/6 (1 reference fail). Không đánh dấu F24 fixed |

Không đổi thuật toán commitment, ABI, expiry/finality hoặc quy tắc payment/license để ép demo thành công. Không thêm schema/API editorial Featured Products khi chưa có requirement tương ứng trong catalog capability hiện hành.

## Hardcode, mock và fallback

| Loại | Kết quả |
|---|---|
| Hardcode nghiệp vụ đã xử lý | Provider device totals, missing public plan/issuer/expiry/device values, “nổi bật” không có tiêu chí, metadata restore image |
| Nhãn runtime đã xử lý | Demo trong Help; pending/stale/reorg giả thành active; missing dữ liệu được tách khỏi zero |
| Hardcode hợp lệ giữ lại | UI labels, enum/validation, protocol/version/domain constants, chain ID Sepolia và compatibility gates |
| Mock hợp lệ giữ lại | Fake payment/AI/email/push adapters trong `NODE_ENV=test`; HTTP/UI routes mock trong test; fixtures và synthetic identities ở database disposable |
| Runtime guards giữ lại | Environment validator cấm fake adapters trong development/production; demo seed chỉ khi được bật rõ trong môi trường phát triển |
| Test injection seam | `App initialEntries` dùng cho test routing/auth; production entry render `<App />`. Không dùng seam này làm bằng chứng authorization backend |
| Dữ liệu có sẵn | Không xóa/ghi đè catalog, ledger, key, orders hoặc seed hiện hữu. Dữ liệu database có thể là demo/imported; không đổi nhãn của nó thành giao dịch khách hàng thật |

## Quyền AI và dữ liệu công khai

Đã chạy truy vấn **read-only** trên connection inference đang cấu hình và `SET LOCAL ROLE emukey_ai_reader`. Role không superuser, không tạo role/database, không login; kiểm tra 25 bảng không thấy INSERT/UPDATE/DELETE/TRUNCATE. Application user có thể SET ROLE reader. Connection inference hiện dùng fallback tới database chính, nhưng mỗi truy vấn vẫn chạy transaction READ ONLY và role reader.

View hiện hành trả 33 published plans, 33 current embeddings và 46 public knowledge chunks. Đây là số đọc từ database, không phải metric hardcode; không suy ra throughput hoặc accuracy AI từ các số này. Embedding freshness/publication/model filters vẫn do view/repository quyết định. Test live embedding yêu cầu `retrievalMethod: VECTOR`, không dùng lexical success thay cho vector evidence.

Model không được cung cấp SQL executor hoặc business mutation tools. Conversation/message/handoff writes thuộc trusted application service; handoff cần xác nhận. Tests kiểm tra owner isolation, confirmed handoff, context/price freshness, revoked knowledge, injection và nguồn trích dẫn. Kết quả AI provider thật được ghi riêng trong evidence/results; không lấy local fixture evaluation làm tỷ lệ accuracy production.

## Phân loại E2E và các boundary ngoài

| Scenario | Bằng chứng/phân loại trong audit này | Giới hạn |
|---|---|---|
| Registration, email verification, login/refresh/RBAC | HTTP + PostgreSQL/Redis integration; CONTROLLED_FIXTURE email | Chưa nghiệm thu Brevo tới inbox người dùng thật |
| Provider product/plan publish | Domain/API/SQL integration; MOCKED_UI browser | Không suy từ endpoint tồn tại thành live full-chain acceptance |
| Purchase/Terms/payment/license | Real commerce/SQL services, controlled payment/chain events, browser regression | SePay sandbox live purchase và canonical issue chain chưa được chạy lại xuyên suốt |
| Provider key delivery | HTTP delivery thật, receiver database độc lập, lost-response/idempotency/receipt và restart tests | Receiver thuộc dự án: CONTROLLED_FIXTURE; **BLOCKED_EXTERNAL_PROVIDER** cho provider bên thứ ba |
| License verify/lifecycle | Local invariants/reorg/reconciliation, crypto/Solidity tests, public UI regression | Sepolia read-only được xác nhận; không có transaction mới được gửi trong audit |
| Knowledge approval/publication | API/SQL integration và browser/component tests; publication/current/plan gates | Không phê duyệt tài liệu thật trên database vận hành |
| AI product/knowledge/recommendation | Local evaluation + opt-in provider runs; live pgvector round-trip | Tách kết quả provider, fixture knowledge và current read-only catalog; xem results |
| Direct Support/AI → Support | REAL_LOCAL_SERVICE: frontend/API/auth + disposable PostgreSQL/Redis, browser contexts độc lập | AI generation trong support runner là controlled adapter, không dùng làm Gemini evidence |
| Support queue/claim/reply/close/recovery | REAL_LOCAL_SERVICE browser, lease/race/idempotency/worker integration | Không tuyên bố load capacity production |
| System admin/provider/support screens | MOCKED_UI browser + authorization HTTP negative tests | Không thao tác tài khoản/payments thật qua UI |
| Expo mobile | Unit/API tests, SDK/export checks, native x86_64 debug APK build | Native E2E chưa nghiệm thu: startup Metro bị automatic approval review từ chối |
| Kotlin consumer demo | Unit/lint/debug APK build | Tách riêng với Expo manager; không cộng native UI tests chưa chạy |

Sepolia RPC read-only đã trả chain ID `11155111`, head `12153608`, configured contract có code. Mốc ứng dụng `2026-11-17T09:49:22.990Z`, block `2026-11-17T09:49:24.000Z`; chỉ là một quan sát đồng hồ, không là SLA/finality guarantee. Không gửi giao dịch/mainnet, deploy contract hoặc thay chain identity.

## Evidence và thực thi

Raw logs/screenshot/trace/dump nằm ngoài source, dưới `C:/Users/thong/AppData/Local/Temp/`. [Execution results](2026-11-17-test-results.md) ghi command, native exit code, số PASS/FAIL/SKIP và scope. Các log có PowerShell NativeCommandError do stderr không tự đồng nghĩa command thất bại; dùng native exit code và test summary.

Các lần thất bại không bị xóa: Expo/lint ban đầu, contract allowlist cũ, RED regressions, initial integration dùng image thiếu vector, Caddy Windows forwarding, timing fixtures, migration chưa có entrypoint, version-guard RED, các full suites bị tranh tài nguyên trong lúc build native. Một lượt backend subprocess cũng trúng thời điểm pnpm đang thay link dependency; lần đó không được dùng làm kết luận lỗi business. Full frontend đầu tiên chạy trong lúc thêm regression/sửa source nên không phải immutable HEAD-only test count; không so trực tiếp số đó với báo cáo 285/16 cũ.

Evidence có chủ đích:

- Support browser: `emukey-support-chat-tfRaIy/`, 2 scenario PASS; ảnh, environment và measurements giữ nguyên.
- Backup fixture restore: `emukey-backup-audit-1OuqZG/`, `RESTORE_VERIFIED`, durable counts `1|0|0|0|0`; restore reconcile không yêu cầu/chưa chạy. Đây không phải backup nghiệm thu dữ liệu vận hành.
- Native APK: `emukey-native-audit/android/app/build/outputs/apk/debug/app-debug.apk`, x86_64; build trong temp, không scaffold native source vào repository.
- Browser regression: `emukey-audit-browser-final/` và `emukey-audit-browser-provider-stable/`; các lần fail/trace giữ riêng, không cộng focused rerun thành full run mới.

## Giới hạn, approval và công việc chưa nghiệm thu

1. **BLOCKED_APPROVAL — Terms**: chủ dự án phải duyệt nội dung pháp lý, version, hash; approval không được tác giả audit tự gán. Cần kiểm tra trách nhiệm các bên, cấp/gia hạn/thu hồi, thanh toán/hoàn tiền, dữ liệu/quyền riêng tư, support và thời điểm áp dụng với tư vấn phù hợp. Production guard đã có; legal approval chưa có bằng chứng.
2. **OPERATOR_REVIEW — database ledger**: database hiện tại còn `public.schema_versions`. Migration code/test/recovery đã có, nhưng chưa chuyển bảng trên môi trường đang dùng. Operator cần xác minh công cụ cũ/phụ thuộc, backup và maintenance window. Không làm `db:verify` xanh bằng cách bỏ qua extra table hoặc xóa lịch sử.
3. **BLOCKED_EXTERNAL_PROVIDER**: cần credential, receipt contract và môi trường của provider thật. Receiver dự án không thay cho nghiệm thu nhà cung cấp bên thứ ba.
4. **REAL_EXTERNAL còn giới hạn**: có credential không đồng nghĩa đã qualification toàn bộ SePay/Sepolia/Gemini/Brevo/FCM. Không gửi tới người dùng thật; live AI/RPC được phân loại riêng, không cộng vào business golden-flow thật.
5. **Native E2E / automatic approval**: có Android SDK và AVD, APK đã build. Lệnh start Metro bị xét duyệt tự động trả `blocked by policy`, không có lý do chi tiết. Không đánh dấu native E2E PASS; emulator riêng đã dừng.
6. **Support P2 còn thiếu**: full-history message pagination chưa triển khai; cần cursor contract/UI và load evidence trước khi nhận lưu lượng lớn. Guest → Customer continuity chưa có nghiệp vụ/consent được chốt; chưa tự chuyển lịch sử riêng tư. Retention/delete policy cần chủ dự án phê duyệt; không tự đặt TTL rồi xóa dữ liệu.
7. **Migration phạm vi giới hạn**: không có automatic diff/upgrader cho mọi schema lịch sử. Những upgrade khác cần source fingerprint, explicit SQL, rehearsal/data invariants và recovery riêng; không tuyên bố an toàn từ việc SQL chạy thành công.
8. **CI remote**: `gh run list --repo crchinhle/MCP_API` bị chặn vì GitHub CLI chưa đăng nhập. Working tree chưa push theo yêu cầu. Local gate results không phải bằng chứng GitHub Actions đã chạy thay đổi này.
9. **Moderate/low advisories**: high/critical runtime gates được xử lý; các mức thấp hơn vẫn phải theo dõi. Không tuyên bố dependencies không còn bất kỳ vulnerability nào.
10. **AI provider reliability / F24 PARTIAL**: các lượt thật có HTTP 503/timeouts và semantic mismatch. Lượt full cuối 35/38; focused reference cuối 5/6 vẫn chọn ORDINAL thay LATEST. Cần tiếp tục cải thiện/đối chiếu semantic-reference stage với model đang cấu hình, rồi chạy lại tập đầy đủ, đa dạng; không vá câu riêng bằng keyword hoặc đổi assertion để PASS. Catalog live cuối 5/7 do PROVIDER_UNAVAILABLE. Unit hoặc focused rerun không chứng minh accuracy production.

Mức demo: các boundary local có regression, chat browser thật và artifacts build. Demo xuyên suốt SePay → Sepolia transaction → provider thật → key cần lượt nghiệm thu external có kiểm soát và giải quyết readiness/approval ở trên. Không gọi hệ thống production-ready hoặc toàn bộ nhiệm vụ đã hoàn thành chỉ từ các suite local.

## Nguồn kỹ thuật đối chiếu

- [Expo CLI compatibility/install/export](https://docs.expo.dev/more/expo-cli/), installed Expo 57 và pnpm 11.25.0.
- [React Router useNavigate](https://reactrouter.com/api/hooks/useNavigate), installed React Router 7.18.3.
- [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/), installed Express 5 qua Nest platform.
- [PostgreSQL 15 ALTER TABLE](https://www.postgresql.org/docs/15/sql-altertable.html), archive metadata với identity/transaction checks.
- [Gemini model metadata API](https://aistudio.google.com/api-reference/models); installed `@google/genai` 2.20.0.
- [Decoder 0.5.1 upstream fix](https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.1), [pnpm dependency patch workflow](https://pnpm.io/cli/patch): patch cục bộ chỉ đổi export/package type, không viết lại decoder hoặc bỏ security gate.
- Security patch evidence: [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828), [multer](https://github.com/advisories/GHSA-q7qp-rjg7-q26m), [follow-redirects](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p), [systeminformation](https://github.com/advisories/GHSA-3f7j-7jwc-fxfj), [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [shell-quote](https://github.com/advisories/GHSA-pqg4-j6r4-53mv), [brace-expansion](https://github.com/advisories/GHSA-qhr7-859c-m2p7); exact full advisory sets nằm trong audit logs.
