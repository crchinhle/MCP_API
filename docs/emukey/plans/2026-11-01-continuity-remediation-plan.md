# EmuKey — Kế hoạch khắc phục 33 điểm chưa liền mạch và thống nhất

> **Dành cho người thực thi:** dùng `agent/skills/executing-plans/SKILL.md`, thực hiện từng work package (WP), cập nhật checkbox và bằng chứng ngay trong tài liệu này. Chỉ dùng subagent khi được phép. Kế hoạch không cấp quyền commit, push, triển khai, reset database hoặc thực hiện giao dịch bên ngoài.

**Ngày:** 01/11/2026. **Baseline đã đọc:** Git `cf17043`, working tree sạch trước khi tạo tài liệu.

**Trạng thái:** ĐANG TRIỂN KHAI theo yêu cầu “hiện thực đi”; không commit/push/deploy hoặc thay đổi database vận hành. Các checkbox chưa hoàn thành chưa được coi là nghiệm thu.

### Nghiệm thu dịch vụ thật 02/11/2026 — SePay sandbox và Sepolia

- Người dùng đã cho phép dùng cấu hình `.env`, tự hoàn tất checkout SePay Test Mode và xác nhận đã thanh toán. API/worker/web chạy với PostgreSQL/Redis kiểm thử riêng, giữ nguyên database Neon có sẵn và nội dung `.env`. Đây là lượt operator-assisted; không gọi là browser E2E tự động vì browser access host không kết nối được.
- Đơn thực sự đã thanh toán là `EMU-529353353FA844439F83`, gói **Professional / 900.000 VND**; khác đơn Starter 300.000 VND được chuẩn bị trước đó nhưng chưa xác nhận điều khoản. IPN được lưu `MATCHED`, payment attempt `SUCCEEDED`, order `PAYMENT_ACCEPTED`; timing basis `SANDBOX_RECEIPT`, không thay timestamp hay giả callback để fulfill.
- License `3232cca1-e234-486c-93f8-3e9de5a309d0`, public ID `EMU-3232CCA1E234486C93F8`: **ACTIVE / TRUSTED**. Lệnh ISSUE_LICENSE `a52d5f14-a4d1-40cd-95fc-392418301efe` **CONFIRMED**, một attempt. Receipt Sepolia `0x98751ac76dad590aa5de8db279afd2c71ab0dcf1bd456362616eaf4dd0109459` thành công, block **12046983**, hash khớp canonical block và contract cấu hình. Đọc trực tiếp `getLicense` khớp plan Professional, quota 3; API public verify trả `CHAIN_CONFIRMED`.
- Kiểm tra HTTP trên chính dữ liệu này: IPN sai secret **401**; replay payload SePay đã nhận qua application boundary **200**, cùng transaction ID, số payment/license/ISSUE_LICENSE giữ **1/1/1**; receipt/history/notifications **200**, license chưa đăng nhập **401**. Payload persistence có wrapper `{protocolVersion,payload}`; replay chỉ gửi phần `payload`, không coi wrapper là wire format. Receipt key đã được người dùng ACK lúc `2026-11-02T08:31:38.004Z`; retrieve mới trả **404 / ACTIVATION_KEY_UNAVAILABLE**, không mở lại lượt nhận.
- Người dùng cung cấp mã đã nhận qua file tạm cục bộ; kiểm thử consumer dùng HTTP public, không dùng purchaser session cho activation/entitlement. Chữ ký thiết bị sai bị **401 / INVALID_DEVICE_PROOF**; kích hoạt đúng **201 / ACTIVE**; replay challenge bị **401 / INVALID_DEVICE_CHALLENGE**. Challenge mới cho cùng device trả cùng device ID, không tăng số thiết bị hoặc tạo thêm sync command. Owner GET/PATCH/list xác nhận metadata probe. Entitlement issue/refresh **201**, verify **200 / valid=true / desktop=true**. Đây là API consumer probe, không phải bằng chứng app Kotlin/native đã chạy với license này.
- Device probe `9b00faa1-d455-4818-8f20-1bf122bc1cb7`, lệnh SYNC_DEVICE_COUNT `8fbd3521-cab0-4037-ba88-e3efe778d463`: **CONFIRMED**, receipt `0x6f2163b41e04f0b548ce83a1b01c4b5a5fb004c8fc2cd2d0d55f0156f9a23227` thành công, event ACTIVE_DEVICE_COUNT_SYNCED tại block **12047037**. PostgreSQL aggregate và `getLicense` Sepolia đều **1/3 thiết bị**, version 1; chỉ một sync command. Private key của probe chỉ giữ trong bộ nhớ trong lần chạy, không ghi vào source/log/report. File activation key do người dùng cung cấp được giữ nguyên.
- Evidence đã redaction cập nhật tại `docs/emukey/traceability/canonical-e2e-golden-flow.json`, giữ kết quả lượt trước trong `previousRun`. **coreFlowStatus=PASS** cho operator checkout → real IPN → issuance → HTTP activation/entitlement → real device-count sync. Status tổng vẫn **BLOCKED / BROWSER_ACCESS_HOST_UNAVAILABLE** cho bước UI cuối chưa kiểm chứng; raw credentials, activation key, entitlement và device signing key không được ghi vào báo cáo. Tài nguyên kiểm thử bền vững được giữ để đối chiếu với giao dịch on-chain.
- **R33 đạt một phần:** pipeline dịch vụ thật phía trên đã có bằng chứng; còn final browser UI, Kotlin/native consumer với license này, native checkout/email/deep-link, Brevo/FCM, AI/storage và các gate external khác của WP17. Không đóng toàn bộ R33 hay kế hoạch; không có commit/push/deploy hoặc thanh toán production.

### Kết quả tiếp tục xử lý 02/11/2026 — HTTP, phân trang, worker và Android

