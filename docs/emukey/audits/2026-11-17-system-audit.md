# EmuKey — audit, remediation và bằng chứng kiểm chứng 17/11/2026

## Authorized operational follow-up — 18/11/2026

Người dùng đã cấp toàn quyền xử lý các phần còn lại, ngoại trừ Gemini live. Các giới hạn không apply/không push/không chạy native ở các snapshot bên dưới là lịch sử. Terms và retention cho vận hành thật vẫn chờ nội dung và thời hạn cụ thể do người dùng cung cấp; không tự duyệt nội dung mẫu, đặt TTL hoặc xóa dữ liệu.

**A07/F23 đã hoàn thành trên database đang cấu hình.** Backup ngoài repository được phục hồi thành công bằng PostgreSQL 18.7. Trên chính bản phục hồi đó, migration đã qua rehearsal, apply, no-op, reversal và reapply. Sau đó áp dụng CLI hiện có lên database cấu hình: `LEGACY_METADATA_ARCHIVED`; `db:verify` trả `matchesBaseline=true`, 24 bảng, mọi danh sách drift trống. Đối chiếu giữ nguyên số dòng cả 24 bảng nghiệp vụ, ledger OID `24682`, một dòng và digest `23be7645a970e8d693bf9d60ecc93f05`. Chạy apply lần hai trả `ALREADY_CURRENT`. Chỉ chuyển bảng lịch sử sang `emukey_maintenance`, không reset hay thay đổi schema.sql.

Backup được giữ tại `%LOCALAPPDATA%/EmuKey/backups/authorized-before-ledger-20261118-pg187/postgres.dump`; metadata cùng thư mục là `RESTORE_VERIFIED`. Log và báo cáo đối chiếu nằm ngoài source, xem operational follow-up trong test-results. Lượt restore đầu thất bại vì Docker cache PostgreSQL 18.6 không đọc được metadata 18.7; đã cập nhật hai image backup/restore lên 18.7 và chạy lại thành công, không sửa dump để bỏ qua lỗi.

**A10 native UI vẫn NOT_RUN do automatic approval review**, không phải thiếu quyền từ người dùng: emulator riêng boot thành công, debug APK cài thành công, fixture API/DB/Redis riêng sẵn sàng và bootstrap parser verifier exit 0. Lệnh khởi động Metro vẫn bị từ chối `blocked by policy`, không có lý do chi tiết; không thử lệnh tương đương. Đã dừng emulator và fixture thuộc lượt này. Không tác động điện thoại thật đang kết nối.

API local có sẵn ở cổng 3000 đang live nhưng readiness 503: probe bên trong container xác nhận PostgreSQL UP, Redis DOWN; Redis dự án ở trạng thái Exited từ trước. Automatic approval review cũng từ chối `docker start emukey-backend-redis-1` với `blocked by policy`, không có chi tiết thêm. Không thay volume hoặc khởi động Redis qua đường khác. Các integration/browser dùng dịch vụ disposable riêng, không chứng minh deployment có sẵn healthy.

**A19 đã có giảm thiểu local được kiểm chứng.** Hai patch picomatch 2.3.2/4.0.7 từ chối repeated extglob được parser nhận diện trước khi đọc body; không chạy analyzer bậc hai cho optional/negative groups. Đây là glob profile giới hạn của EmuKey, không cam kết an toàn cho regex tùy ý hoặc parsed state bên ngoài. Bootstrap bằng Node built-ins kiểm tra hash/patch/lockfile, toàn bộ sáu physical copies và caller resolution, chạy probes có deadline; 10 regression verifier/audit qua. Production audit high/critical vẫn được giữ: ngoại lệ chỉ đúng GHSA-fc5q-39xc-vjpf, version/path đã xác minh; malformed/network/unknown findings fail closed. Live audit kiểm chứng 200 finding paths, trả PASS_WITH_LOCAL_MITIGATION và upstreamFixed=false. Không dùng blanket ignore.