- **Lỗi đã tái hiện rồi sửa:** 11 POST có HTTP success status thực tế khác OpenAPI; cursor thông báo mất microsecond PostgreSQL khiến trang thứ hai rỗng; heartbeat cũ/không hợp lệ vẫn báo worker UP; Expo không nhúng API URL khi đọc qua `globalThis.process`, làm APK dùng nhầm localhost. Test contract/runtime, PG/HTTP, health unit và Expo production transform đã chạy đỏ trước sửa rồi đạt. Không thêm dependency hoặc schema vật lý trong lượt này.
- **HTTP:** sửa `@HttpCode` ở support/knowledge publish/query/notification read/email action resolver; knowledge create giữ 201 và đổi OpenAPI sang Created. Regenerate snapshot/types web/mobile. Contract mới so sánh POST thực tế của các controller với `/openapi.json`, không import Swagger internals.
- **Thông báo:** PG/HTTP có 45 notification cùng timestamp `.123456Z`, phân trang 20/20/5 không thiếu/trùng, badge 45→44 sau read/replay; malformed limit/cursor bị 400, owner khác bị 404. Cursor mới giữ sáu chữ số; cursor cũ ba chữ số tra timestamp chính xác từ hàng thuộc owner. Public `createdAt` giữ contract hiện có.
- **Support:** HTTP state/role/owner/claimVersion/validation/retry matrix đạt. Kill process scheduler thật rồi restart trên PG/Redis disposable đã trả conversation hết lease về queue, staff mới nhận version mới và staff cũ bị chặn; không chỉ gọi trực tiếp sweep trong cùng process.
- **Android manager:** build native độc lập trong OS temp phát hiện đường dẫn CMake `.pnpm` vượt giới hạn Windows; chọn `nodeLinker: hoisted` trong owner cấu hình mobile hiện hữu. APK debug có JS bundle đã chạy qua **login thật → retrieve key → PG receipt ACK → force-stop/relaunch → xem key SecureStore không retrieve lần hai → logout → tài khoản B không thấy key A → revoke session B → refresh401 tự về login → relaunch vẫn ở login**. Đây là API/Nest/auth/PG/Redis thực với adapter ngoài được cô lập trong test, không phải thanh toán hay push thật. Test cài app mới bằng `install -g`, nên chưa nghiệm thu UX xin quyền push; từ chối chạy nếu manager đã cài và uninstall app do test tạo khi xong.
- **Schema/restore:** baseline Git được seed demo trong PostgreSQL disposable, order/payment/license/command đều có dữ liệu. Chụp count + SHA-256 theo toàn bộ cột cũ của mọi bảng baseline; injection sau DDL nhưng trước version/COMMIT, upgrade thành công và physical restore/upgrade đều giữ nguyên snapshot này. Physical `pg_basebackup` kèm WAL trên PostgreSQL 15 được mở thành clone port riêng, giữ fingerprint, upgrade APPLIED rồi CURRENT. Logical `pg_dump/pg_restore` cũng giữ dữ liệu nhưng viết lại cast và bị fingerprint gate từ chối đúng thiết kế. Không thêm allowlist tự động hoặc chỉnh fingerprint để né kiểm tra; restore theo dịch vụ DB triển khai vẫn phải nghiệm thu riêng.
- **Clean-room:** chỉ copy source `EmuKey/` sang OS temp, frozen install/build API/worker/web images đạt; PostgreSQL 15 external initialize/verify đạt **21 bảng, 250 constraints, 54 FK, 123 indexes**. Full development runtime dừng ở policy `fake adapter is test-only`; chưa có credentials provider thật được chỉ định cho đợt này. README, `.env.example` và tài liệu công nghệ đã sửa để không hướng dẫn development + fake như cấu hình chạy hợp lệ. Container/network/volume riêng của drill đã được dọn; không sửa `.env` hoặc container vận hành có sẵn.
- **Verification cuối đã chạy:** backend **297 unit / 22 contract / 17 security**; integration **97 đạt, 4 opt-in bỏ qua mặc định, 9 files**; frontend **247/247**; mobile **30/30**; manager Android opt-in **1/1**. Browser AI history/source/escalation **1/1**; workspace lượt đầu **16/18**, hai ca trang trắng/timeout chạy lại riêng **2/2**, lượt xác nhận toàn file cuối **18/18**. Backend lint/typecheck/build/OpenAPI, frontend typecheck/build/OpenAPI và mobile lint/typecheck/OpenAPI đều đạt. Workspace hygiene và baseline validator đạt; diff không có whitespace error, không thêm file untracked so với baseline lượt này. Emulator và clean-room containers/network/volume do lượt này tạo đã dừng/dọn; môi trường có sẵn được giữ nguyên.
- **Payment review bổ sung:** matrix HTTP dùng guard/role/DTO/service/PG thật, chỉ fixture lookup credential và adapter thanh toán: 401/403, status legacy và input thiếu bị 400, amount mismatch không được accept/rematch sai, refund/replay 200 nhưng không cấp license, hai admin rematch chỉ một license/command, Terms thiếu/terminal order/FAILED attempt/provider time đúng deadline đều không fulfill. Focused **1/1**, toàn file commerce cuối **15/15** và regression toàn bộ integration **97/97** đạt. Fixture namespace issuance/renewal lấy thời điểm từ PostgreSQL thay vì đồng hồ host để tránh lệch clock với Docker.
- **Giới hạn kiểm thử ghi nhận:** một lượt full trước đó timeout 120 giây ở Redis recovery drill; focused chạy lại đạt, sau thêm stage/connection diagnostics lượt full cuối đạt 97/97. Chưa tái hiện được nguyên nhân timeout ban đầu; không tăng timeout, bỏ assertion hoặc coi đó là lỗi production đã sửa. Diagnostic mới sẽ cho biết drill kẹt tại connect/pause/restart/recover/resume/delivery/cleanup nếu lặp lại. Các warning Ant Design deprecation, jsdom pseudo-element và web bundle lớn vẫn tồn tại; chúng không được sửa bằng cách tắt kiểm tra.
- **Gate còn mở:** full native checkout/payment/email/deep-link và FCM cold/warm tap; đủ lifecycle demo/Sepolia; restore theo dịch vụ DB thực tế; full clean-room runtime với real provider configuration; GitHub Actions run và external acceptance. Các checkbox acceptance chi tiết chưa có bằng chứng vẫn để mở. **R33 vẫn EXTERNAL_BLOCKED**, không dùng fixture để đóng gate dịch vụ thật. Không có commit/push/deploy hoặc giao dịch ngoài.
- Nguồn đối chiếu: [Nest HTTP status](https://docs.nestjs.com/controllers#status-code), [Expo env inlining](https://docs.expo.dev/guides/environment-variables/), [Expo/pnpm layout](https://docs.expo.dev/guides/monorepos/), [node-postgres timestamp precision](https://node-postgres.com/features/types#date--timestamp--timestamptz), [PostgreSQL US formatting](https://www.postgresql.org/docs/15/functions-formatting.html), [PostgreSQL physical base backup](https://www.postgresql.org/docs/15/app-pgbasebackup.html).

Tái chạy manager opt-in: đặt `EMUKEY_MANAGER_ANDROID_SERIAL=emulator-...`, `EMUKEY_MANAGER_ANDROID_APK=<đường-dẫn-apk>` và `EMUKEY_ADB=<đường-dẫn-adb>`, rồi chạy `node tooling/emukey/run.mjs backend:integration --testNamePattern="runs the manager Android"`. APK fixture dùng URL `http://10.0.2.2:43170/api/v1`; trong native project sinh ở checkout build riêng, đặt `react { debuggableVariants = [] }` để debug APK chứa JS thay vì cần Metro. Đây là cấu hình artifact test local, không thay manifest HTTPS của release trong source.

### Kết quả source và kiểm chứng cập nhật 01/11/2026

Các mục dưới đây là thay đổi đã thực hiện trong workspace, **không phải tuyên bố đóng cả 33 finding**. Checkbox của mỗi WP chỉ đánh dấu phần đã có bằng chứng tương ứng; ma trận fault/runtime còn thiếu vẫn để mở.

| Nhóm finding | Source đã thay đổi | Bằng chứng / gate còn mở |
|---|---|---|
| R01 | Catalog UUID, provider identity, legacy collision 409, links/query keys | Unit và PG/HTTP cho hai provider, mỗi bên hai plan khác giá; draft/unknown/malformed ID; web/mobile regressions |
| R02–R03 | Resolution rõ nghĩa, evidence hoàn tiền bất biến, fulfillment chung gate IPN; buyer dùng review state và next action | PG refund/replay/concurrent rematch, policy unit, UI gửi resolution; chưa đóng toàn bộ HTTP negative matrix |
| R04–R05 | Native return parser, refetch server, poll purchase/renewal và expiry projection | Mobile unit; browser payment/renewal; còn Android kill-app/real-SePay acceptance |
| R06–R10 | Web/mobile nhận key theo version, tên thiết bị, remote revoke và email action resolver; mobile tiếp tục qua email web và quay lại đúng license | Mobile UI/client unit, browser recovery/role navigation; còn full real-email/Android handoff acceptance |
| R11 | Receipt PG claim/read/ACK, bounded retry, owner/command/version được kiểm tra trong transaction dưới khóa license; SecureStore trước ACK; lỗi hết retry window hướng recovery | PG concurrent delivery, retry/expiry, ACK khi Redis lỗi, stale version; Redis DUMP/RESTORE mất envelope/backup sau ACK/TTL mới không mở lại receipt; còn full HTTP/Android fault matrix |
| R12 | Kotlin consumer demo riêng, Keystore AES-GCM, EIP-191, online-gated CSV export trước picker và trước ghi | APK/debug lint + 2 JVM tests; Android emulator + API/PG/Redis disposable: activate, issue/verify, CSV content, restart, revoke/deny-export và offline đều đạt; còn mua/nhận key thật, renewal/suspend/expiry và external acceptance |
| R13–R17 | Numeric query DTO, cursor validation, page/target DTO, mapper canonical, unreadCount toàn inbox, target links/push refetch | Backend unit/PG, frontend mapper, browser notification pagination; còn native FCM cold/warm tap trên thiết bị |
| R18 | Canonical lifecycle/reorg, expiry, support reply và payment review intents trong transaction; kiểm tra lease trước gửi, token claim riêng mỗi attempt | PG dedupe/rollback/reorg/multi-device; HTTP timeout/dead-letter và SIGKILL/restart cùng BullMQ job với vendor fixture đã đạt; còn semantics của nhà cung cấp thật |
| R19 | Native login/refresh/logout, single-flight, generation guards, mutation replay policy, account-scoped SecureStore, no-store/redaction; revoked refresh xóa secret, transient giữ phiên | HTTP controller + mobile 10 simultaneous requests/account switch/unkeyed mutation/ACK retry/401–403 revoke/503 retry; còn manager Android runtime matrix |
| R20–R22 | AI chỉ ở AI_ACTIVE; polling mobile; lease kiểm tra sau row lock, close/release retry an toàn; web khóa form khi mất/chưa xác minh phiên, giữ draft | PG hai staff thật, stale generation, hai sweeper, chờ row lock tới hết lease; browser hai tab cùng tài khoản + heartbeat mới bị giữ response đạt; còn crash support worker và manager Android runtime |
| R23–R25 | Copy AI đúng phạm vi, session conversation + stable message ID, citation snapshot + authorized source endpoint + history rendering | PG source ownership/snapshot replay, AI unit, browser launcher; còn reload/escalation/source-replacement browser matrix |
| R26 | Upload route 12 MiB trên Caddy, file 10 MiB trên Nest + env clamp, capabilities UI và structured errors | Caddy container >1 MB/over-limit, Nest multipart 1.5 MB/10 MiB+1/invalid MIME |
| R27 | Published LicenseProjectionReader/NotificationWriter, shared PoolClient transaction, no direct cross-module repositories tại các callsite đã nêu | Boundary contract + rollback intent + backend integration; không coi đây là refactor toàn bộ layer legacy |
| R28 | Delivery/schedulers chỉ trong worker; claim token riêng; Redis client reconnect có backoff, ready khôi phục poller và expiry heartbeat | SIGKILL/restart worker, Redis mất queue state rồi restart khi worker vẫn chạy, PG giữ SENT/DEAD_LETTER/backoff đều đạt; còn real vendor semantics và diễn tập restore môi trường triển khai |
| R29 | Product README tự chứa, external PG, guarded init/upgrade, Compose maintenance profile | Compose config và build/typecheck; còn clean-room độc lập theo toàn bộ README |
| R30 | Upgrade explicit trong schema.sql, baseline fingerprint, delta checksum, target fingerprint/drift refusal, CLI guard | PG giữ rows, repeat CURRENT, fresh convergence, drift trước/sau upgrade; chưa chạy trên database vận hành |
| R31 | Current docs, schema count 21/34 capabilities, scope demo và hướng dẫn mới | Baseline validator; giữ nguyên evidence lịch sử có ngày |
| R32 | Bổ sung boundary/regression tests cho các thay đổi trên, CI lấy đủ baseline history và build Kotlin | Các kết quả lệnh mới nhất ghi dưới đây; CI được sửa source, chưa có run trên GitHub |
| R33 | Chưa thực hiện tác động lên dịch vụ thật | **EXTERNAL_BLOCKED**: chưa chỉ định/cho phép sandbox, email recipient, khoản thanh toán và môi trường Sepolia dùng cho đợt nghiệm thu này; không dùng fake/test fixture làm bằng chứng thật |

Quyết định triển khai cụ thể:

- `customerNextAction` nằm ở endpoint `payment-retry` hiện hữu để giữ một owner cho quyết định thử thanh toán; review outcome vẫn trả resolution/evidence. Không thêm endpoint song song.
- Email action nhạy cảm trên mobile dùng form web hiện hữu; pending intent trong SecureStore chỉ giữ ID/action/version, không giữ token. Không còn bắt nhập action token trong mobile; foreground/deep link refetch resource đúng owner.
- Kotlin package thực tế là `vn.emukey.licensedemo`; `LicenseApi.kt` quản lý protocol/token trong stack frame, `DeviceIdentity.kt` lưu identity, `DeviceProof.kt`/`DemoAccess` tách phần thuần để kiểm thử. Không thêm repository token riêng khi token không được lưu lâu dài.
- JDK 17 / AGP 9.4.0 / Gradle 9.6.0, Kotlin 2.4.10, SDK 36, Compose BOM 2025.08.01; Web3j crypto/utils 4.12.3 dùng EIP-191, loại dependency wallet/RPC/KZG; BC 1.86 pin riêng. Web3j 4.14.0 đã bị loại sau khi test phát hiện bytecode Java 21; không tắt kiểm thử để giữ version đó.
- Lượt kiểm chứng cập nhật: backend **290 unit / 19 contract / 17 security**; integration **80 đạt / 1 opt-in Android bỏ qua mặc định, 9 files**. Android opt-in chạy riêng **1/1 đạt**, gồm activate/export/CSV content/restart/revoke/deny-export/offline với API/PG/Redis disposable. Frontend full **241**, rồi error-mapping focused **17/17** gồm 3 ca mới; mobile **29**. Solidity **7**, browser retry **31/31** và workspace navigation **15/15** là kết quả lượt trước, không phải external E2E. Kotlin **2/2**, lint/APK đạt.
- Lint/typecheck/backend OpenAPI consistency/web build/Expo Android export/Compose config đã chạy; GitHub Actions mới chỉ validate YAML/source. Không gọi các kết quả này là production/external E2E.

Ca Android dùng AVD riêng `emukey-phase8-api35` (API 35, locale en-US) và APK debug đã build. Đặt `EMUKEY_ANDROID_SERIAL` thành serial `emulator-...`, `EMUKEY_ADB` thành đường dẫn adb và `EMUKEY_ANDROID_APK` thành đường dẫn APK; chạy từ workspace: `node tooling/emukey/run.mjs backend:integration --testNamePattern="runs the Kotlin"`. Ca này **reset dữ liệu app demo trên emulator được chỉ định**, chạy Nest với ValidationPipe/OptionalAuthGuard thực, PostgreSQL/Redis Testcontainers và canonical/payment fixture; không gửi payment, email hoặc RPC thật. Private account routes bị từ chối trong fixture. CSV/UI dump do ca test tạo được dọn riêng; không xóa file có sẵn.

Regression mới đã bắt lỗi DTO challenge dư field, lời gọi Kotlin `check(Boolean)` vô tình đệ quy thay vì assertion, và HTTP entitlement verify trả 201 trái OpenAPI 200. Không dùng build/JVM tests làm bằng chứng thay cho ca Android này. Row locking của reminder đối chiếu [PostgreSQL 15](https://www.postgresql.org/docs/15/explicit-locking.html); strict payload đối chiếu [Nest validation](https://docs.nestjs.com/techniques/validation).

Lượt tiếp tục: sửa cleanup secret native khi refresh trả 401/403, giữ phiên khi 503, serialize session persistence; bổ sung 10 request refresh đồng thời. Reminder cũ được ẩn/cancel trong transaction gia hạn; reorg khôi phục expiry và reminder đúng kỳ. Durable key receipt trả `KEY_DELIVERY_EXPIRED` riêng, web hướng recovery. Backend manual dead-letter recovery chỉ SYSTEM_ADMIN. Catalog collision test bao gồm 2 × 2 plan khác giá. Android từ chối ngay trước picker nếu không có quyền, rồi xác minh lại trước ghi; kiểm tra CSV qua adb chuẩn hóa CRLF do transport, không thay nội dung file để test đạt. UI dump và các CSV mới của ca test được dọn, giữ nguyên file có trước.

Các file mới có chủ đích trong đợt implementation (30 file; tài liệu kế hoạch này đã có trước baseline hygiene):

- `EmuKey/README.md`: hướng dẫn dựng/vận hành product độc lập.
- `EmuKey/backend/src/entrypoints/database/upgrade.ts`: CLI upgrade giữ dữ liệu, dùng delta trong schema authority hiện hữu.
- `EmuKey/backend/src/modules/assistance-support/worker/support-lease.scheduler.ts`: worker thu hồi claim hết lease.
- `EmuKey/backend/src/modules/blockchain/application/license-projection-reader.ts`, `EmuKey/backend/src/modules/operations/application/notification-writer.ts`: interface công bố của hai module, adapter repository cũ implement.
- `EmuKey/backend/src/modules/blockchain/infrastructure/activation-delivery.repository.ts`: persistence receipt riêng, không tạo thêm license repository.
- `EmuKey/backend/src/modules/operations/operations-worker.module.ts`: đăng ký processors/schedulers riêng worker.
- `EmuKey/frontend/src/presentation/components/KnowledgeCitations.tsx`, `EmuKey/frontend/src/presentation/components/LicensingEmailActionPanel.tsx`: citation/source reader và email action resolver dùng lại API/query owners cũ.
- Dưới `EmuKey/license-client-demo/`: `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`, `gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar`, `gradle/wrapper/gradle-wrapper.properties`, `app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`, `app/src/debug/AndroidManifest.xml`, `app/src/debug/res/xml/debug_network_security.xml`, `app/src/main/res/xml/data_extraction_rules.xml`, và bốn file trong `app/src/main/java/vn/emukey/licensedemo/`: `DeviceIdentity.kt`, `DeviceProof.kt`, `LicenseApi.kt`, `MainActivity.kt`. Đây là delivery unit được scope chấp thuận; wrapper là binary build bootstrap có chủ đích, không phải build output.
- `tests/emukey/backend/integration/database/schema-upgrade.integration.test.ts`, `tests/emukey/backend/unit/platform/database-upgrade.test.ts`: kiểm chứng upgrade/drift.
- `tests/emukey/backend/integration/operations/knowledge-proxy.integration.test.ts`: giới hạn request qua Caddy thật.
- `tests/emukey/frontend/notification-contract.test.ts`: mapper contract response thật.
- `tests/emukey/license-client-demo/DeviceProofTest.kt`: vector EIP-191 và policy feature gate; source chỉ được Gradle nạp khi truyền property test workspace.

### Nhật ký tiếp tục 02/11/2026 — WP09, WP12 và WP05b

- Tái hiện và sửa lỗi claim dùng lại BullMQ job ID: mỗi lần claim nay nhận token ngẫu nhiên riêng. Attempt cũ không thể ACK, cancel hoặc ghi lỗi lên attempt mới của cùng job. Kiểm tra ngay trước gọi adapter bao gồm owner/token, thời hạn lease, canonical state và generation thiết bị.
- Kiểm thử tạo worker ở tiến trình Node riêng, cho HTTP vendor fixture nhận yêu cầu rồi giữ response, SIGKILL tiến trình và khởi động worker thay thế. BullMQ thu hồi cùng job, PostgreSQL ghi SENT ở attempt thứ hai; một logical notification và một effect trong vendor fixture có dedupe. Đây là bằng chứng local, **không chứng minh Brevo/FCM gửi đúng một lần** nếu nhà cung cấp nhận nhưng response mất. Không gọi nhà cung cấp thật.
- HTTP timeout thực qua localhost được retry theo backoff rồi DEAD_LETTER đúng giới hạn. Redis heartbeat lỗi không làm bỏ xử lý claim đang giữ trong PG. Log và last_error chỉ ghi mã lỗi hữu hạn cùng notification/delivery ID; `providerAcknowledged` chỉ cho biết đã quan sát receipt, false không chứng minh vendor chưa nhận.
- Tái hiện ba lỗi lease hết hạn trong lúc chờ khóa hàng: heartbeat, release và reply trước đây vẫn thành công do timestamp lấy trước chờ. Repository nay lấy row lock trước, rồi kiểm tra thời gian DB bằng truy vấn tiếp theo. Hai staff fixture đều tồn tại thật; cạnh tranh claim không còn có thể xanh giả vì lỗi foreign key của staff thứ hai.
- Close/release lặp lại sau mất response không đổi version hoặc tạo audit trùng; thao tác từ generation cũ vẫn bị từ chối sau khi người khác nhận. Audit claim/expire/release dùng generation riêng để không mất lịch sử ở vòng tiếp theo. Hai sweeper chạy đồng thời chỉ requeue một lần mỗi generation, khách vẫn gửi được khi claim staff hết hạn.
- Web ngừng heartbeat khi tab ẩn, khóa form và refetch quyền trước khi foreground heartbeat xác nhận lại. Response cũ không mở khóa form. Lỗi 409 tải lại queue và giữ draft; lỗi kết nối tạm thời có hướng dẫn Làm mới và xác minh lại, không buộc nhận lại hội thoại đang còn thuộc mình.
- Tiếp tục sửa các owner repository/processor/query/screen và test có sẵn; không thêm file source, dependency, schema hay thay hợp đồng HTTP trong lượt này. Các thay đổi của lượt trước được giữ nguyên; không commit/push/deploy.
- Kiểm chứng backend lượt này: **293/293 unit, 90 integration đạt / 2 opt-in bỏ qua mặc định, 19/19 contract, 17/17 security**. Hai opt-in là Android demo và child fixture chỉ dùng khi parent crash test spawn; parent crash test đã chạy đạt. Không chạy lại Android/mobile/Solidity trong lượt này.
- Kiểm chứng web cuối ngày 02/11, sau khi giữ source ổn định: **247/247 frontend tests**, **25/25 internal consoles** chạy riêng, **16/16 browser workspace navigation**. Browser dùng API fixture, bao gồm retry reply cùng clientMessageId nhưng claimVersion mới; không phải external E2E. Lượt web tổng trước đó bắt đầu khi source còn đang sửa có 246/247; không lấy lượt đó làm bằng chứng hoàn tất, đã chạy lại tổng từ đầu và đạt.
- Backend/web lint, typecheck và build đạt; OpenAPI consistency đạt, baseline validator đạt **21 bảng / 34 capability**, diff whitespace và hygiene đạt, không có file untracked mới so với baseline đầu lượt. Web build vẫn có cảnh báo bundle lớn; không tuyên bố đã giải quyết performance hoặc mọi cảnh báo thư viện. Không có review độc lập trong lượt này; các gate chưa đủ bằng chứng vẫn để mở.
- Cơ chế phục hồi đối chiếu [BullMQ stalled jobs](https://docs.bullmq.io/guide/workers/stalled-jobs), [PostgreSQL 15 row locking](https://www.postgresql.org/docs/15/explicit-locking.html), token dùng [Node 22 randomUUID](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptorandomuuidoptions); invalidation theo [TanStack Query v5](https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations). Kết quả thực tế lấy từ regression trong workspace, không thay bằng trích tài liệu.

### Nhật ký tiếp tục 02/11/2026 — Redis recovery và hai tab hỗ trợ

- Tái hiện bằng container Redis thật: `RedisClient` chuyển sang `end` sau restart vì `retryStrategy` trả null. Đổi sang reconnect delay tăng dần, tối đa 2 giây; giữ `maxRetriesPerRequest: 1`, không cho từng command retry vô hạn. Không thay đổi session/permission policy hay đưa durable state sang Redis.
- Sau khi client reconnect được, test tiếp tục đỏ vì lịch BullMQ mất sau restore không được đăng ký lại: scheduler chỉ chạy ở module init. Scheduler hiện nghe `ready`, upsert lại cùng poller ID và quét reminder/ghi expiry heartbeat; gỡ listener khi shutdown. Lỗi khôi phục ghi event hữu hạn, không đưa nguyên connection error vào log.
- Drill dùng PostgreSQL, Redis, BullMQ Worker, NotificationProcessor và NotificationScheduler thật trong process test. Worker vẫn tồn tại; Redis disposable được FLUSHDB/SAVE/restart. Endpoint container được giữ cổng cố định do Docker có thể đổi cổng publish ngẫu nhiên khi restart. Kiểm tra một poller được khôi phục, pending gửi tiếp, SENT không gửi lại, DEAD_LETTER không mở lại, next_attempt_at/attempt_count được giữ và retry chỉ chạy khi đến hạn PostgreSQL. Adapter email là local fixture; không chứng minh vendor thật exactly-once.
- Hai integration case Redis DUMP/RESTORE giữ backup trong RAM: mất envelope rồi khôi phục cho phép cùng deliveryId retry trong window; sau ACK backup cũ không mở lại quyền nhận key. Restore envelope với TTL mới cũng không kéo dài retry_until của receipt đã hết hạn. Sai owner/deliveryId bị chặn; ACK lặp giữ nguyên thời điểm và xóa envelope được replay. Không thêm persistence chứa plaintext key.
- Playwright mở hai Page cùng browser context/tài khoản support. Tab thứ nhất release/claim sang generation mới; tab thứ hai giữ draft, khóa gửi/release/close khi heartbeat mới chưa có response, sau xác minh gửi đúng generation mới và tab kia nhận được đúng một tin qua polling. API là fixture có state chung; quyền thực được đối chiếu với PG regression hai staff/stale version của lượt trước, không gọi đây là hai tab nối backend thật.
- Sửa `platform/redis/redis-client.ts`, scheduler hiện hữu và mở rộng ba test owner hiện có (notification unit/integration, license DB integration), cùng browser workspace navigation. Không thêm file, dependency, schema, migration hoặc thay DTO/OpenAPI.
- Kiểm chứng cuối lượt: backend **295/295 unit**, **93 integration đạt / 2 opt-in bỏ qua, 9 files**, **19/19 contract**, **17/17 security**; browser workspace navigation **17/17**, gồm hai tab chạy riêng và trong suite đầy đủ. Hai opt-in vẫn là Android demo và child fixture do parent crash test gọi; parent crash test đã chạy trong integration. Backend lint/typecheck/build/OpenAPI consistency đạt; baseline **21 bảng / 34 capability**, diff whitespace và hygiene đạt, không có untracked mới so với baseline đầu lượt. Frontend source không đổi; không chạy lại 247 frontend unit, mobile, Kotlin hoặc Solidity trong lượt này.
- Gate còn mở: diễn tập restore theo môi trường triển khai thực tế, full HTTP/Android fault matrix, crash support worker, manager Android và real-provider acceptance ở WP17. Nạp dữ liệu vào Redis đang chạy mà không reconnect cần restart worker theo README; không tuyên bố tự chữa mọi thao tác FLUSHDB/RESTORE online. Không có review độc lập trong lượt này, không commit/push/deploy.
- Nguồn đối chiếu: [ioredis connection/retry semantics](https://github.com/redis/ioredis#auto-reconnect), [BullMQ Job Schedulers/upsert](https://docs.bullmq.io/guide/job-schedulers/), [Redis DUMP](https://redis.io/docs/latest/commands/dump/), [RESTORE](https://redis.io/docs/latest/commands/restore/), [Testcontainers restart](https://node.testcontainers.org/features/containers/#restarting-a-container), [Playwright nhiều Page](https://playwright.dev/docs/pages#multiple-pages). Version cài đặt: ioredis 5.11.1, BullMQ 6.3.4, Testcontainers 12.0.4, Playwright 1.62.1.

### Nhật ký thực thi 01/11/2026

- Working tree trước implementation chỉ có chính kế hoạch này chưa tracked; các source changes tiếp theo thuộc đợt thực hiện hiện tại. Đang làm trực tiếp workspace người dùng đã yêu cầu, giữ nested Git repository, không tạo branch/commit.
- Docker Desktop đã được cho phép khởi động; integration dùng PostgreSQL/Redis disposable qua Testcontainers. Không sử dụng DATABASE_URL vận hành để sửa dữ liệu.
- WP00: regression catalog provider-code collision, notification query/mapper/event name đã chạy đỏ trước sửa. Hai selector dashboard đã cập nhật; frontend focused 7/7 đạt. Fixture notification đã trả page object.
- WP01: đã đưa Licensing qua LicenseProjectionReader, Commerce/Assistance qua NotificationWriter giữ cùng PoolClient transaction; boundary contract đạt. Gate rollback sâu còn kiểm tra integration toàn cục.
- WP02: đã thêm API by-id, identity/provider fields, route/link/query key web theo ID, key danh sách mobile theo ID. Catalog integration hiện có 7/7 đạt; cần thêm HTTP negative/legacy case và browser kiểm tra cuối.
- WP04: native login/refresh/logout + single-flight mobile + session subscription đã triển khai; controller focused 33/33 đạt, mobile suite 21/21 ở lần chạy trước bổ sung UI key. Còn hardening replay/account switch và Android runtime.
- WP05a: numeric query validation, PAYMENT_ACCEPTED alias, mapper canonical, unreadCount tổng, link web đã triển khai. Còn navigation/push native và final consumer contracts.
- WP06: đã thêm durable delivery receipt trong PostgreSQL, bounded key claim/ACK và cập nhật web/mobile client. Unit retry đạt; mobile UI nhận key 3/3 focused đạt. Còn integration concurrency/fault injection và kiểm tra ACK trên mọi surface.
- WP13: fresh/upgrade delta cùng schema.sql; db:upgrade có fingerprint source/checksum, initializer từ chối production/nonempty thiếu flag. Integration upgrade giữ user rows, rerun, fresh convergence và drift refusal đã đạt. Baseline mới 21 bảng/34 capability; đây là schema local source, chưa áp dụng database vận hành.
- WP12: notification processor/scheduler chuyển sang worker module; test boot metadata API ngoài test đã đi đỏ rồi đạt sau sửa. Support lease worker đang nối.
- WP03/WP07/WP09/WP10: đang thực hiện; chưa nghiệm thu. Payment review mới và lease claim đã có regression scenarios nhưng cần chạy matrix đầy đủ.
- Verification gần nhất trước các chỉnh sửa tiếp: backend unit 283/283, focused PG catalog + upgrade 8/8. Không dùng kết quả này để tuyên bố các thay đổi phát sinh sau đó đã đạt.
- Ruling: giữ PostgreSQL external; thêm upgrade explicit trong comment section của SQL authority thay vì schema mirror. Chuẩn hóa CRLF/LF khi fingerprint để Windows checkout không giả thành schema drift.

**Goal:** người dùng hoàn tất mua, thanh toán, nhận key, sử dụng, quản lý thiết bị, gia hạn và hỗ trợ trên những surface được công bố; backend, database, web, mobile, cấu hình và tài liệu diễn đạt cùng một hợp đồng.

**Architecture:** giữ NestJS modular monolith, PostgreSQL qua `pg` và SQL tường minh, Redis/BullMQ cho trạng thái tạm và công việc nền. Sửa theo luồng nghiệp vụ xuyên qua các lớp; dùng application interfaces trong các giao tiếp module đã xác định bị lệch. Không viết lại toàn hệ thống.

**Tech stack hiện có:** Node `>=22.13.0 <23`, pnpm `11.25.0`; NestJS `12.0.1`; TypeScript `6.0.3`; React/Vite/Ant Design/TanStack Query; React Native/Expo; PostgreSQL, Redis, BullMQ; Solidity/viem, Sepolia. Đây là version trong manifest đã đọc, không phải đề xuất nâng cấp.

**Spec:** các quyết định và tiêu chí trong phần 1–4 của tài liệu này là đặc tả đích đề xuất; đối chiếu `context/current/chuc_nang_toan_he_thong_ver2.0.md`, `context/current/cong_nghe_he_thong.md`, `context/current/HDSD.md` và `EmuKey/backend/database/schema.sql`. Mã R01–R33 giữ nguyên thứ tự của review trước.

## 1. Phạm vi, sự thật hiện tại và lựa chọn thiết kế

### 1.1 Cách hiểu “triệt để”

Mỗi điểm phải có: nguyên nhân, owner, hành vi đích, regression test ở boundary phù hợp, cập nhật các client liên quan và bằng chứng nghiệm thu. Không đóng một điểm chỉ vì sửa một màn hình, thêm DTO hoặc có unit test xanh. Không cam kết phần mềm không còn mọi lỗi ngoài 33 điểm đã rà.

Ba lỗi đã được tái hiện riêng ở service/mapper/ValidationPipe: catalog trùng code giữa provider, ánh xạ notification web, `limit` notification từ mobile. Các phát hiện source khác phải được tái hiện trong WP tương ứng trước khi khẳng định lỗi runtime. Nếu tái hiện phủ định nhận định cũ, ghi lại bằng chứng và sửa phạm vi; không tạo thay đổi chỉ để khớp review.

R12, R29, R30 cần phân biệt với bug:

- R12: client tiêu thụ license đã bị loại khỏi scope hiện tại. Kế hoạch đề xuất khôi phục **demo riêng tối thiểu** để chứng minh giá trị sử dụng; đây là mở rộng phạm vi có chủ đích.
- R29: PostgreSQL external là kiến trúc được tài liệu hiện tại chọn. Khắc phục bằng quy trình dựng môi trường có thể tái lập và preflight; không tự đổi Compose mặc định thành mô hình database khác.
- R30: initializer phá hủy là công cụ có chủ đích cho database mới/disposable. Khắc phục bằng một đường upgrade giữ dữ liệu, đồng thời giữ quyền sử dụng initializer cho đúng mục đích.

### 1.2 Phương án triển khai

| Phương án | Đánh đổi | Quyết định |
|---|---|---|
| Vá từng điểm rời rạc | Nhanh ban đầu; dễ lặp lại lệch hợp đồng và bỏ sót web/mobile | Không chọn làm cách tổ chức tổng thể |
| Sửa theo từng luồng, khóa hợp đồng và nghiệm thu theo WP | Có regression rõ, chia nhỏ được, kiểm soát thay đổi dữ liệu | **Chọn** |
| Viết lại kiến trúc hoặc các ứng dụng | Chi phí lớn, mất bằng chứng đang có, tăng rủi ro | Không nằm trong kế hoạch |

### 1.3 Những điều phải giữ

- Runtime/build/deploy của sản phẩm nằm trong `EmuKey/`; tài liệu ở `docs/emukey/`, test ở `tests/emukey/`, tooling ở `tooling/emukey/`. Sản phẩm không import workspace tooling/test.
- Chỉ `EmuKey/backend/database/schema.sql` là SQL schema authority; không tạo bản sao schema, ORM hay auto-sync.
- PostgreSQL quyết định quyền sở hữu, tiền, license/device và durable jobs. Redis mất dữ liệu không được tự làm tăng quyền hoặc tạo license mới.
- Payment return URL không chứng minh đã thanh toán. IPN/đối soát đã xác thực mới được thay đổi trạng thái tiền.
- Giữ exact amount, Terms snapshot, trusted timestamps, cutoff, ownership, idempotency và transaction constraints hiện có. Không nới constraint để làm test xanh.
- Gia hạn không đổi key/device và không tự resume license suspended. Device operational state thuộc PostgreSQL; lifecycle license vẫn đợi xác nhận chain theo policy.
- Runtime blockchain vẫn Sepolia; fake adapter chỉ phục vụ kiểm thử cô lập và phải ghi nhãn rõ.
- Giữ scope không có Contract PDF, hai chữ ký, Customer Controller/KMS. Các nội dung cũ trong skill không ghi đè baseline sản phẩm.
- Giữ mọi thay đổi người dùng; không auto-commit/push/reset. Test ghi dữ liệu dùng tài nguyên disposable, không dùng database vận hành.
- Trước mỗi WP: kiểm tra source mới nhất, version cài đặt, analogous owner; framework/API mới phải đối chiếu tài liệu chính thức đúng version qua `source-driven-development`.

## 2. Hợp đồng đích dùng chung

Đây là hợp đồng **đề xuất mới hoặc phần bổ sung**, không phải mô tả API đã tồn tại. Tên route hiện hữu được giữ khi có thể; OpenAPI là nguồn sinh types cho web/mobile, không viết lại types song song.

### 2.1 Catalog và thanh toán

- Public product định danh bằng UUID `productId`. Giữ `code` trong namespace provider làm mã nghiệp vụ, không dùng nó làm ID toàn cục.
- Bổ sung route API `GET /products/by-id/:productId` trong CatalogController hiện hữu, đặt trước route `:slug`; response có `id`, `providerId`, `providerDisplayName`, `code`, tên, mô tả và plans chỉ thuộc sản phẩm đó. Web dùng `/products/id/:productId` và `/buyer/products/id/:productId`; các route slug cũ được giữ để chuyển tiếp.
- Route slug cũ: chỉ resolve nếu có đúng một published product; không có trả 404; nhiều hơn một trả 409 `AMBIGUOUS_PRODUCT_CODE`, không chọn ngầm bản ghi đầu. Link mới luôn dùng UUID.
- Payment review nhận resolution có nghĩa rõ; `reviewStatus` do backend suy ra. Không còn `RESOLVED -> ACCEPT_AND_FULFILL` mặc định.

```ts
// Hợp đồng transport đề xuất trong commerce.dto.ts; UUID kiểm tra tại DTO.
type PaymentReviewInput =
  | { resolution: 'NO_ACTION'; reason: string }
  | { resolution: 'REFUND_CONFIRMED'; reason: string; refundReference: string }
  | { resolution: 'REMATCHED' | 'ACCEPT_AND_FULFILL'; reason: string;
      orderId: string; paymentAttemptId: string };

type PaymentReviewOutcome = {
  reviewStatus: 'OPEN' | 'RESOLVED' | 'CLOSED_NO_ACTION';
  reviewResolution: PaymentReviewInput['resolution'] | null;
  customerNextAction: 'WAIT' | 'VIEW_LICENSE' | 'CONTACT_SUPPORT' | 'CREATE_NEW_ORDER';
};
```

- `REFUND_CONFIRMED` là ghi nhận bằng chứng hoàn tiền đã có; không tự thực hiện chuyển tiền. `refundReference` lưu cùng evidence review có cấu trúc, không chỉ trong chuỗi mô tả.
- `NO_ACTION` không tự mở lại quyền retry. `customerNextAction` phải đi từ trạng thái order, review, retry policy và bằng chứng payment sau transaction, không do frontend tự đoán.
- Mobile dùng chính HTTPS return URL đã cấu hình cho SePay: intercept đúng origin + path + order hiện tại trong WebView rồi quay về màn native và fetch API. Trường hợp mở trình duyệt ngoài dùng web return page có nút mở app, chỉ mang `orderId` và hint kết quả; hint không cấp quyền.
- Purchase hoàn tất khi license tương ứng đã confirmed và khả dụng; renewal hoàn tất khi **đúng renewal command của order đó** confirmed và expiry projection được cập nhật. Pending lâu phải có hành động hỗ trợ mang đúng order/command, không giả chuyển sang success.

### 2.2 Notification

```ts
// Bổ sung DTO page concrete và target discriminated union trong operations.
type NotificationTarget =
  | { kind: 'LICENSE' | 'ORDER' | 'CONVERSATION' | 'PAYMENT'; id: string }
  | { kind: 'SYSTEM'; id: string | null };
type NotificationPage = {
  items: Array<{ id: string; title: string; content: string; isRead: boolean;
    createdAt: string; readAt: string | null; target: NotificationTarget | null }>;
  nextCursor: string | null;
  unreadCount: number;
};
```

- `unreadCount` là tổng theo owner trong DB, độc lập trang. Mark-read giữ API hiện hữu và invalidate/refetch tổng; không trừ lạc quan khi request thất bại.
- Canonical tên sự kiện thanh toán là `PAYMENT_ACCEPTED`, giữ alias đọc `ORDER_PAYMENT_ACCEPTED` cho dữ liệu cũ. Không rewrite hàng loạt lịch sử chỉ để đổi tên.
- Notification target là đối tượng nội bộ allowlist; không là URL tùy ý. Click mở đối tượng theo role và backend kiểm tra quyền; 403/404 hiện thông báo phù hợp, không rơi vào đối tượng đầu tiên.
- State transition và notification intent ghi cùng DB transaction qua interface do Operations công bố. Dùng bảng notification/delivery đang có, không mặc định thêm event bus/outbox mới.

### 2.3 Session, nhận key và hành động email

- Web giữ HttpOnly cookie refresh hiện có. Native có transport login/refresh/logout riêng dưới `/auth/mobile/*`, dùng cùng IdentityService/session family; refresh token native lưu SecureStore, không trả refresh token vào response login web.
- Native refresh single-flight; mỗi request được retry tối đa một lần sau refresh. Refresh 401 xác nhận mất phiên thì xóa session, dữ liệu account, pending intent và chuyển về đăng nhập. Timeout/5xx không giả thành logout. Không replay mutation có side effect nếu chưa có idempotency key.
- Nhận key chuyển từ “mỗi HTTP request chỉ được đọc một lần” sang “một lần giao logic, retry có giới hạn”. Đây là thay đổi semantics bảo mật cần ghi rõ trong spec và test.

```ts
// Cùng route retrieve hiện hữu, bổ sung body; response mới là additive.
type RetrieveKeyInput = { deliveryId: string }; // UUID client tạo và giữ trước request
type RetrieveKeyOutput = {
  activationKey: string; deliveryId: string; keyVersion: number; retryUntil: string;
};
// POST /licenses/:id/activation-key/ack
type AcknowledgeKeyInput = { deliveryId: string; keyVersion: number };
```

- Claim atomically trong PostgreSQL theo owner + license + issue/rotation command + keyVersion + deliveryId. Bổ sung bảng metadata `license_key_deliveries` vì đây là durable record về một lần giao, tách khỏi terminal chain command bất biến. Unique theo `(license_id, key_version)`; lưu command/owner/delivery ID, claimedAt/retryUntil/acknowledgedAt, không lưu secret. Cùng tuple retry được tối đa **5 phút kể từ claim đầu**, không gia hạn bằng retry; deliveryId khác hoặc owner khác không nhận được key.
- Trong thời gian đó key vẫn chỉ ở encrypted Redis envelope, không vào log, URL, PostgreSQL hoặc web persistent storage. Ack ghi acknowledgedAt bền vững trước, rồi xóa envelope; lỗi xóa Redis không mở quyền đọc lại vì mọi request kiểm tra receipt trong DB. Receipt giữ để ack/retry idempotent và không mở lượt nhận mới; không phụ thuộc tombstone chỉ có trong Redis.
- Redis loss, hết TTL gốc, hết retry window, key version đổi, chain mất canonical hoặc license không đủ điều kiện đều không giao key; trả mã lỗi rõ và dẫn vào recovery hiện có. Chọn `min(TTL còn lại, 5 phút)` làm retry window.
- Web giữ deliveryId không bí mật trong sessionStorage theo account/license; activation key chỉ ở memory. Người dùng xác nhận đã lưu rồi ack. Native lưu key thành công vào SecureStore trước ack; lỗi lưu không ack. Chuyển tài khoản phải xóa dữ liệu key theo owner.
- Email action link resolve đúng owner/action/license/device/generation. Cả recovery, rotate và remote revoke đều có màn tiếp tục tương ứng. Token không bị consume ở bước mở link; yêu cầu mật khẩu/proof theo policy hiện có. Không chuyển token vào query deep-link mới hoặc analytics/log.
- Với mobile, email mở trang xác nhận web thực hiện đúng thao tác; ứng dụng giữ pending intent không chứa secret và refresh kết quả khi foreground. Không bắt người dùng chép token từ email; custom scheme chỉ là nút quay lại app mang ID không bí mật.

### 2.4 Thiết bị, hỗ trợ và AI

- Device thêm `displayName` tối đa 80 ký tự; platform enum `ANDROID|IOS|WINDOWS|MACOS|LINUX|WEB|UNKNOWN`, chỉ metadata hiển thị. Không thay deviceRef, signer, generation hoặc dùng metadata làm chứng cứ quyền.
- Device cũ hiện tên fallback + mã rút gọn; không bịa thông tin nền tảng. Owner được đổi tên qua `PATCH /licenses/:licenseId/devices/:deviceId`.
- Support claim thêm `claimVersion`, `claimExpiresAt`. Heartbeat 30 giây khi console đang hoạt động; lease 120 giây theo thời gian DB. Worker requeue lease hết hạn mỗi 30 giây. Thời gian lấy lại tối đa mục tiêu 150 giây từ heartbeat cuối khi worker khỏe.
- Heartbeat/reply/close/release phải kiểm tra assigned staff, version và lease còn hạn. Tab cũ không hồi sinh claim đã bị người khác nhận; chỉ thao tác claim mới tạo version mới.
- Hỏi AI chỉ khi `AI_ACTIVE`. Sau chuyển hỗ trợ dùng giao diện nhắn nhân viên; CLOSED chỉ đọc và tạo hội thoại mới.
- AI launcher định vị là trợ lý **hỗ trợ sử dụng sản phẩm đã mua**. Thay gợi ý mua gói bằng câu hỏi hỗ trợ; khách chưa có license được dẫn tới catalog/compare và hỗ trợ con người. Không mở quyền đọc tài liệu riêng để đáp ứng lời quảng bá cũ.
- Citation trả `documentId`, `documentTitle`, `documentVersion`, `chunkId`, đoạn trích giới hạn và locator nếu có. Mở nguồn qua endpoint kiểm tra quyền; message cũ thiếu metadata hiển thị “nguồn không còn khả dụng”, không bịa tên hay trang PDF.

## 3. Bản đồ đủ 33 vấn đề

| ID | Điểm cần đóng | Owner WP | Bằng chứng bắt buộc |
|---|---|---|---|
| R01 | Catalog trùng code giữa provider | WP02 | Hai provider cùng code, detail/plans/checkout đúng UUID |
| R02 | Review payment lệch UI/service/SQL | WP03 | Matrix resolution chạy qua HTTP + PostgreSQL thật cô lập |
| R03 | Buyer/admin lệch trạng thái rà soát | WP03 | Cùng transaction cho cùng trạng thái và next action |
| R04 | Mobile return URL không khớp | WP08 | WebView/browser return, cancel/error/kill app |
| R05 | Mobile chưa theo dõi fulfillment | WP08 | Purchase/renewal dừng pending đúng command |
| R06 | Mobile chưa nhận/recover/rotate key | WP06, WP07 | Nhận key và khôi phục trên Android |
| R07 | Điều kiện renewal khác nhau | WP07 | ACTIVE/EXPIRED/SUSPENDED/REVOKED trên cả hai client |
| R08 | Web thiếu revoke device | WP07 | Owner remote revoke; non-owner bị từ chối |
| R09 | Tên thiết bị khó nhận biết | WP07 | Tạo, đổi tên, fallback dữ liệu cũ |
| R10 | Email action handoff đứt đoạn | WP07 | Mở email, login lại, tiếp tục đúng action |
| R11 | Mất response lần nhận key | WP06 | Fault injection sau server claim, retry cùng delivery |
| R12 | Thiếu phần mềm tiêu thụ license | WP15 | Tính năng demo bật/tắt theo entitlement thật |
| R13 | Notification limit bị 400 | WP05 | Query string qua global ValidationPipe thật |
| R14 | Notification mapper sai trường | WP05 | DTO backend đi qua consumer web/mobile |
| R15 | Event name thanh toán lệch | WP05 | Dữ liệu mới và alias lịch sử đều có target |
| R16 | Notification không điều hướng | WP05 | Click trong app và tap push đúng đối tượng |
| R17 | Badge chỉ đếm trang đã tải | WP05 | 45 unread, page size 20 vẫn badge 45 |
| R18 | Thiếu lifecycle notification | WP05, WP12 | Finalized events/retry/reorg không gửi sai/trùng |
| R19 | Mobile session/refresh/state lệch | WP04 | Hết hạn, concurrent 401, offline và account switch |
| R20 | UI cho hỏi AI sai state | WP09 | Ma trận state/role/action qua UI và API |
| R21 | Mobile support status stale | WP09 | Staff claim/close được phản ánh khi polling/foreground |
| R22 | Staff bỏ đi, claim bị giữ | WP09 | Lease expire/reclaim/stale staff rejection |
| R23 | Lời giới thiệu AI vượt data scope | WP10 | Khách chưa mua không được hứa tư vấn từ nguồn riêng |
| R24 | Citation khó kiểm chứng | WP10 | Đọc đúng nguồn, version và permission |
| R25 | Popup AI/lịch sử bị phân mảnh | WP10 | Reload, tiếp tục và mở hội thoại đầy đủ |
| R26 | 10 MB UI/backend, 1 MB proxy | WP11 | Upload qua Caddy ở các biên kích thước |
| R27 | Cross-module repository coupling | WP01 | Static boundary + transaction rollback integration |
| R28 | API và worker cùng chạy notifications | WP12 | Khởi động riêng từng process, worker restart |
| R29 | Setup external DB khó tái lập | WP14 | Clean-room theo README bằng DB disposable ngoài Compose app |
| R30 | Thiếu upgrade giữ dữ liệu | WP13 | Upgrade clone có dữ liệu, fail rollback, rerun |
| R31 | Current docs lệch baseline | WP16 | Validator đọc facts hiện tại, lịch sử được ghi nhãn |
| R32 | Test component không khóa contracts | WP00, WP17 | HTTP contract, generated types, các consumer và UI |
| R33 | Thiếu full real-service E2E | WP17 | Web + Android + real IPN + Sepolia evidence cùng revision |

## 4. Thứ tự và điều kiện chuyển đợt

| Đợt | Work package | Phụ thuộc và điều kiện ra khỏi đợt |
|---|---|---|
| A — khóa baseline | WP00, WP01; thiết kế/schema tooling WP13 | Reproduction rõ; không mất transaction khi đổi boundaries; có upgrade harness trước schema changes |
| B — correctness và hợp đồng | WP02, WP03, WP04, WP05a | Catalog/payment/auth/notification HTTP contracts và negative tests đạt |
| C — hoàn tất hành trình mua | WP06, WP07, WP08 | Web + Android mua, nhận key, recovery, renewal qua boundary thực của ứng dụng |
| D — hỗ trợ và vận hành | WP09, WP10, WP11, WP12, WP05b, WP14 | Lease/AI/upload/notification jobs/setup đạt gate |
| E — chứng minh sản phẩm | WP15, WP16, WP17 | Demo consumer và evidence đầy đủ, docs phản ánh đúng kết quả |

WP05a là DTO/paging/navigation; WP05b là producer lifecycle và delivery worker, phụ thuộc WP01/WP12. WP13 triển khai harness sớm; mỗi WP thay schema phải thêm upgrade được test ngay, không dồn đến cuối. WP16 cập nhật tài liệu đồng thời với mỗi WP, cuối đợt E chỉ kiểm tra hợp nhất.

WP02, WP04, WP11 có thể làm độc lập khi đã khóa contracts. Những WP cùng sửa `EmuKeyMobileApp.tsx`, schema hoặc generated types phải thực hiện tuần tự hoặc có phân công file rõ. Không mặc định dispatch subagent.

## 5. Work packages và bước thực hiện

Mỗi WP có vòng: test tái hiện thất bại có ý nghĩa → thay đổi nhỏ nhất đáp ứng hợp đồng → test focused → kiểm tra client/DB liên quan → diff review → ghi evidence. Không thêm test chỉ kiểm tra implementation tự gọi lại chính nó.

### WP00 — Khóa baseline và bộ regression đầu vào

**Phạm vi:** R32; áp dụng cho toàn bộ kế hoạch.

**Sửa owner có sẵn:** `tests/emukey/frontend/api-backed-screens.test.tsx`, `tests/emukey/frontend/setup.ts`, `tests/emukey/backend/unit/notification-contract.test.ts`, `tests/emukey/backend/contract/platform/api-platform.contract.test.ts`, các test integration của WP sau.

- [x] Ghi revision, Node/pnpm thực tế, git status và capability/schema facts bằng validator hiện tại; không tái sử dụng kết quả test cũ như evidence mới.
- [x] Thêm regression catalog hai provider cùng code; notification `?limit=20`; notification DTO sang consumer. Chạy trước sửa và lưu thông điệp thất bại đúng nguyên nhân.
- [x] Sửa hai selector dashboard lỗi thời theo accessible role/name và hành động điều hướng thực; không bỏ assertion hoặc thêm dấu mũi tên trở lại chỉ để test xanh.
- [x] Sửa fixture notification trả page object đúng contract, không mặc định array che lỗi parser. Fixture authenticated phải có owner và trạng thái hợp lệ.
- [ ] Ghi từng Rxx: REPRODUCED / SOURCE_CONFIRMED / DESIGN_GAP / EXTERNAL_BLOCKED. Chỉ chuyển CLOSED khi gate của WP đạt.

**Gate:** baseline test report có phân loại lỗi; fixture không tự dựng một hợp đồng trái backend.

### WP01 — Sửa ranh giới module giữ nguyên transaction

**Phạm vi:** R27. **Sửa:** `EmuKey/backend/src/modules/licensing/licensing.service.ts`, `licensing.module.ts`; `modules/commerce-payment/infrastructure/commerce.repository.ts`, `commerce.module.ts`; `modules/operations/operations.module.ts`; `modules/blockchain/blockchain.module.ts` và application query hiện có. Prefix `modules/` ở đây là `EmuKey/backend/src/modules/`.

**Tạo có owner rõ:** `EmuKey/backend/src/modules/operations/application/notification-writer.ts` cho application interface; `EmuKey/backend/src/modules/blockchain/application/license-projection-reader.ts` cho published read interface. Adapter repository hiện hữu implement interface; không tạo repository thứ hai. Reuse `NotificationCreateInput`, `NotificationRecord` và `enqueueInTransaction` đang có; interface mới công bố trách nhiệm này qua DI, không viết lại cơ chế enqueue.

**Giao tiếp:** Licensing consume các projection query đang dùng qua reader, giữ signatures/return type hiện tại tại bước refactor. Commerce/support/blockchain consume notification writer có tham số transaction context dùng chung connection hiện có; writer chỉ ghi intent, không gửi email/push trong transaction. Transaction vẫn do use case gọi chịu trách nhiệm commit/rollback.

- [ ] Đặt test transaction rollback: tạo business effect + notification intent rồi gây lỗi trước commit; cả hai không tồn tại sau rollback.
- [x] Trích interface từ đúng các callsite hiện có; đổi DI sang token/interface; không đổi nghiệp vụ ở bước này.
- [ ] Đưa policy payment review mới vào application/domain tại WP03; repository còn persistence/locking. SQL constraints giữ vai trò phòng thủ.
- [x] Thêm boundary assertion vào `tests/emukey/backend/contract/platform/api-platform.contract.test.ts`: module không import `../<other>/infrastructure/*`, ngoại lệ có chủ đích phải được giải thích cụ thể trong source.
- [x] Chạy unit, security, focused integration; rà import graph để không tạo vòng DI mới.

**Gate:** không còn các direct cross-module repository dependencies đã nêu; transaction invariants vẫn giữ. Không refactor mọi file khác chỉ để đạt hình thức layer.

### WP02 — Định danh catalog theo UUID

**Phạm vi:** R01. **Sửa:** `EmuKey/backend/src/modules/catalog/{application/catalog.service.ts,infrastructure/catalog.repository.ts,presentation/catalog.controller.ts,presentation/catalog.dto.ts}`; `EmuKey/frontend/src/application/catalog/catalogQueries.ts`, `EmuKey/frontend/src/presentation/app/App.tsx`, `EmuKey/frontend/src/presentation/screens/{CatalogScreen.tsx,ProductDetailScreen.tsx}`; `EmuKey/mobile/src/presentation/EmuKeyMobileApp.tsx`; generated types sau export.

**Test owner:** `tests/emukey/backend/integration/catalog/catalog-lifecycle.integration.test.ts`, `tests/emukey/frontend/purchase-flow.test.tsx`, `tests/emukey/mobile/unit/phase3-phase4-screens.test.tsx`.

- [ ] Seed hai provider published có `code='shared-code'`, mỗi bên hai plan khác giá; test detail theo UUID chỉ có hai plan đúng provider. Legacy slug phải 409.
- [x] Thêm DTO identity/provider display fields, API UUID và legacy ambiguity handling theo 2.1. Query filter theo product ID trước khi join plans.
- [x] Đổi links, React keys, query keys và mobile selection sang product ID; plan ID vẫn là input tạo order, backend kiểm tra membership/publication.
- [x] Regenerate web/mobile types bằng scripts đã có; sửa callsites, không sửa tay file generated.
- [ ] Test draft/unpublished 404; UUID lạ 404; plan của product khác không được trộn; order snapshot đúng provider sau khi mở từ danh sách và deep link cũ.

**Gate:** test qua DB/HTTP và màn mua hàng; không áp global unique code để che sai mô hình nhiều provider.

### WP03 — Review payment có resolution thật và trạng thái thống nhất

**Phạm vi:** R02–R03. **Sửa:** `EmuKey/backend/src/modules/commerce-payment/application/commerce.service.ts`, `infrastructure/commerce.repository.ts`, `presentation/commerce.dto.ts`, `presentation/commerce.controller.ts`, domain policies hiện hữu; `EmuKey/backend/database/schema.sql` chỉ khi thêm structured evidence; `EmuKey/frontend/src/presentation/components/PaymentReviewPanel.tsx`, `screens/PaymentStatusScreen.tsx`, `application/orders/orderQueries.ts`; mobile payment status.

**Test owner:** `tests/emukey/backend/integration/commerce/commerce-flow.integration.test.ts`, `tests/emukey/backend/unit/payment.controller.test.ts`, `tests/emukey/backend/unit/payment-retry-policy.test.ts`, `tests/emukey/frontend/buyer-commerce.test.tsx`, `tests/emukey/frontend/internal-consoles.test.tsx`.

| Classification | Resolution được xét | Gate bắt buộc |
|---|---|---|
| MATCHED có review OPEN | REFUND_CONFIRMED, NO_ACTION | Không cấp thêm license/command; evidence hoàn tiền khi có refund |
| AMOUNT_MISMATCH | REFUND_CONFIRMED, REMATCHED, NO_ACTION | REMATCHED chỉ với existing order/attempt có đúng số tiền và mọi gate thời gian; cấm accept trực tiếp |
| UNMATCHED, INVALID có evidence đã xác thực | ACCEPT_AND_FULFILL, REMATCHED, REFUND_CONFIRMED, NO_ACTION | Hai resolution fulfillment chạy lại exact gate auto-IPN; không dùng admin để hợp thức hóa payload giả |
| DUPLICATE không có review | Không cho resolve | Giữ idempotency; không tạo review giả chỉ để hiện nút |
| Review terminal | Retry cùng logical input trả kết quả cũ; input khác bị từ chối | Không rewrite actor/effect tuple hoặc fulfillment |

- [x] Viết integration matrix trên schema thật, gồm thiếu Terms, sai amount, sát cutoff, terminal order, attempt failed, duplicate callback và hai admin resolve đồng thời. Matrix HTTP bổ sung 02/11 kết hợp các boundary PG hiện hữu; không thay bằng repository mock.
- [ ] Thay input status mơ hồ bằng union resolution 2.1; role SYSTEM_ADMIN thống nhất cả controller/service. API cũ gửi chỉ status bị từ chối có mã hướng dẫn nâng client, không default sang accept.
- [ ] Dùng transaction và lock hiện có; gọi chung primitive fulfill/reconcile với auto-IPN. Trong commit phải đồng nhất payment effect, attempt SUCCEEDED, order PAYMENT_ACCEPTED, license/renew command và notification intent.
- [ ] Refund/no-action chỉ lưu outcome đúng nghĩa. Không bỏ ràng buộc immutable hoặc resurrect order hết hạn. Với refund sau provisioning, đi đúng flow thu hồi/khắc phục hiện có và theo dõi command; refund record không được giả thành đã revoke.
- [ ] UI đưa choice phù hợp classification, summary hậu quả, evidence required và backend errors có hành động tiếp theo. Không ghi “chỉ lưu ghi chú” với fulfillment.
- [ ] Buyer/admin/mobile đọc reviewStatus/reviewResolution/customerNextAction; đóng review không còn hiện OPEN, nhưng retry vẫn tuân policy uncertainty.

**Gate:** matrix qua HTTP + PG đạt; replay không tạo license/command thứ hai; khách và admin thấy cùng outcome khi refetch.

### WP04 — Native session refresh và đồng bộ UI

**Phạm vi:** R19. **Sửa:** `EmuKey/backend/src/modules/identity-access/{identity.controller.ts,identity.dto.ts,identity.service.ts}`; `EmuKey/mobile/src/infrastructure/api/client.ts`, `EmuKey/mobile/src/presentation/EmuKeyMobileApp.tsx`. Tách session owner khỏi file client chỉ khi cần, tại `EmuKey/mobile/src/infrastructure/session.ts`, di chuyển toàn bộ owner cũ, không giữ hai store.

**Test:** `tests/emukey/backend/integration/identity/identity-flow.integration.test.ts`, `tests/emukey/backend/security/http-authorization-negative.test.ts`, `tests/emukey/mobile/unit/api-client.test.ts`, `tests/emukey/mobile/unit/app.test.tsx`.

- [ ] Thêm native transport `/auth/mobile/login`, `/refresh`, `/logout`, cùng policy session-family/revocation và password reset. Rate-limit cùng mức auth hiện có; web login vẫn không trả refresh token body.
- [ ] Save/restore SecureStore có version; session cũ chỉ có access token vẫn mở app nhưng nếu không refresh được thì đưa về login đúng một lần.
- [ ] Implement single-flight refresh; 10 request 401 đồng thời chỉ một refresh. Lưu token xoay mới trước khi retry request; retry tối đa một lần, giữ idempotency key.
- [ ] App subscribe thay đổi session; logout/confirmed refresh401 xóa cache, key/intent của account và gỡ push registration theo khả năng hiện có; không xóa device identity không thuộc account một cách tùy tiện.
- [ ] Test network timeout/5xx giữ phiên, refresh reuse bị chặn, app restart, password reset, account A→B không lộ dữ liệu/intent A. Mất response refresh sau rotation phải cho trạng thái login lại rõ ràng, không vòng lặp retry vô hạn.

**Gate:** Android đứng ở màn private trong lúc access token hết hạn vẫn refresh được; revoke session chuyển UI về login, không còn màn giả đăng nhập.

### WP05a — Notification contract, badge và điều hướng

**Phạm vi:** R13–R17. **Sửa:** `EmuKey/backend/src/modules/operations/presentation/{notification.controller.ts,notification.dto.ts}`, `application/notification.service.ts`, `infrastructure/notification.repository.ts`; `EmuKey/frontend/src/application/notifications/notificationQueries.ts`, `presentation/components/NotificationCenter.tsx`; `EmuKey/mobile/src/infrastructure/api/client.ts`, `presentation/EmuKeyMobileApp.tsx` và push registration owner hiện có.

**Test:** `tests/emukey/backend/unit/notification-contract.test.ts`, `tests/emukey/backend/integration/operations/phase7-notification.integration.test.ts`, `tests/emukey/backend/contract/platform/api-platform.contract.test.ts`, `tests/emukey/frontend/api-backed-screens.test.tsx`, `tests/emukey/mobile/unit/api-client.test.ts`.

- [x] Supertest thật qua bootstrap ValidationPipe: absent limit và `'20'` thành 20; `'0'`, `'51'`, `'abc'`, `'1.5'`, array bị 400. Explicit numeric transform ở DTO, không bật implicit conversion toàn app.
- [ ] Concrete DTO page/target đúng 2.2, generated types đúng fields. Web/mobile đọc `createdAt`, `target`, `items`, `nextCursor`, `unreadCount`; bỏ compatibility array khi đã nâng mọi caller nội bộ.
- [ ] Canonical event name và alias; dữ liệu type lạ hoặc target thiếu ID trả null, không điều hướng bằng payload tùy ý.
- [ ] 45 unread/page20 phải hiện 45; đọc một còn 44; đánh dấu trùng giữ 44; failed mark-read không đổi; owner khác không được đếm hoặc đọc.
- [ ] Click item mở route đúng role/ID; mark-read failure không ngăn mở đối tượng. Xử lý deleted/forbidden bằng state có thể quay lại danh sách.
- [ ] Native tap push foreground/background/cold-start dùng cùng resolver với in-app notification; đợi restore session, refetch notification theo owner rồi mới navigate. Logout xóa pending navigation.

**Gate:** backend DTO thực đi vào hai consumer; badge không phụ thuộc số trang; có kiểm tra Android cold-start push khi có môi trường FCM thật.

### WP05b — Nối lifecycle với notification bền vững

**Phạm vi:** R18. **Phụ thuộc:** WP01, WP12, WP13. **Sửa:** chain event application/projection owner, commerce/support transitions và Operations writer/repository; `EmuKey/backend/database/schema.sql` chỉ thêm dedupe field/index nếu constraint hiện có chưa biểu diễn được.

| Event | Thời điểm tạo intent | Dedupe key logic |
|---|---|---|
| PAYMENT_ACCEPTED | Transaction nhận tiền | payment effect ID + recipient |
| LICENSE_CONFIRMED / LICENSE_RENEWED | Canonical finalized projection được apply | command ID + transition version + recipient |
| LICENSE_SUSPENDED / LICENSE_REVOKED | Canonical lifecycle transition | command ID + transition version + recipient |
| LICENSE_EXPIRING | Còn 7 ngày hoặc 1 ngày, quét DB worker mỗi giờ | license ID + expiresAt + mốc + recipient |
| SUPPORT_REPLY | Staff message đã commit | message ID + customer ID |
| PAYMENT_REVIEW_REQUIRED / PAYMENT_REVIEW_RESOLVED | Review mở/terminal | transaction ID + review transition + recipient |

- [ ] Tạo intent cùng business transaction qua application interface; giữ recipient authorization, không gửi secret/key hoặc nội dung private không cần thiết vào push.
- [ ] Worker trước gửi notification license xác minh transition vẫn canonical. Nếu reorg trước delivery thì hủy intent cũ; nếu đã gửi thì tạo notification cập nhật trạng thái, không giả xóa thông báo đã đến thiết bị.
- [ ] Retry/reindex/reconcile cùng logical transition không tạo bản sao. Reconfirmation sau thông báo reorg phải có transition version mới để báo cập nhật đúng một lần.
- [x] Expiry nhắc theo effective license/expiry hiện tại, renewal thay expiry làm job cũ không còn hợp lệ; không nhắc nhầm license revoked.

  Bằng chứng bổ sung: `license-db-invariants.integration.test.ts` kiểm tra mốc 7 ngày/1 ngày, dedupe, renewal ẩn inbox cũ và từ chối delivery cũ, reorg renewal khôi phục expiry từ ISSUE canonical và hiện lại reminder cũ mà không tạo bản sao. Selector giữ khóa SHARE license để không enqueue reminder cũ sau transaction gia hạn. Đồng hồ chỉ được dịch trong adapter test của reminder selector; payment/schema/canonical events vẫn dùng pipeline thật.
- [x] Integration kill worker sau commit, restart, delivery retry và provider timeout. Phân biệt đảm bảo một logical notification với delivery ngoài có thể lặp khi vendor nhận nhưng response mất; dùng vendor idempotency nếu có, ghi evidence khi không có. Bằng chứng 02/11 là PG/Redis/BullMQ thật và HTTP vendor fixture có dedupe; nghiệm thu vendor thật vẫn thuộc WP17.

**Gate:** không mất intent sau crash; không gửi “sẵn sàng dùng” trước finality; test tái xử lý/reorg và expiry mới đạt.

### WP06 — Giao key chịu được retry và mất response

**Phạm vi:** R11, nền cho R06. **Sửa:** `EmuKey/backend/src/modules/blockchain/application/{license-query.service.ts,activation-envelope-recovery.service.ts,ports/activation-envelope.port.ts}`, `infrastructure/redis-activation-envelope.ts`, `presentation/{license.controller.ts,license.dto.ts}`; web license queries/recovery panel và mobile API.

**Tạo persistence owner:** `EmuKey/backend/src/modules/blockchain/infrastructure/activation-delivery.repository.ts` cho receipt claim/ACK; caller là LicenseQueryService, wiring trong BlockchainModule. Repository này sở hữu bảng delivery mới, không thay thế hoặc sao chép license projection repository.

**Test:** `tests/emukey/backend/unit/license-query.service.test.ts`, `tests/emukey/backend/unit/activation-envelope-recovery.service.test.ts`; mở rộng `tests/emukey/backend/integration/blockchain/license-db-invariants.integration.test.ts`, owner đã có PostgreSQL/Redis thật, commerce issue fixture, delivery concurrency và restore/ACK boundary. Không tạo thêm integration file song song.

- [ ] Viết tests claim-first-response-lost, concurrent same ID, concurrent different ID, ACK lost, TTL boundary, owner mismatch, Redis loss và keyVersion đổi.
- [x] Redis envelope loss/restore cùng deliveryId giữ nguyên receipt và retryUntil; backup replay sau ACK không mở lại quyền; TTL Redis mới không kéo dài cửa sổ receipt PostgreSQL. Hai case DUMP/RESTORE đã chạy trên container thật.
- [ ] Thay `consume` cho user retrieval bằng claim/read/ack protocol 2.3: claim/ACK metadata bằng transaction PG; đọc encrypted envelope có giới hạn từ Redis; không yêu cầu distributed transaction giữa hai hệ thống. Claim đã commit nhưng Redis lỗi thì cùng deliveryId retry được trong window. Thêm bảng/upgrade receipt qua WP13, persistence owner đặt cạnh license query trong Blockchain infrastructure.
- [ ] Mỗi request kiểm tra lại owner, receipt chưa ACK, canonical command, current keyVersion và trạng thái đủ điều kiện trước trả secret. Replay Redis backup sau ACK vẫn bị DB chặn; envelope prepare/recovery không reset receipt. Lease/retry window không thay thế authorization.
- [ ] Expose typed errors `KEY_DELIVERY_EXPIRED`, `KEY_ALREADY_DELIVERED`, `KEY_UNAVAILABLE`, trạng thái pending/reorg đang có; UI chuyển recovery đúng nghĩa.
- [ ] Client tạo/lưu deliveryId trước POST. Web chỉ ack khi người dùng xác nhận lưu; mobile chỉ ack sau SecureStore ghi thành công. Retry ACK idempotent, ACK sai version/ID bị từ chối.
- [ ] Header secret response `Cache-Control: no-store`; redaction test không chứa key/token trong logger; không để service worker/cache lưu response.

**Gate:** ngắt phản hồi sau server xử lý rồi retry cùng ID nhận cùng key trong window; khác ID/owner không nhận được; sau ACK chỉ recovery flow hợp lệ mới cấp key mới.

### WP07 — License/device parity và email handoff

**Phạm vi:** R06–R10. **Sửa:** `EmuKey/backend/src/modules/licensing/{licensing.controller.ts,licensing.dto.ts,licensing.service.ts,infrastructure/licensing.repository.ts}`, blockchain license/device DTO/projection; commerce renewal preview; `EmuKey/frontend/src/application/licenses/licenseQueries.ts`, `presentation/screens/{BuyerLicenseHubScreen.tsx,AuthScreen.tsx}`, recovery panel và router; `EmuKey/mobile/src/infrastructure/api/client.ts`, `presentation/EmuKeyMobileApp.tsx`; schema và upgrade WP13.

**Test:** `tests/emukey/backend/unit/licensing.service.test.ts`, `tests/emukey/backend/unit/renewal-policy.test.ts`, `tests/emukey/backend/integration/blockchain/license-db-invariants.integration.test.ts`, `tests/emukey/frontend/buyer-hub.test.tsx`, `tests/emukey/e2e/web/buyer-ui-recovery.spec.ts`, `tests/emukey/mobile/unit/license-screens.test.tsx`.

- [ ] Nối mobile nhận key, xem key đã lưu theo owner, recovery và rotate; các command dùng stable request ID và theo dõi command cũ sau reload/foreground, không tạo lại mỗi poll.
- [ ] Cả hai client dựa trên renewal preview `canRenew`/reason từ backend; ACTIVE, EXPIRED, SUSPENDED theo policy, REVOKED bị chặn. Renewal pending/unknown/dead-letter chưa giải quyết không mở renewal lane khác.
- [ ] Web dùng **remote revoke** hiện có cho thiết bị khác; không giả self-proof. Confirmation nêu tên thiết bị, yêu cầu password/action verification, giữ action purpose/generation binding.
- [ ] Thêm displayName/platform nullable/default UNKNOWN, rename owner-only; validate length/enum, escape render. Metadata không làm thay đổi chữ ký/proof/quota. Backfill không phát minh thông tin thiết bị cũ.
- [ ] Action resolver render form đúng recovery/rotate/remote revoke. Nếu login cần thiết, giữ pending action token trong session memory; khi cần survive auth reload dùng sessionStorage có TTL ngắn và xóa sau xử lý; tuyệt đối không log token. Token chỉ được dùng đúng owner đã bind, không coi mở email là thực thi.
- [ ] Mobile có pending intent lưu ID/action, khi quay từ email web hoặc foreground thì refetch device/command/license; khôi phục navigation tới đúng đối tượng.
- [ ] Test wrong owner, expired/reused token, action mismatch, stale generation, revoked device, duplicate click và concurrent remote revoke; cả web/mobile có trạng thái lỗi để tiếp tục.

**Gate:** cùng account quản lý cùng license trên web/mobile ra kết quả nhất quán; không phải chép token; metadata cũ vẫn sử dụng được.

### WP08 — Hoàn tất thanh toán và fulfillment trên mobile

**Phạm vi:** R04–R05. **Phụ thuộc:** WP03, WP04, WP06, WP07. **Sửa:** `EmuKey/mobile/src/presentation/EmuKeyMobileApp.tsx`, `EmuKey/mobile/app.json`, API client; `EmuKey/frontend/src/presentation/screens/PaymentStatusScreen.tsx`; SePay gateway chỉ thay đổi nếu cần lưu return intent, giữ allowlist và signed checkout.

**Test:** `tests/emukey/backend/unit/sepay-payment.gateway.test.ts`, `tests/emukey/mobile/unit/phase3-phase4-screens.test.tsx`, `tests/emukey/e2e/mobile/phase6-license-flow.yaml`, `tests/emukey/e2e/web/payment-status-flow.spec.ts`.

- [ ] Tách payment/fulfillment screen logic khỏi file mobile lớn nếu cần, vào `EmuKey/mobile/src/presentation/screens/PaymentScreen.tsx`; di chuyển component hiện có, không giữ bản duplicate.
- [ ] URL parser so khớp protocol/origin/path và order ID; xử lý success/error/cancel return đều fetch server. Return giả hoặc order khác không đổi state.
- [ ] WebView intercept HTTPS return đóng checkout; external browser có nút quay lại app. Cold start deep link đợi auth, xác minh owner và resume đúng order.
- [ ] Poll order + đúng license/renewal command khi cần, pause background, refresh foreground; timeout UX sau 120 giây hiện “đang xử lý” với liên kết hỗ trợ, không coi là failed hoặc cho trả tiền lại.
- [ ] Khi confirmed mới hiện nhận key hoặc expiry mới; renewal không hiện cấp key mới. Invalidations cập nhật Orders/Licenses khi quay lại, không cần người dùng tự kéo refresh.
- [ ] Test delayed IPN, provider cancel nhưng IPN đến sau, app kill trong checkout, callback hai lần, command UNKNOWN/DEAD_LETTER, indexer chậm và renewal confirmed nhưng projection chưa cập nhật.

**Gate:** người dùng thấy điểm kết thúc đúng; không double-pay/double-order vì return/refresh/retry; phải có run trên Android thực hoặc emulator, Jest không thay thế gate này.

### WP09 — Support state machine và claim lease

**Phạm vi:** R20–R22. **Sửa:** assistance controller/service/types/DTO/repository trong `EmuKey/backend/src/modules/assistance-support/`; `EmuKey/frontend/src/presentation/screens/{BuyerAssistanceScreen.tsx,SupportConsoleScreen.tsx}`, `application/assistance/supportQueries.ts`, ConversationPanel; mobile AssistanceScreen; schema/upgrade.

**Tạo nếu chưa có owner:** `EmuKey/backend/src/modules/assistance-support/worker/support-lease.scheduler.ts`, đăng ký worker-only. Lease là durable state trong conversations, không chỉ Redis lock.

**Test:** `tests/emukey/backend/integration/assistance/phase7-assistance.integration.test.ts`, `tests/emukey/backend/unit/assistance-support.service.test.ts`, `tests/emukey/frontend/assistance-contract.test.ts`, `tests/emukey/frontend/internal-consoles.test.tsx`, `tests/emukey/mobile/unit/app.test.tsx`.

- [x] Khóa action matrix: AI_ACTIVE cho AI/escalate; WAITING_SUPPORT cho customer message và staff claim; SUPPORT_ACTIVE cho customer/assigned staff message; CLOSED chỉ đọc. Backend enforce mọi action.
- [ ] Web/mobile disable/hide ask AI ngoài AI_ACTIVE, phản hồi 409 phải refetch conversation. Mobile polling status + messages cùng conversation ID, guard stale response khi chuyển hội thoại.
- [x] Thêm lease/version/heartbeat theo 2.4. Claim đồng thời chỉ một người thắng; heartbeat dùng conditional update đúng owner/version, hết hạn không kéo dài. PG regression bao gồm chờ row lock qua thời hạn, không chỉ request bắt đầu sau expiry.
- [ ] Worker requeue atomic expired claims, clear assignment và cập nhật queue; close/release idempotent. UI countdown/error thông báo mất quyền khi tab cũ thức lại.
- [x] Presence không phụ thuộc unload event; logout có thể best-effort release nhưng lease mới là đảm bảo. Tab hidden ngừng heartbeat, foreground refetch trước gửi. UI regression chặn response heartbeat cũ và cho phục hồi sau lỗi kết nối tạm thời; không tuyên bố đã nghiệm thu mọi browser/mobile runtime.
- [x] Test worker dừng rồi chạy lại, staff crash, late reply, two tabs, customer gửi khi claim hết hạn, closed conversation không được reopen bằng heartbeat.

**Gate:** không có hội thoại bị giữ vô hạn do staff rời đi; messages và status không đi lệch nhau trên mobile.

### WP10 — AI đúng phạm vi, nguồn đọc được, lịch sử liên tục

**Phạm vi:** R23–R25. **Sửa:** `EmuKey/backend/src/modules/assistance-support/{ai-assistance.service.ts,knowledge.service.ts,knowledge.controller.ts,knowledge.dto.ts,infrastructure/knowledge.repository.ts}`; AI response DTO/message persistence hiện có, schema/upgrade nếu thêm citation snapshot; `EmuKey/frontend/src/presentation/components/AiAssistantLauncher.tsx`, BuyerAssistanceScreen, assistance query owner; mobile AI message rendering.

**Test:** `tests/emukey/backend/unit/ai-assistance.service.test.ts`, `tests/emukey/backend/unit/knowledge-response.test.ts`, assistance integration, `tests/emukey/frontend/completed-flows.test.tsx`, mobile app tests.

- [ ] Thay copy và empty state theo 2.4; khách chưa mua có link catalog/compare và hỗ trợ con người. Không tăng quyền knowledge để chữa lời giới thiệu.
- [ ] Citation trả metadata thật từ document/chunk; endpoint `GET /knowledge/documents/:documentId/chunks/:chunkId` kiểm tra cùng quyền đọc tài liệu. Không lộ storage key hoặc publicize private Cloudinary URL.
- [ ] Với message mới lưu document identity/version và excerpt tối thiểu cùng citation; dữ liệu cũ dùng lookup được phép hoặc unavailable. Không để title của phiên bản mới giả thành nguồn của câu trả lời cũ.
- [ ] AI launcher giữ current conversation ID theo account, restore qua list/query hiện có; thêm “Mở hội thoại” vào màn hỗ trợ. Không lưu nội dung riêng tư vào localStorage.
- [ ] Retry câu hỏi giữ clientMessageId nếu cùng nội dung; sửa nội dung tạo intent mới; guard response theo conversation. Refresh/reopen không tự tạo hội thoại mới.
- [ ] Test private source của customer khác, document replaced/deleted, injection trong tài liệu, citation invalid và empty retrieval; AI không tự thực hiện payment/license actions.

**Gate:** người dùng đọc được nguồn hợp lệ và tiếp tục hội thoại sau reload; lời giới thiệu tương ứng khả năng thực.

### WP11 — Upload qua proxy có cùng giới hạn

**Phạm vi:** R26. **Sửa:** `EmuKey/frontend/Caddyfile`, `EmuKey/frontend/src/presentation/screens/AiKnowledgeScreen.tsx`, knowledge limits/env validation/DTO hiện có.

**Thiết kế:** application file cap 10 MiB = 10,485,760 bytes; proxy cap riêng route upload là 12 MiB để chứa multipart overhead; `/api` khác vẫn giữ cap phù hợp hiện hữu. API công bố file cap trong knowledge capabilities response hoặc cấu hình public sẵn có; UI đọc cùng giá trị, fallback mặc định phải khớp.

- [ ] Test qua Caddy với file 1.5 MiB, đúng 10 MiB, 10 MiB + 1 byte; oversized total request >12 MiB phải 413 sớm.
- [ ] Đặt route-specific body limit trước generic rule; test đúng path/method upload thật, không nâng toàn bộ API lên 12 MiB.
- [ ] Backend enforce size kể cả client bỏ qua UI; kiểm tra MIME/content PDF/TXT theo xử lý đang có; lỗi 413 trả thông điệp hiểu được trên UI.
- [ ] Test upload lỗi không để storage object/chunk rác, retry không tạo document duplicate ngoài semantics version hiện có.

**Test owner:** assistance integration và browser provider upload trong `tests/emukey/e2e/web/provider-dashboard.spec.ts`. **Gate:** bằng chứng request đi qua proxy, không chỉ gọi API trực tiếp.

### WP12 — Tách API/worker và quan sát công việc nền

**Phạm vi:** R28, nền R18/R22. **Sửa:** `EmuKey/backend/src/modules/operations/operations.module.ts`, `EmuKey/backend/src/{app.module.ts,worker.module.ts}`, notification processor/scheduler; compose worker health nếu cần.

**Tạo:** `EmuKey/backend/src/modules/operations/operations-worker.module.ts` làm owner đăng ký processor/scheduler; API module chỉ public service/controller/adapters cần thiết. Không dùng NODE_ENV làm công tắc vai trò process.

- [ ] Boot contract test API không tạo Worker/Scheduler; worker có đúng một registration mỗi queue trong process.
- [ ] Nối notification delivery, expiry reminder và support lease ở worker entrypoint đúng owner. Hai worker vẫn an toàn nhờ DB conditional claims/dedupe, không dựa trên “chỉ chạy một instance”.
- [ ] Health/readiness phản ánh DB/Redis và worker heartbeat; log correlation theo order/license/command/notification, không chứa token/key/message body.
- [ ] Dashboard vận hành hiện có hiển thị pending/retry/dead-letter cần hành động; bổ sung manual command recovery vào SystemBlockchainPanel nếu API có nhưng UI chưa nối, giữ quyền SYSTEM_ADMIN và proof hiện có.
- [x] Test stop worker rồi tạo intent; start worker xử lý lại; kill giữa delivery; Redis restart không mất durable intent. Local process-kill và Redis queue-loss/restart drill đạt; vendor fixture có dedupe, không suy ra Brevo/FCM exactly-once. Diễn tập restore môi trường triển khai và external acceptance vẫn để mở.

**Test owner:** `tests/emukey/backend/contract/platform/worker-platform.contract.test.ts`, notification integration và blockchain reconciliation unit. **Gate:** scaling API không tự sinh thêm scheduler; worker recovery có evidence.

### WP13 — Upgrade giữ dữ liệu, vẫn một schema authority

**Phạm vi:** R30; chạy harness trước mọi WP đổi schema. **Sửa:** `EmuKey/backend/database/schema.sql`, `EmuKey/backend/src/platform/database/{database-cli.ts,verify-baseline-database.ts}`, `src/entrypoints/database/{initialize.ts,verify.ts}`, backend package scripts.

**Tạo:** `EmuKey/backend/src/entrypoints/database/upgrade.ts`; `tests/emukey/backend/integration/database/schema-upgrade.integration.test.ts`. Upgrade SQL vẫn ở các section có version trong **schema.sql hiện hữu**; không tạo thư mục SQL mirror.

**Định dạng và hợp đồng:** giữ executable fresh schema/seed hiện có. Upgrade statements đặt trong block comment có marker duy nhất `/* emukey:upgrade:<from>:<to>:begin ... emukey:upgrade:end */` trong cùng file, trước outer COMMIT; raw fresh SQL không thực thi nội dung comment. Delta không chứa outer BEGIN/COMMIT, transaction do upgrade runner quản lý. Parser chỉ trích nội dung upgrade khi entrypoint upgrade yêu cầu exact from/to, kiểm tra cấm nested comment/marker mơ hồ. Bổ sung bảng `schema_versions` ghi version/checksum applied; `db:upgrade` chỉ chạy explicit ALTER/data transition đã review, không sinh diff tự động và không được gọi initializer.

- [ ] Ghi fingerprint baseline `cf17043`; test tạo DB cũ từ schema ở commit đó trong OS temp bằng Git, không commit bản sao schema fixture. CI phải checkout đủ commit baseline.
- [ ] Tách execution modes bằng parser kiểm tra marker duy nhất; raw fresh execution không chạy upgrade, seed vẫn theo opt-in hiện có. Test cả raw fresh SQL và official CLI/parser để bảo vệ hai cách dùng đang tồn tại. Seed-only không được trích destructive section; upgrade entrypoint không gọi `readDatabaseSql()` ở fresh mode.
- [ ] Initializer từ chối database có bảng/dữ liệu nếu thiếu flag explicit `--allow-destructive`; production luôn từ chối initializer. Không gọi reset để “chuẩn bị” upgrade.
- [ ] Upgrade preflight kiểm tra exact supported source version/fingerprint; transaction advisory lock, lock/statement timeout, rollback khi lỗi; rerun cùng version là no-op kiểm checksum, version lạ dừng.
- [ ] Mỗi WP schema thêm delta và data backfill: key delivery receipt, device metadata, support lease, review/citation evidence nếu cần. Notification đã có event_key/dedupe: reuse trước khi thêm cột. Không tự reset seed hoặc đổi business IDs/payment evidence.
- [x] Test fresh schema và upgraded schema tương đương về columns/constraints/indexes; row counts, primary keys, order snapshots, money, key commitments và command history giữ nguyên. Snapshot tất cả cột cũ trên baseline có demo order/payment/license/command; so sánh count/hash sau rollback, upgrade và restore clone.
- [x] Fault injection giữa upgrade phải rollback; backup/restore drill trên clone disposable. Rollback production là restore backup hoặc forward fix đã kiểm chứng, không mặc định down-migration xóa dữ liệu. Evidence 02/11 dùng physical backup PostgreSQL 15 và snapshot dữ liệu baseline; logical restore không đạt fingerprint và vẫn bị từ chối.

**Gate:** clone có paid orders/licenses/devices/messages upgrade được và app đọc được; không mất dữ liệu. Áp dụng lên database thật là bước vận hành riêng sau khi có quyền phù hợp.

### WP14 — Setup có thể tái lập với PostgreSQL external

**Phạm vi:** R29. **Tạo:** `EmuKey/README.md` vì chưa có README sản phẩm; đây là owner hướng dẫn build/runtime/deploy độc lập, không sao chép toàn bộ HDSD. **Sửa:** `EmuKey/.env.example`, `EmuKey/backend/.env.example`, `EmuKey/docker-compose.yml` nếu thiếu health/dependency docs; env validation và readiness owner hiện có. Dùng `tooling/emukey/verification/` cho clean-room automation, không đưa workspace runner vào runtime.

- [ ] Viết quy trình từ checkout sạch: đúng Node/pnpm → install từng delivery unit frozen lockfile → provision PostgreSQL 15+ disposable bên ngoài Compose app → env template → build backend → initialize chỉ DB mới → db:verify → Compose API/worker/web → smoke.
- [ ] Liệt kê extensions thực `pgcrypto`, `citext`, quyền DB, host reachable từ container, TLS và port; không còn yêu cầu pgvector khi source không dùng.
- [ ] Preflight phân biệt thiếu DATABASE_URL, DNS/network, auth DB, sai schema, Redis, RPC; không che tất cả bằng một lỗi “không kết nối”.
- [ ] Clean-room dùng Testcontainers hoặc PostgreSQL riêng có lifecycle do test quản lý; không bắt người nhận dự án dùng tài khoản Neon của tác giả.
- [ ] Validate Compose config không in secrets ra evidence; xác nhận app runtime/build hoạt động với riêng thư mục EmuKey.

**Gate:** người thực thi khác làm theo README dựng được môi trường dùng DB disposable, không cần biết thiết lập máy tác giả. External credentials chỉ cần ở gate tích hợp thật.

### WP15 — Client demo riêng chứng minh quyền sử dụng

**Phạm vi:** R12; **mở rộng scope đề xuất**, cần cập nhật phần exclusion trong docs khi triển khai. **Phụ thuộc:** WP06–WP08, WP13–WP14.

**Tạo:** `EmuKey/license-client-demo/` là một ứng dụng Kotlin/Jetpack Compose tối thiểu theo AGENTS, có Gradle wrapper/config, manifest và package thực tế `vn.emukey.licensedemo`. Không nhập luồng kích hoạt bearer key vào manager app. Golden vectors ở `tests/emukey/license-client-demo/`; ca Android opt-in mở rộng owner integration license hiện hữu trong `tests/emukey/backend/integration/blockchain/`.

**Cấu trúc đã triển khai:** `LicenseApi.kt` gọi protocol và giữ entitlement token trong stack frame; `DeviceIdentity.kt` giữ signer/binding được mã hóa; `DeviceProof.kt` chứa EIP-191 và policy `DemoAccess`; `MainActivity.kt` hiển thị key input, license state và tính năng “Xuất báo cáo demo”. Không tạo thêm token repository khi không có token cache lâu dài.

- [x] Xác minh installed Android toolchain, chọn version Kotlin/Compose và thư viện secp256k1 từ nguồn chính thức theo search-first/source-driven-development trước scaffolding; lưu quyết định dependency/license trong `EmuKey/README.md`.
- [x] Implement challenge → ký EIP-191 bằng identity riêng của installation → activation → entitlement issue/refresh/verify. Golden vectors đối chiếu viem; không giả rằng Android Keystore hỗ trợ secp256k1 signing trực tiếp.
- [x] Nếu signer software cần lưu, mã hóa bằng key AES-GCM trong Android Keystore; không lưu private key/key license vào log/clipboard tự động. Xóa input key khỏi UI sau activation phù hợp.
- [ ] Tính năng export gọi entitlement verify online trước mỗi lần chạy; chưa kích hoạt, revoked/suspended/expired hoặc offline thì khóa tính năng và nêu nguyên nhân. Token cache không được vượt expiry; không hứa offline entitlement nếu chưa thiết kế.
- [ ] Khi refresh/re-activate quota full, hiện danh sách hướng dẫn quản lý trên manager/web; không tự revoke thiết bị khác. Renewal cùng key/device hoạt động trở lại sau confirmed nếu license effective ACTIVE.
- [ ] E2E: mua/nhận key trên web hoặc mobile → nhập demo → feature chạy → remote revoke/suspend/expiry → feature bị khóa → renewal/resume đúng policy. Kiểm tra app restart giữ cùng device identity/generation đúng protocol.

**Gate:** ứng dụng thực thi tính năng mẫu dựa trên entitlement API, có APK/emulator evidence và vectors. Đây là demo tích hợp, không phải cơ chế chống sửa binary/DRM tuyệt đối.

### WP16 — Đồng bộ tài liệu và trạng thái thực hiện

**Phạm vi:** R31. **Sửa:** bốn file trong `context/current/`, `EmuKey/README.md`, `docs/emukey/traceability/phase-8-traceability.md`, `tooling/emukey/verification/validate-baseline.mjs`, `tests/emukey/backend/unit/platform/baseline-validator.test.ts`.

- [ ] Ghi facts xuất phát: 19 bảng/34 capability là baseline review, không phải số cố định sau schema mở rộng. Đếm lại từ schema và feature catalog sau các WP; phân biệt capability với API/surface/demo.
- [ ] Chuẩn hóa state names, renewal eligibility, device authority, session, delivery ACK, notification targets và AI scope theo code/DTO thực đã kiểm thử.
- [ ] Tách mục lịch sử có ngày và version khỏi phần hướng dẫn chạy hiện tại; không sửa evidence cũ thành pass mới.
- [ ] Ghi rõ PostgreSQL external, upgrade vs initialize, scope demo mới, quy trình hỗ trợ và recovery; mọi lời khẳng định UI điều hướng phải có test tương ứng.
- [ ] Validator phát hiện drift state/schema count/capability, link owner không tồn tại và active docs mâu thuẫn; không grep lịch sử rồi báo false positive.

**Gate:** đọc current docs không phải suy đoán baseline; HDSD đi qua được bằng UI hiện tại.

### WP17 — Nghiệm thu hợp đồng và end-to-end cùng revision

**Phạm vi:** R32–R33 và đóng toàn bộ R01–R33. **Sửa:** suites hiện hữu; `tests/emukey/e2e/web/canonical-license-golden-flow.spec.ts`, `tests/emukey/e2e/mobile/phase6-license-flow.yaml`, `.github/workflows/emukey-tests.yml`, `.github/workflows/emukey-external.yml`, `docs/emukey/traceability/canonical-e2e-golden-flow.json` qua evidence tooling hiện hữu.

- [ ] Chạy deterministic CI: unit → HTTP contract/security → PG/Redis integration → web/browser + native component → lint/typecheck/build/OpenAPI consistency. CI fail nếu suite bắt buộc skip ngoài danh sách môi trường được công bố.
- [ ] Contract consumer tests sử dụng JSON do backend DTO/HTTP thực sinh ra. Không dùng fixture viết tay làm bằng chứng duy nhất. Generated types check chỉ chứng minh hình dạng, không thay runtime validation test.
- [ ] Web E2E đi qua browser thật và Caddy; Android E2E dùng installed build trên emulator/device, không tính `expo export` là chạy app.
- [ ] External gate riêng với credentials/tài nguyên được phép: SePay sandbox UI và IPN thật, Sepolia receipt/finality, Brevo email link, storage upload, AI và FCM delivery/tap. Không gửi tới người nhận ngoài danh sách test đã được phép.
- [ ] Run cùng commit/schema/config fingerprint: purchase → terms → signed checkout → real IPN → issue finalized → notification → key delivery → demo activate/feature → device revoke → renewal → support escalation/lease/close. Có run mua/gia hạn từ Android, không chỉ xem kết quả tạo bởi web.
- [ ] Negative journeys: duplicate IPN, interrupted checkout, expired access, lost key response, stale email token, quota full, command pending/unknown, worker crash, wrong owner, support agent disconnect. Chain reorg fault injection ở integration được ghi là simulated, không giả tạo real Sepolia evidence.
- [ ] Evidence tối thiểu: revision, schema version/hash, run ID, timestamps, environment class, order/payment attempt/transaction/license/command/tx hash đã redaction, assertions và failure phase. Không lưu secret, key, raw token hay customer PII trong artifact.
- [ ] Nếu Cloudflare/provider/Android/credentials chặn, ghi EXTERNAL_BLOCKED cùng nguyên nhân và bước chạy lại. Không đặt release complete khi R33 chưa có evidence bắt buộc; các WP nội bộ đã đạt vẫn được ghi rõ hoàn thành riêng.

**Gate:** mọi Rxx có link test/evidence của revision cuối và hạn chế còn lại được khai báo; không có P0/P1 còn mở ở catalog/payment/auth/key/ownership.

## 6. Lệnh kiểm tra và cách chạy an toàn

Các lệnh dưới đây là lệnh **đã thấy trong repository**, dùng ở giai đoạn thực thi; kế hoạch này chưa chạy lại toàn bộ test. Working directory mặc định là `D:\TLHT\KLTN\UY`. Đọc entrypoint/config để biết env cần thiết trước khi chạy; không để script mặc định trỏ vào database thật.

```powershell
# Baseline và source hygiene
git status --short
node tooling/emukey/run.mjs baseline
git diff --check

# Focused frontend/mobile ví dụ; dùng testNamePattern hoặc file filter của runner
node tooling/emukey/run.mjs frontend:unit buyer-commerce.test.tsx
node tooling/emukey/run.mjs mobile:unit --runTestsByPath ../../tests/emukey/mobile/unit/api-client.test.ts

# Các suite toàn cục sau focused tests
node tooling/emukey/run.mjs backend:unit
node tooling/emukey/run.mjs backend:contract
node tooling/emukey/run.mjs backend:security
node tooling/emukey/run.mjs backend:integration
node tooling/emukey/run.mjs frontend:unit
node tooling/emukey/run.mjs mobile:unit
node tooling/emukey/run.mjs contracts

# Typecheck/lint/build theo delivery unit
corepack pnpm --dir EmuKey/backend typecheck
corepack pnpm --dir EmuKey/backend lint
corepack pnpm --dir EmuKey/backend build
corepack pnpm --dir EmuKey/frontend typecheck
corepack pnpm --dir EmuKey/frontend lint
corepack pnpm --dir EmuKey/frontend build
corepack pnpm --dir EmuKey/mobile typecheck
corepack pnpm --dir EmuKey/mobile lint
corepack pnpm --dir EmuKey/mobile build

# Khi DTO/API đổi: generate bằng owner hiện hữu, rồi check cả ba bên
corepack pnpm --dir EmuKey/backend openapi:generate
Copy-Item -LiteralPath EmuKey/backend/openapi/openapi.json -Destination EmuKey/frontend/openapi/openapi.json
Copy-Item -LiteralPath EmuKey/backend/openapi/openapi.json -Destination EmuKey/mobile/openapi/openapi.json
corepack pnpm --dir EmuKey/frontend openapi:generate
corepack pnpm --dir EmuKey/mobile openapi:generate
corepack pnpm --dir EmuKey/backend openapi:check
corepack pnpm --dir EmuKey/frontend openapi:check
corepack pnpm --dir EmuKey/mobile openapi:check

# Browser discovery trước; chạy thật sau khi cô lập environment/fake vs external
node tooling/emukey/run.mjs frontend:e2e --list
node tooling/emukey/run.mjs frontend:e2e
node tooling/emukey/run.mjs mobile:check-maestro
```

`contracts` là Solidity tests; không đồng nhất với `backend:contract` là HTTP/platform contract tests. Backend focused integration có thể dùng `-t` theo test name vì runner đã thêm filter `integration`. Không giả định thêm file filter là chỉ chạy một file nếu Vitest kết hợp filter theo OR.

`db:upgrade`, demo Gradle build và các route/DTO đề xuất chỉ trở thành runnable sau WP tạo chúng. Thực thi từng WP phải thêm lệnh cụ thể đã chạy vào evidence, không đánh dấu PASS từ việc lệnh được liệt kê ở đây.

## 7. Kiểm thử nghiệm thu đại diện có expected result cụ thể

| Case | Input/điều kiện | Expected result |
|---|---|---|
| CAT-01 | Provider A/B cùng code, mỗi product hai plan | Detail A chỉ hai plan A; legacy slug 409; checkout snapshot A |
| PAY-01 | AMOUNT_MISMATCH + ACCEPT_AND_FULFILL | 4xx domain error, không đổi order/attempt/license |
| PAY-02 | Hai resolve fulfillment cùng payment hợp lệ | Một effect/command; request còn lại trả cùng outcome hoặc conflict có nghĩa |
| PAY-03 | Review CLOSED_NO_ACTION | Buyer không hiển thị OPEN; không tự mở retry nếu evidence vẫn uncertain |
| AUTH-01 | 10 request hết access token đồng thời | Một refresh, không logout giả, mutation không lặp effect |
| AUTH-02 | Refresh network timeout | Giữ session, state lỗi có retry, không lặp vô hạn |
| NTF-01 | GET notifications?limit=20 | 200; page <=20; unreadCount tổng đúng |
| NTF-02 | 45 unread, mark-read 1 hai lần | Badge 45→44→44 ở cả hai client |
| KEY-01 | Claim delivery D, drop response, retry D trong 5 phút | Cùng key/version, không tạo command mới |
| KEY-02 | Claim D, account khác hoặc delivery E | Không lộ key; không thay owner/claim |
| KEY-03 | Ack thành công nhưng response mất | Retry ACK thành công idempotent; retrieve không mở lại lượt |
| LIC-01 | SUSPENDED rồi gia hạn paid/confirmed | Expiry tăng, trạng thái vẫn suspended, không tự resume |
| SUP-01 | Staff A mất kết nối sau heartbeat | Requeue sau lease; B nhận được; A gửi bằng version cũ bị từ chối |
| SUP-02 | Mobile đang chat, staff close | Mobile cập nhật CLOSED, không cho gửi/hỏi AI |
| AI-01 | Customer chưa có license | Không đọc private docs, không hứa đề xuất gói từ nguồn không có |
| UP-01 | Multipart file đúng 10 MiB qua Caddy | Đến backend; không bị cap 1 MB chặn |
| DB-01 | Upgrade fixture có paid order/device/message | IDs/value/snapshot giữ nguyên, schema target đúng |
| DEMO-01 | Entitlement valid rồi remote revoke | Export chạy trước revoke; lần kiểm tra online kế tiếp bị khóa |

Ví dụ assertion bắt buộc cho HTTP notification (đưa vào test có Nest app đã bootstrap như production và actor fixture; không mock ValidationPipe):

```ts
const response = await request(app.getHttpServer())
  .get('/api/v1/notifications?limit=20')
  .set('Authorization', `Bearer ${customerAccessToken}`)
  .expect(200);
expect(response.body.items).toHaveLength(20);
expect(response.body.unreadCount).toBe(45);
expect(response.body.items[0]).toHaveProperty('createdAt');
expect(response.body.items[0]).not.toHaveProperty('occurredAt');
```

Ví dụ assertion catalog tại service boundary sau khi fixture PG tạo A/B theo CAT-01 (HTTP request helper và IDs lấy từ fixture hiện có):

```ts
const detail = await request(app.getHttpServer())
  .get(`/api/v1/products/by-id/${productA.id}`).expect(200);
expect(detail.body.id).toBe(productA.id);
expect(detail.body.providerId).toBe(providerA.id);
expect(detail.body.plans.map((plan: { id: string }) => plan.id).sort())
  .toEqual([planA1.id, planA2.id].sort());
```

## 8. Tổ chức bàn giao, rollout và hoàn thành

- Mỗi WP là một nhóm thay đổi review được. Các thay đổi schema/auth/key/payment cần review kỹ transaction, authorization, replay và failure state trước rollout. Không dùng một PR khổng lồ cho tất cả WP.
- Backend additive DTO/route triển khai trước clients; cập nhật web và native theo compatibility window. Với payment review cũ mơ hồ, fail closed có thông báo nâng client thay vì suy diễn outcome.
- Key delivery mới và mobile refresh phải ghi version protocol. Client mobile cũ cần được báo nâng cấp nếu không thể tiếp tục an toàn; không âm thầm chuyển sang semantics khác.
- Feature/schema migration dùng expand/backfill/contract khi có dữ liệu thật. Schema cũ có khả năng đọc các field mới nullable trong giai đoạn rollout; constraint NOT NULL chỉ sau khi backfill và clients tương thích.
- Metrics nghiệm thu: payment review rejected theo code, fulfillment pending age, key delivery retry/recovery rate, notification backlog/failure, support lease requeue và auth refresh failures. Dùng observability owner đang có, không mở dự án monitoring mới.
- Thay đổi deploy/external payment/database thật là hành động riêng cần đúng quyền khi thực thi. Tạo tài liệu kế hoạch không đồng nghĩa các hành động này đã được cho phép.

Mỗi dòng nghiệm thu khi thực hiện phải ghi: `Rxx | WP | revision | test/evidence path | PASS/FAIL/BLOCKED | limitation`. Evidence tạm như screenshot/trace/log giữ ở OS temp hoặc artifact CI; chỉ lưu báo cáo đã redaction vào traceability owner hiện hữu.

**Hoàn thành toàn bộ kế hoạch khi:**

- [ ] R01–R33 được map tới implementation hoặc quyết định phạm vi cụ thể đã thực hiện, không đóng bằng ghi chú “để sau”.
- [ ] Các gate của WP00–WP17 đạt; R12 có demo riêng nếu giữ mục tiêu end-to-end sử dụng thực theo kế hoạch này.
- [ ] Không còn mismatch contract giữa database/API/web/mobile; negative/security/concurrency tests trọng yếu đạt.
- [ ] Upgrade có bằng chứng giữ dữ liệu; setup clean-room thành công.
- [ ] External E2E cùng revision đạt; nếu còn external blocker thì báo phần đã đạt và để trạng thái toàn bộ chưa hoàn tất.
- [ ] Tài liệu current, generated types, schema facts và hướng dẫn sử dụng khớp implementation.
- [ ] `git diff --check`, status/hygiene và final diff review đạt; không có secrets, dump, artifacts tạm hoặc thay đổi ngoài scope.

**Thứ tự bắt đầu cụ thể:** WP00 → WP01 và harness WP13 → WP02 → WP03 → WP04 → WP05a → WP06 → WP07 → WP08 → WP09 → WP10 → WP11 → WP12/WP05b → WP14 → WP15 → WP16/WP17. Mỗi lần gặp phát hiện mới có ảnh hưởng phạm vi, cập nhật design và test của WP liên quan trước khi tiếp tục.