Review độc lập tái hiện thêm hai lỗi chat: poll web ghi đè trang cũ vừa tải giữa promise completion và cache commit; các initial latest-page mobile chồng nhau để hở đoạn giữa lịch sử. Web merge tại synchronous QueryClient write, giữ structural sharing và trạng thái đã hết lịch sử; mobile bỏ cửa sổ latest đến muộn và tải tiếp từ cursor đã có. Regression web RED thực (101 expected/51 received), sau sửa 5/5 contract và focused nhóm 8/8 qua; full mobile 56/56 qua. Real support browser 5/5 qua với API/auth/PostgreSQL/Redis riêng, không gọi Gemini.

External follow-up: Cloudinary upload/read/delete file thử qua; FCM xác thực dịch vụ qua nhưng chưa có token thiết bị. SePay sandbox checkout HTTP 302; chưa có URL callback HTTPS nên chưa nghiệm thu payment xuyên suốt. Brevo ban đầu 401 do IP; người dùng đã cho phép IP, gửi lại được provider tiếp nhận, nhưng event report trả hardBounces/550 5.1.1 NoSuchUser cho địa chỉ thử. Chờ địa chỉ đúng, không gọi email delivery PASS. Các lượt có report riêng trong traceability/releases; latest summary không thay lịch sử đó.

## Residual remediation — 18/11/2026

Mục này cập nhật trạng thái dependency/Gemini sau continuation phía dưới. HEAD vẫn `4af3fb3`; giữ toàn bộ 52 thay đổi đầu lượt. Tổng hiện tại 53 modified tracked owners và một test file mới có owner rõ ràng, không commit/push.

| ID | Kết quả hiện tại | Quyết định và bằng chứng |
|---|---|---|
| A11 bổ sung / P2 | **Ba moderate cũ đã sửa** | Scope `gcp-metadata>gaxios: 7.1.4` loại rimraf khỏi dependency runtime, không bỏ GCP detector hoặc ép glob major. Scope `@expo/fingerprint>minimatch: 11.0.4` chỉ nâng đúng consumer đã kiểm tra; giữ Jest glob cũ. Backend production audit 0; mobile moderate 0. |
| A19 / P1 | **BLOCKED_UPSTREAM: picomatch high mới xuất hiện trong audit** | GHSA-fc5q-39xc-vjpf được GitHub Reviewed cập nhật 17/11; registry latest 4.0.7, advisory chưa có bản vá. Installed mobile có 4.0.7 và 2.3.2 qua Expo CLI/Metro, React Native codegen/tinyglobby/micromatch. Probe riêng pattern `+(*a)`/37 ký tự bị kill sau 1.5s; không chạy trên API. Không thấy direct glob caller trong mobile/src, nhưng chưa chứng minh mọi đường gián tiếp an toàn. Giữ audit high exit 1 và CI gate nguyên vẹn; không ignore hoặc backport PR chưa xác minh. |
| A15 bổ sung / P1 acceptance | **Gemini vẫn BLOCKED_EXTERNAL** | Pilot một ca qua; bounded follow-up 4 ca: 2 pass, 2 fail do HTTP 429, quota ngày free tier model 500 requests đã hết; response đưa retryDelay khoảng 3h30 tại thời điểm thử. Dừng mở live run; không thay model/billing/key hoặc giảm assertion. |

Minimatch 11 bỏ RegExp/AST API và đổi một số Windows matching semantics. Installed Expo fingerprint chỉ dùng `Minimatch`/`match`/`pattern`/`negate`; compatibility test kiểm tra actual Node consumer, ignore/negation/native paths và giới hạn mở rộng. RED thực: `braceExpandMax=64` nhưng bản cũ tạo 256 nhánh. Sau nâng, full mobile 50/50 và actual fingerprint CLI Android qua. New owner `tests/emukey/mobile/unit/fingerprint-toolchain.test.ts` kiểm tra toolchain đã cài, không mock matcher. Existing `platform/telemetry.test.ts` thêm loopback metadata HTTP, kiểm tra header/JSON và từ chối metadata thiếu header, chạy qua đúng dependency của detector. Full backend 542/542, lint/typecheck/build backend/mobile và Expo compatibility qua; xem kết quả security suite trong test-results.

**CI readiness hiện bị chặn bởi mobile high audit**, ngoài trạng thái remote CI chưa xác minh. Các kết quả full acceptance ngày 17/11 và continuation UI là snapshot riêng, không được gọi là all-green trên cây hiện tại. Terms/retention/DB apply/native UI/external paid flows chưa thay đổi trạng thái.

Nguồn: [gaxios changelog và rimraf dev-only fix](https://raw.githubusercontent.com/googleapis/google-cloud-node-core/main/packages/gaxios/CHANGELOG.md), [minimatch 11 breaking changes](https://raw.githubusercontent.com/isaacs/minimatch/v11.0.0/changelog.md), [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249), [picomatch advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf). Published package metadata/installed source được đối chiếu thêm, không suy API từ phiên bản mới nhất.

> Phần audit baseline `562bbc6` bên dưới được giữ làm lịch sử. Đợt acceptance tiếp theo bắt đầu từ HEAD `4af3fb334f976d4b4467e9358b42b8250832f7b6`; xem mục “Acceptance follow-up” ở cuối tài liệu và các bảng follow-up trong test-results/feature-inventory.

Continuation 18/11/2026 giữ nguyên HEAD `4af3fb3` và 51 file đã sửa trước đó; bổ sung một test owner đã tracked (`buyer-hub.test.tsx`), tổng working diff hiện 52 file. Chỉ hai component production được sửa thêm, không đổi schema, dependency hay backend. Bằng chứng ngày 17/11 là snapshot lịch sử; kết quả mới xem đầu [test results](2026-11-17-test-results.md).

| ID | Lỗi tái hiện | Remediation bổ sung 18/11 |
|---|---|---|
| A16 / P2 | `ConversationPanel` đã unmount vẫn chạy completion và xóa sessionStorage của draft mới khi mở lại hội thoại | Lifecycle guard chặn cập nhật draft/request/error sau unmount; regression kiểm tra đóng/mở lại, response cũ rồi reload draft |
| A17 / P2 | Lưu guest history không chung action lock; send/new-chat có thể chạy đồng thời; response cũ vẫn đổi storage sau khi tài khoản unmount | Reuse launcher lock/busy/active guard; giữ draft và proof khi lỗi, retry được; successful link reset trạng thái lỗi/handoff cũ |
| A18 / P2 | Launcher tạo conversation AI thiếu `clientRequestId`; response mất sau commit khiến retry tạo conversation mới | Reuse intent UUID qua contract idempotent hiện có; không thêm endpoint/table hay cơ chế chống trùng song song |

Ba regression đầu RED 3/3 trước fix; regression creation RED 1/1 vì thiếu request ID. Sau fix ba regression đầu GREEN 3/3, full assistant unit 32/32. Không dùng các kết quả này để nâng trạng thái Gemini live hoặc nghiệm thu external. Pattern cleanup/ref tham chiếu [React useEffect](https://react.dev/reference/react/useEffect) và [useRef](https://react.dev/reference/react/useRef), kiểm tra với React 19.2.8 đang cài.

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

## Acceptance follow-up — baseline 4af3fb3

Working tree ban đầu sạch. Không commit/push/deploy, không apply migration vào database hiện hữu, không thanh toán/gửi giao dịch có phí hoặc thông báo tới người thật. Inference tiếp tục dùng `BEGIN READ ONLY` và `SET LOCAL ROLE emukey_ai_reader`; không sửa catalog, embeddings hay Knowledge trên database được cấu hình để làm evaluation xanh.

### Remaining issues và remediation

| ID | Feature | Severity | Root cause | Fix | Test | Status |
|---|---|---|---|---|---|---|
| A01 | Workspace CI | P0 | Integration gọi CLI trong dist trước khi backend build | Build backend một lần trước workspace suites, assert initialize.js và migrate.js tồn tại; giữ thứ tự đúng trong standalone product workflow | Clean disposable source snapshot: hai regression đỏ trước build, xanh sau build | LOCAL_FIXED; REMOTE_CI_UNVERIFIED, không push |
| A02 | AI reference understanding | P1 | Một lần structured generation gộp intent/constraints/reference nên có thể suy thứ tự từ lịch sử | Narrow semantic reference resolver, strict schema và ambiguity clarification; cùng AbortSignal/deadline với understanding; không thêm keyword routing hay quyền mutation | 41 ca live, hai lượt liên tiếp 41/41; unit strict-output và shared-deadline regression | FIXED_ON_EVALUATED_DATASET; provider outage được ghi riêng |
| A03 | AI đổi kỳ hạn | P1 | Giữ plan ID cũ khi người dùng yêu cầu kỳ hạn khác, loại mất gói hợp lệ cùng sản phẩm | Giữ product IDs, truy vấn lại plan hiện hành khi duration thay đổi | Regression đỏ trước fix; advisor unit và live catalog follow-up | FIXED |
| A04 | Chat history | P2 | SELECT toàn lịch sử và polling thay toàn bộ danh sách | before/after server_sequence, default 50/max 100, cursor loại trừ lẫn nhau; array response giữ nguyên; queue preview 20; merge theo ID và thứ tự trên web/mobile | 100/1000 messages, 8 concurrent senders, duplicate ID, HTTP invalid cursors, ownership, claim/release/CLOSED; browser 1000 messages | IMPLEMENTED; xem final matrix |
| A05 | Guest continuity | P2 | Guest có private Redis history nhưng chưa có opt-in chuyển tài khoản; ID phiên từng là bearer capability duy nhất | Token sở hữu 256-bit độc lập; server cấp ID; đồng ý rõ ràng; khóa chung với ask; đích PostgreSQL xác định theo guest session, một owner, transaction và retry idempotent | Wrong/missing proof, consent, other account, retry, real Redis/PostgreSQL; UI chỉ POST sau xác nhận | IMPLEMENTED; guest cũ thiếu proof phải tạo phiên mới |
| A06 | Terms readiness | P1 | File/approval load lỗi có thể thành lỗi HTTP nội bộ không rõ nguyên nhân | Trả 503 SERVICE_TERMS_NOT_READY trước khi ghi order; production startup vẫn fail closed theo version/approved SHA-256 | Missing-file regression; existing approval/hash/snapshot/consent tests | TECHNICAL_FIXED; BLOCKED_LEGAL_APPROVAL |
| A07 | Configured schema | P1 | Còn public.schema_versions ngoài baseline 24 bảng | Migration hiện có đã có rehearsal/archive/no-op/reversal; chỉ inspect database hiện hữu | db:verify read-only vẫn phát hiện đúng ledger; disposable migration suite | BLOCKED_APPROVAL: kiểm tra consumer/backup trước apply |
| A08 | Durable retention | P2 | Chưa có chính sách xóa/lưu trữ được phê duyệt | Không thêm TTL/deletion job cho PostgreSQL; TTL guest Redis hiện có không phải retention business history | Source/config inspection | BLOCKED_POLICY_APPROVAL |
| A09 | External payment/chain/delivery channels | P1 acceptance | Live payment/paid chain và real-user notifications ngoài ủy quyền | Local integration dùng payment/chain fixtures, receiver HTTP/database riêng; không suy diễn external PASS | Commerce/provider/notification suites; Hardhat | BLOCKED_EXTERNAL / BLOCKED_APPROVAL cho live qualification |
| A10 | Native UI | P2 acceptance | Chưa có native UI E2E được cho phép sau Metro startup bị auto-review từ chối trong đợt trước | Export/build và unit tách riêng native UI; không lách bằng lệnh Metro tương đương | Android build evidence riêng | BLOCKED_APPROVAL cho native UI |
| A11 | Dependencies | P2 | Có patch mới cho các transitive đã pin | Nâng qs cùng major, brace-expansion/node-forge patch; giữ decoder CommonJS patch | Frozen install, audit, SDK check, tests/build chạy lại | Xem final dependency matrix; không force major glob/minimatch |
| A12 | AI recommendation cards | P1 | Intent PRODUCT_RECOMMENDATION với requestedFields OVERVIEW đi nhầm nhánh chỉ mô tả sản phẩm | Giữ nhánh recommendation để trả facts và cards từ catalog đã lọc | Unit RED/GREEN; live recommendation sau fix 1/1 | FIXED; full live rerun báo riêng |
| A13 | Mobile draft/retry/handoff | P2 | Response gửi cũ xóa draft mới; AI outage mất request intent; nút gửi người thật hiện ở AI_ACTIVE dù backend không cho phép | Clear draft khi khớp nội dung đã gửi, khóa theo conversation, giữ intent khi provider lỗi, thêm nút handoff qua endpoint hiện có và chỉ bật human send ở trạng thái support | Ba regression RED trước fix; mobile 47/47 sau fix | FIXED |
| A14 | Rate-limit regression stability | P2 test | Test 20+1 HTTP requests có thể vượt ranh giới phút thật của fixed-window quota | Cố định clock trong đúng ca kiểm thử một cửa sổ, giữ nguyên 20 thành công/21 bị 429 và real Redis | Full integration rerun; không đổi rate-limit policy sản phẩm | TEST_FIXED |
| A15 | Live AI availability | P1 acceptance | Gemini trả 503/timeout, sau đó 429 quota trong các lượt mở rộng | Giữ retry/deadline bounded và fallback rõ ràng; mobile giữ question/request ID để thử lại; dừng mở thêm live runs | Lượt sau card fix: 2 pass/12 fail, đều provider/availability; raw log giữ nguyên | BLOCKED_EXTERNAL: cần quota/dịch vụ khả dụng trước live demo |

### Quyết định contract và dữ liệu

GET `/conversations/:id/messages` nhận `before`, `after`, `limit`; before/after exclusive và không kết hợp. Cursor phải là safe positive integer, limit 1..100. Trả array tăng dần theo serverSequence, request mặc định lấy 50 tin mới nhất. Index unique `(conversation_id, server_sequence)` hiện có được tái sử dụng; không đổi schema. Đây là cập nhật đồng bộ mọi client duy trì trong repository; consumer cũ cần tải các trang before để lấy lịch sử đầy đủ.

Web giữ cache riêng theo account/conversation, merge sau khi response về để không ghi đè trang cũ/tin mới đang tải đồng thời. Mobile dùng FlatList, cache theo conversation, forward polling, nút tải lịch sử, đồng bộ lại và AppState reconnect; draft không nằm trong item ảo hóa. Scroll anchor web được kiểm chứng trong Chromium, không suy từ jsdom; native scroll vẫn cần native UI qualification.

Mobile giữ draft đang soạn nếu response cũ về; request ID chỉ tái sử dụng cho cùng nội dung/loại yêu cầu. Khi provider unavailable, giữ câu hỏi và intent để retry; người dùng có thể chọn handoff rõ ràng qua endpoint hiện có. Không hiện nút gửi người thật trong AI_ACTIVE; sau handoff mới cho gửi support message. Lỗi đồng bộ sau mutation thành công được tách khỏi lỗi gửi để tránh khuyến khích gửi trùng.

Guest transfer chỉ nhập lịch sử đã redaction/bounded trên server, không nhận lịch sử do client gửi. AI message nhập từ guest không được nâng thành thông tin grounded hiện hành; có system notice yêu cầu tra cứu lại. PostgreSQL identity toàn cục theo guest session ngăn tạo đích thứ hai cho tài khoản khác kể cả sau crash trước Redis completion marker. Phiên guest đã liên kết không tiếp tục được dùng qua public ask. Không tự chuyển giữa các tài khoản và không tạo auth flow mới.

### Migration cho operator

Database hiện hữu chỉ chạy `corepack pnpm --dir EmuKey/backend build` rồi `corepack pnpm --dir EmuKey/backend db:verify`. Kết quả hiện tại: thêm đúng `public.schema_versions`, chưa apply và chưa xóa ledger.

Trước thay đổi: xác nhận không có tool phụ thuộc public.schema_versions; backup và restore thử vào database riêng; kiểm tra baseline chỉ lệch ledger này, archive target chưa có, quyền/maintenance window và OID/row count. Trên bản restore dùng database URL của bản restore: `corepack pnpm --dir EmuKey/backend db:migrate` để rehearsal và rollback, rồi `db:migrate --apply` để kiểm chứng archive, `db:verify`, chạy lại để kiểm chứng no-op. Command apply trên database hiện hữu chỉ dành operator sau phê duyệt, chưa được agent thực hiện.

Recovery scope: nếu cần trả ledger lại vị trí cũ và đã xác nhận không có public.schema_versions mới, thực hiện transaction `ALTER TABLE emukey_maintenance.schema_versions SET SCHEMA public;` rồi kiểm tra OID/rows/consumer. Khôi phục business data bằng backup đã verify nếu có sự cố rộng hơn; không dùng initializer/reset hoặc drop lịch sử.

### Demo readiness theo boundary

Các quality gates local đã qua trên source đã chốt; kết quả không đồng nghĩa nghiệm thu live toàn bộ hệ thống. Ma trận hiện có 13 capability IMPLEMENTED_VERIFIED theo boundary ghi rõ, 19 PARTIAL, 1 BLOCKED_EXTERNAL và 1 BLOCKED_APPROVAL. AI live hiện bị 429/503/timeout; remote Actions chưa chạy vì không push. Không còn lỗi P0/P1 nguồn đã tái hiện mà chưa sửa trong phạm vi đợt này; vẫn còn các điều kiện phê duyệt/dịch vụ và 3 moderate transitive advisories đã ghi riêng.

BLOCKED_LEGAL_APPROVAL áp dụng nội dung `EmuKey/backend/config/service-terms.md` và baseline `EmuKey/backend/config/license-terms/v1.md`; kỹ thuật version/hash/snapshot/consent không thay thế người có thẩm quyền duyệt nội dung. Retention PostgreSQL chưa được duyệt. Archive ledger trên database hiện hữu và native UI E2E chưa được thực hiện.

| Flow | Local demo / bằng chứng | Điều kiện external còn lại |
|---|---|---|
| Purchase/Terms/payment | Orders, snapshots, explicit consent, callback classification/retry/review có kiểm thử API/SQL; UI browser dùng fixtures | Nội dung Terms có thẩm quyền duyệt và SePay qualification; không gọi fixture là thanh toán thật |
| License/renewal/provider | Real HTTP receiver + DB riêng, lost response, key/state invariants và worker recovery; payment/chain là fixtures | Provider endpoint thực được cho phép và payment/paid-chain qualification |
| Blockchain verification | Hardhat và DB projection/invariants; UI biểu diễn finality/trust riêng trạng thái nghiệp vụ | Sepolia read-only probe không tương đương lifecycle transaction có phí |
| AI | Live understanding/candidate selection/embedding/read-only retrieval được ghi riêng từng lượt; bounded fallback khi provider lỗi | Không bảo đảm Gemini availability; xem semantic vs provider failures trong test-results |
| Support Chat | Real local auth/API/PostgreSQL/Redis và Chromium, claim/release/recovery/pagination | Retention policy, native scroll/device acceptance |
| Mobile | API/OpenAPI đồng bộ, Jest, Expo export; native build báo riêng | Native UI E2E và Brevo/FCM live chưa được nghiệm thu |
| System administration | HTTP role/ownership tests và mocked browser navigation/error states | Các hành động production như migration/apply/chain reconciliation cần operator được ủy quyền |

### Nguồn và giới hạn review

[React Native 0.86 FlatList](https://reactnative.dev/docs/0.86/flatlist), [maintainVisibleContentPosition](https://reactnative.dev/docs/0.86/scrollview#maintainvisiblecontentposition), [Gemini thinking](https://aistudio.google.com/docs/thinking?generate-content=true) và SDK `@google/genai@2.20.0` đã được đối chiếu. Review thực hiện inline với source/diff/abuse tests; không có independent-agent review, không dispatch subagent khi chưa có ủy quyền.

Patch references: [qs](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw), [brace-expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr), [node-forge](https://github.com/advisories/GHSA-w4xr-hqv8-ch44). Residual [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) và [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) cần compatible migration/upstream patch; audit high gate PASS không có nghĩa zero advisory.

### Changed files - follow-up

Every file below extends an existing owner. No new source owner, dependency family or SQL schema copy was created. Generated OpenAPI/types are maintained tracked contracts, not build output. Temporary logs, APKs, dumps and traces stay in T.

| File | Reason |
|---|---|
| `.github/workflows/emukey-tests.yml` | Build and verify backend CLI artifacts before integration; avoid a second explicit backend build. |
| `EmuKey/backend/openapi/openapi.json` | Synchronize the bounded-message cursor and explicit guest-proof/consent contracts. |
| `EmuKey/backend/pnpm-lock.yaml` | Scoped transitive security patch pins and their lockfile resolutions. |
| `EmuKey/backend/pnpm-workspace.yaml` | Scoped transitive security patch pins and their lockfile resolutions. |
| `EmuKey/backend/src/modules/assistance-support/application/ai-advisor.service.ts` | Re-query current product plans when a follow-up changes the term. |
| `EmuKey/backend/src/modules/assistance-support/application/public-assistant.service.ts` | Issue/validate independent proof and serialize one-owner opt-in transfer. |
| `EmuKey/backend/src/modules/assistance-support/assistance-support.controller.ts` | Bind cursor DTO and authenticated Customer guest-transfer endpoint. |
| `EmuKey/backend/src/modules/assistance-support/assistance-support.dto.ts` | Additive cursor/proof/consent types and validated public contracts. |
| `EmuKey/backend/src/modules/assistance-support/assistance-support.service.ts` | Validate cursor invariants and enforce Customer guest-transfer ownership. |
| `EmuKey/backend/src/modules/assistance-support/assistance-support.types.ts` | Additive cursor/proof/consent types and validated public contracts. |
| `EmuKey/backend/src/modules/assistance-support/infrastructure/assistance-support.repository.ts` | Bound sequence queries and atomically import one globally unique guest-history destination. |
| `EmuKey/backend/src/modules/assistance-support/infrastructure/gemini-ai.gateway.ts` | Strict focused semantic reference resolution under the shared understanding deadline. |
| `EmuKey/backend/src/modules/commerce-payment/application/commerce.service.ts` | Recoverable SERVICE_TERMS_NOT_READY before any order write. |
| `EmuKey/backend/src/platform/observability/log-redaction.ts` | Redact guest proof from request and response logs. |
| `EmuKey/frontend/openapi/openapi.json` | Synchronize the bounded-message cursor and explicit guest-proof/consent contracts. |
| `EmuKey/frontend/src/application/assistance/assistanceQueries.ts` | Reuse per-account conversation caches; merge older and forward pages without lost concurrent results. |
| `EmuKey/frontend/src/application/assistance/supportQueries.ts` | Reuse per-account conversation caches; merge older and forward pages without lost concurrent results. |
| `EmuKey/frontend/src/infrastructure/api/generated/index.ts` | Synchronize the bounded-message cursor and explicit guest-proof/consent contracts. |
| `EmuKey/frontend/src/infrastructure/api/generated/types.gen.ts` | Synchronize the bounded-message cursor and explicit guest-proof/consent contracts. |
| `EmuKey/frontend/src/presentation/components/AiAssistantLauncher.tsx` | Load older pages, preserve visible anchor, and offer explicit guest transfer confirmation. |
| `EmuKey/frontend/src/presentation/components/ConversationPanel.tsx` | Load older pages, preserve visible anchor, and offer explicit guest transfer confirmation. |
| `EmuKey/frontend/src/presentation/screens/BuyerAssistanceScreen.tsx` | Wire the existing panel to paginated history and recoverable older-page errors. |
| `EmuKey/frontend/src/presentation/screens/SupportConsoleScreen.tsx` | Wire the existing panel to paginated history and recoverable older-page errors. |
| `EmuKey/mobile/openapi/openapi.json` | Synchronize the bounded-message cursor and explicit guest-proof/consent contracts. |
| `EmuKey/mobile/pnpm-lock.yaml` | Scoped transitive security patch pins and their lockfile resolutions. |
| `EmuKey/mobile/pnpm-workspace.yaml` | Scoped transitive security patch pins and their lockfile resolutions. |
| `EmuKey/mobile/src/infrastructure/api/client.ts` | Send before/after/limit through the maintained mobile API client. |
| `EmuKey/mobile/src/infrastructure/api/generated/index.ts` | Synchronize the bounded-message cursor and explicit guest-proof/consent contracts. |
| `EmuKey/mobile/src/infrastructure/api/generated/types.gen.ts` | Synchronize the bounded-message cursor and explicit guest-proof/consent contracts. |
| `EmuKey/mobile/src/presentation/EmuKeyMobileApp.tsx` | Virtualized history, bounded polling/reconnect, conversation drafts and safe pending-send behavior. |
| `context/current/HDSD.md` | Current usage and technical contract for pagination and opt-in guest continuity. |
| `context/current/cong_nghe_he_thong.md` | Current usage and technical contract for pagination and opt-in guest continuity. |
| `docs/emukey/2026-11-16-support-chat-acceptance.md` | Preserve historical evidence and record current scope, results, blockers and capability acceptance. |
| `docs/emukey/audits/2026-11-17-feature-inventory.md` | Preserve historical evidence and record current scope, results, blockers and capability acceptance. |
| `docs/emukey/audits/2026-11-17-system-audit.md` | Preserve historical evidence and record current scope, results, blockers and capability acceptance. |
| `docs/emukey/audits/2026-11-17-test-results.md` | Preserve historical evidence and record current scope, results, blockers and capability acceptance. |
| `docs/emukey/plans/2026-11-17-system-audit.md` | Preserve historical evidence and record current scope, results, blockers and capability acceptance. |
| `tests/emukey/backend/integration/assistance/ai-semantic-catalog.integration.test.ts` | Semantic reference/term-change and live current-catalog/guidance evaluations. |
| `tests/emukey/backend/integration/assistance/ai-understanding-provider.integration.test.ts` | Semantic reference/term-change and live current-catalog/guidance evaluations. |
| `tests/emukey/backend/integration/assistance/phase7-assistance.integration.test.ts` | Cursor bounds/races/retries/HTTP auth and durable guest-transfer integration coverage. |
| `tests/emukey/backend/unit/ai-semantic-orchestration.test.ts` | Semantic reference/term-change and live current-catalog/guidance evaluations. |
| `tests/emukey/backend/unit/gemini-ai-understanding.test.ts` | Semantic reference/term-change and live current-catalog/guidance evaluations. |
| `tests/emukey/backend/unit/payment.controller.test.ts` | Missing Terms readiness regression; fail before creating an order. |
| `tests/emukey/backend/unit/public-assistant.test.ts` | Independent session proof, consent, replay and cross-account isolation abuse tests. |
| `tests/emukey/e2e/web/ai-assistant.spec.ts` | Assert collapsed citation visibility instead of requiring its DOM node to be absent. |
| `tests/emukey/e2e/web/support-chat.spec.ts` | Real-browser 1000-message pagination, anchor, draft, offline and refresh checks. |
| `tests/emukey/frontend/ai-assistant-chat.test.tsx` | Explicit guest-transfer confirmation and preserved chat UI/retry assertions. |
| `tests/emukey/frontend/assistance-contract.test.ts` | Preserve existing assertions and cover concurrent history merge and explicit guest confirmation. |
| `tests/emukey/mobile/unit/phase3-phase4-screens.test.tsx` | Pagination/draft continuity and pending-send draft-loss regressions. |
| `tooling/emukey/verification/run-support-chat.mjs` | Add an isolated 1000-message fixture to the existing real support runner. |
| `tests/emukey/backend/integration/assistance/public-assistant.integration.test.ts` | Keep the real Redis 20/21 HTTP quota regression inside one fixed-minute window. |
