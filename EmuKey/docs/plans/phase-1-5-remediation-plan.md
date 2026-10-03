# Phase 1–5 audit and remediation plan

> Ngày audit: 08/09/2026
> Baseline: FUNC v4.1 → SQL v6.1 → TECH v4.1 → PLAN v4.1
> Trạng thái: remediation Phase 1–5 đã hoàn tất ở profile local/test; production còn các blocker bên ngoài ở mục 6
> Phạm vi thực thi kế tiếp: Phase 1 đến Phase 5; không mở rộng sang Phase 6–8

## 1. Mục tiêu và ràng buộc

Kế hoạch này là nguồn bàn giao để lượt tiếp theo sửa các vấn đề đã xác nhận bằng source, schema và lệnh kiểm tra thực tế. Mỗi work package phải được thực hiện theo thứ tự phụ thuộc, bắt đầu bằng test tái hiện lỗi và chỉ được đánh dấu hoàn tất khi gate tương ứng đạt.

Ràng buộc bắt buộc:

- Không dùng TypeORM hoặc ORM khác; PostgreSQL được truy cập bằng `pg` và SQL tường minh có version control.
- Docker/Compose không khởi chạy PostgreSQL riêng. API, Worker và maintenance command dùng cùng `DATABASE_URL` bên ngoài.
- Không chạy seed, schema change, fixture phá lỗi hoặc test ghi dữ liệu trên Neon. Mọi mutation test dùng PostgreSQL/Redis/Hardhat cô lập bằng Testcontainers hoặc process test tạm thời.
- `backend/database/schema.sql` và `../sql_minimal.sql` phải luôn byte-identical sau mỗi thay đổi schema.
- Không khôi phục Contract PDF/signing, Kotlin test client, provider member model hoặc feature ngoài 36 capability.
- Không coi UI mock, interface/port rỗng, bảng SQL hoặc test build là bằng chứng capability đã chạy qua boundary thật.
- Không sửa/xóa các thay đổi Git có sẵn ngoài work package đang thực thi.
- Không ghi secret thật vào source, log, fixture, image hoặc tài liệu.
- Các adapter chưa có contract production được phép dùng fake/local có nhãn rõ ràng; không được claim production-ready.

## 2. Kết quả audit trước remediation

> Bảng dưới đây là ảnh chụp lỗi ban đầu để giữ lịch sử điều tra, không còn là trạng thái source hiện tại.

| Phase   | Kết luận                                   | Phần đã có                                                                                                                                                     | Blocker chính                                                                                                                                                     |
| ------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 | `PARTIAL`, gate chưa đạt                   | Bốn artefact đúng header/version; FUNC có đúng 36 capability; schema source/backend cùng hash; legacy business Contract/test client chỉ còn historical mention | Không có traceability/test-owner matrix, validator active-vs-historical, shared crypto vectors; TECH còn lệch external-DB/no-ORM runtime                          |
| Phase 2 | `PARTIAL`, gate `FAIL`                     | SQL clean-room và seed hai lần pass; Neon hiện có 18 bảng/41 FK/79 index/167 constraint; config/readiness/log redaction/OpenAPI scaffold có nền tảng           | Nhiều composite integrity rule chưa được schema enforce; verifier chỉ kiểm số lượng; thiếu/unwired ports; pool lifecycle phân tán; audit/security gate thiếu test |
| Phase 3 | `FAIL`, 0/10 capability đủ bằng chứng PASS | Auth/session và Product/Plan CRUD có scaffold; public catalog đọc API                                                                                          | Product/Plan create không tương thích schema; provider isolation vỡ; response có thể lộ `passwordHash`; Terms/commitment/Controller/EIP-712/ComparePlans chưa có  |
| Phase 4 | `NOT READY`, 0/6 capability PASS           | Có bảng commerce/payment, payment port/fake và một số Web query/UI                                                                                             | Không có Commerce module/API/use case/IPN; Terms acceptance sai flow; composite payment/renewal integrity thiếu; UI payment phần lớn mock                         |
| Phase 5 | `NOT IMPLEMENTED`, 0/8 capability PASS     | Có bảng command/event/license và một relayer port tối thiểu                                                                                                    | Solidity/ABI/vector, Worker processor, envelope, relayer, indexer, finality/reorg, reconcile, LIC-03 và BC-05 runtime đều chưa có                                 |

### 2.1. Kiểm tra đã chạy

- Baseline: tìm thấy đúng 36 capability unique trong FUNC v4.1.
- Schema: `backend/database/schema.sql` và `../sql_minimal.sql` có cùng SHA-256.
- Neon, chỉ đọc: `db:verify` pass với 18 bảng, 41 foreign key, 79 index, 167 constraint và đủ `citext`, `pgcrypto`, `vector`.
- Backend: frozen install, lint, typecheck, 10 test file/25 test, OpenAPI check và build pass.
- Frontend: frozen install, lint, typecheck, 8 test file/26 test, OpenAPI check và build pass; Vite cảnh báo bundle khoảng 1.3 MB nhưng đây không phải blocker Phase 1–5.
- Mobile: Expo dependency check, lint, typecheck, 1 test, OpenAPI check và Android export pass.
- Docker: ba image backend/frontend/mobile build pass độc lập.
- Compose: root và backend config validation pass; không có PostgreSQL service.
- Playwright: command list test trả về `No tests found`; E2E thuộc Phase 8 và không được dùng để claim các gate hiện tại.

Các test xanh hiện tại chủ yếu kiểm scaffold, validation unit hoặc UI mock. Không test nào gắn capability ID và chưa có E2E nghiệp vụ Phase 3–5.

### 2.2. Evidence map để lượt sau bắt đầu nhanh

- Phase definitions/gates: `../APP_IMPLEMENTATION_PLAN.md:144-210`.
- Canonical integrity rules: `../cong_nghe_he_thong.md:170-177`.
- Canonical crypto encoding: `../cong_nghe_he_thong.md:190-210`, `357-370`.
- SQL Order/Payment: `backend/database/schema.sql:169-297`.
- SQL License/Command/Event và pointer FK: `backend/database/schema.sql:299-534`.
- Count-based verifier: `backend/src/platform/database/verify-baseline-database.ts:50-115`.
- Clean-room/count/seed-only integration test: `backend/test/integration/database/baseline-schema.integration.test.ts:30-68`.
- Runtime module coverage chỉ có Identity/Catalog: `backend/src/app.module.ts:9-14`.
- Worker chưa có processor: `backend/src/worker.module.ts:1-8`.
- Product insert thiếu Provider: `backend/src/modules/catalog/infrastructure/catalog-admin.repository.ts:117-125`.
- Plan insert thiếu Provider/version/Terms/commitment: `backend/src/modules/catalog/infrastructure/catalog-admin.repository.ts:231-243`.
- Catalog query/mutation không scope Provider và Published Plan vẫn update: `backend/src/modules/catalog/infrastructure/catalog-admin.repository.ts:102-112`, `134-151`, `215-228`, `252-275`.
- Identity raw-return/error/session paths: `backend/src/modules/identity-access/identity.service.ts:54-141`.
- Auth DTO/cookie/logout paths: `backend/src/modules/identity-access/identity.controller.ts:12-43`.
- Register form gửi `passwordConfirmation`: `frontend/src/presentation/components/AuthForms.tsx:19-24`, `99-160`.
- Commerce frontend gọi API chưa tồn tại: `frontend/src/application/orders/orderQueries.ts:36-68`.
- Terms acceptance đang gộp client-side: `frontend/src/presentation/screens/BuyerCheckoutScreen.tsx:18-30`, `85-104`.
- Payment, License và Public Verify mock: `frontend/src/presentation/screens/PaymentStatusScreen.tsx`, `BuyerLicenseHubScreen.tsx:4-17`, `PublicVerificationScreen.tsx:4-14`.
- Solidity package rỗng: `backend/contracts/package.json` và `.gitkeep` dưới `contracts/solidity`, `contracts/test`.
- OpenAPI hiện kết thúc ở Identity/Catalog routes: `backend/docs/openapi/openapi.json`.

## 3. Issue register đã xác nhận

### Phase 1

#### P1-01 — Không có traceability 36 capability (`P0`)

Không có capability ID trong source/test của `EmuKey`. Vì vậy chưa thể truy từ capability sang actor, API/use case, owner table/state, transaction, test và surface.

#### P1-02 — Thiếu baseline validator (`P0`)

Chưa có validator phân biệt active reference với historical/out-of-scope mention, kiểm đúng 36 capability, inventory SQL, owner duy nhất và test owner.

#### P1-03 — Crypto protocol mới chỉ có prose (`P0`)

TECH đã mô tả Terms normalization, JCS, ABI plan commitment, activation commitment và EIP-712 nhưng repo không có implementation hoặc shared TypeScript/Solidity vectors.

#### P1-04 — Tài liệu runtime chưa đồng nhất với quyết định hiện tại (`P1`)

TECH vẫn mô tả PostgreSQL service trong Compose và dùng từ ngữ DB migrations, trong khi runtime/runbook hiện dùng external `DATABASE_URL`, SQL clean-room và không ORM. Cần sửa authority artefact để không tái tạo local database hoặc TypeORM trong lượt sau.

### Phase 2

#### P2-01 — Composite integrity thiếu hoặc sai (`P0`)

Các lỗi schema cụ thể:

1. `payment_transactions.order_id` và `payment_attempt_id` là hai FK độc lập; transaction có thể trỏ attempt của order khác.
2. Renewal target chỉ bind `(target_license_id, provider_user_id)`; license của Customer khác trong cùng Provider vẫn có thể được dùng.
3. Order/License bind Product và Plan bằng FK rời; có thể trộn Product và Plan khác nhau của cùng Provider.
4. `last_applied_chain_event_id` của License/Device chỉ trỏ event ID, không bind event subject.
5. ChainCommand có thể trỏ Order khác Provider; ISSUE/RENEW subject có thể không khớp License/Order.
6. ChainEvent có thể trỏ command khác subject vì command/event FK đang độc lập.

#### P2-02 — Database verifier có thể false-positive (`P0`)

Verifier so tên bảng/extension nhưng chỉ so tổng 41 FK, 79 index và 167 constraint. Một constraint sai có thể được thay bằng constraint khác mà verifier vẫn báo `matchesBaseline: true`.

#### P2-03 — Negative integrity fixtures chưa tồn tại (`P0`)

Integration test hiện chỉ apply schema, đếm object và seed hai lần. Chưa có deliberate fixture buộc cross-order, cross-customer, cross-product hoặc cross-chain-subject trả SQLSTATE `23503`.

#### P2-04 — Database pool ownership/lifecycle phân tán (`P1`)

Health, Identity và Catalog tự tạo Pool riêng. Identity chỉ đóng Redis, Catalog không đóng Pool. Cách này gây connection multiplication và không cung cấp transaction owner chung cho use case Phase 4–5.

#### P2-05 — Ports/fakes foundation chưa đủ hoặc chưa được wire (`P1`)

Có port/fake cho Payment, AI, Email, Push và một interface Relayer tối thiểu, nhưng chúng chưa được module wire. Ghi nhận lịch sử này đã được baseline v5.0 thay thế: không còn ControllerKMS; EVM reader/indexer và activation-envelope có owner riêng.

#### P2-06 — Audit và log-redaction gate chưa đủ (`P0`)

Audit mới xuất hiện trong admin user state và Catalog mutation. Register/login failure/token/session/security event chưa có. Redaction chưa có test cho `currentPassword`, confirmation, activation key/secret, envelope, SePay signature/raw payload và controller/relayer material.

#### P2-07 — Config contract chưa đủ cho Phase 3–5 (`P1`)

Environment validation ban đầu thiếu key canonical cho activation envelope, SePay, storage và chain RPC/contract/finality. Baseline v5.0 dùng `EVM_RELAYER_PRIVATE_KEY` được inject từ deployment secret; không còn KMS/controller variables.

#### P2-08 — Generated clients tồn tại nhưng application không sử dụng (`P1`)

Frontend/mobile giữ OpenAPI snapshot và generated types đồng nhất, nhưng các API wrapper vẫn khai báo interface bằng tay. Contract drift vẫn có thể lọt qua compile.

### Phase 3

#### P3-01 — Product/Plan create chắc chắn lỗi với SQL v6.1 (`P0`)

- Product insert bỏ `provider_user_id` dù cột `NOT NULL`.
- Plan insert bỏ `provider_user_id`, `version`, `terms_version`, `terms_hash`, `plan_commitment` dù đều bắt buộc.

Các unit test mock repository nên không phát hiện SQLSTATE `23502`.

#### P3-02 — Provider isolation bị phá (`P0`, security)

Admin list/find/update/delete/publish Product/Plan không filter `provider_user_id = actor.sub`. Actor hiện chủ yếu chỉ được dùng để ghi audit, nên Provider A có thể đọc hoặc sửa tài nguyên Provider B nếu biết ID.

#### P3-03 — Response Identity có thể lộ password hash (`P0`, security)

`updateProfile` và `changeAccountState` trả thẳng `IdentityUser` từ repository trong khi `IdentityUser` chứa `passwordHash`. Hai đường response này không đi qua allowlist `publicUser`.

#### P3-04 — Auth DTO và frontend contract không khớp (`P0`)

Register UI gửi `passwordConfirmation`, nhưng backend bật `forbidNonWhitelisted` và Register DTO không khai báo field này, khiến submit thật trả 400. Một số endpoint dùng `Pick`/intersection TypeScript thay cho DTO runtime, nên validation/Swagger metadata không đáng tin cậy. Resend verification còn bắt password không cần thiết.

#### P3-05 — Auth/session lifecycle chưa đạt AUTH-01..04 (`P0`)

- Verify/reset token được tạo nhưng không gửi qua Email adapter.
- Logout chỉ clear cookie, không consume/revoke refresh token family.
- Refresh reuse không còn đủ subject/family context để revoke toàn family.
- Failed login counter/lockout trong schema không được dùng.
- Domain error từ register/verify/reset/change state thường bị global filter map thành 500.
- Profile DTO optional field thiếu decorator và code ghi `null` cho field bị bỏ, có thể làm Provider profile update vi phạm constraint.
- Auth/security mutation chưa có audit/rate-limit coverage đầy đủ.

#### P3-06 — Customer identity giữ lại; Customer Controller bị loại

Baseline v5.1 giữ Customer registration/email verification/profile/JWT và account ownership. Chỉ Customer Controller, per-account key, EIP-712 buyer signature và KMS bị loại; contract chỉ chấp nhận relayer. Activation key là bearer capability, không chứng minh người cầm key là người mua ban đầu.

#### P3-07 — Published Product/Plan rule không đúng (`P0`)

Catalog update chỉ chặn `ARCHIVED`; Published Plan vẫn sửa price, rights, duration và entitlements tại chỗ. Không có version-row creation hoặc Terms binding. Provider scoping cũng thiếu ở query kiểm tra Product khi tạo Plan.

#### P3-08 — Terms và commitment chưa triển khai (`P0`)

Không có versioned Terms artefact/loader, normalization, JCS, `terms_hash`, deterministic ABI `plan_commitment`, activation commitment hoặc TypeScript vectors.

#### P3-09 — CAT-05 ComparePlansQuery chưa có (`P1`)

Public catalog có list/detail nhưng không có owner query so sánh Plan. Nút “So sánh gói” không có handler; AI chưa có owner để reuse.

### Phase 4

#### P4-01 — Commerce runtime chưa có (`P0`)

`AppModule` chỉ import Platform, Identity và Catalog. Frontend gọi `/orders`, nhưng backend không có Commerce module/controller/use case/repository nên route trả 404.

#### P4-02 — Terms acceptance bị gộp sai flow (`P0`)

UI bắt check Terms trước khi create order, còn canonical flow yêu cầu CreateOrder tạo `WAITING_TERMS_ACCEPTANCE`, sau đó AcceptTerms xác minh exact version/hash và ownership rồi chuyển `WAITING_PAYMENT`.

#### P4-03 — Checkout/PaymentAttempt chỉ là scaffold (`P0`)

Payment port/fake chưa được wire; không có state/owner check, expiry, supersede/idempotency policy, external-call boundary hoặc concurrent checkout test.

#### P4-04 — SePay IPN chưa triển khai (`P0`)

Không có versioned webhook DTO, adapter contract verification, classifier, durable ingest transaction hoặc duplicate/out-of-order/concurrent tests. Exact production SePay IPN contract vẫn là open gate, vì vậy không được tự suy đoán signature/fields.

#### P4-05 — Payment review/history/receipt là schema/UI mock (`P1`)

Không có API/RBAC/audit/receipt derivation. Provider Operations và Payment Status đang đọc mock.

#### P4-06 — Renewal chưa an toàn (`P0`)

Chỉ có shape/FK một phần trong schema; không có use case/API. DB chưa chặn target License khác Customer và chưa có test chứng minh payment không đổi `licenses.expires_at` trước chain finality.

### Phase 5

#### P5-01 — Solidity Registry chưa tồn tại (`P0`)

Contracts package chỉ có dependencies và `.gitkeep`; không có `.sol`, Hardhat config, ABI export, deploy fixture hoặc contract test.

#### P5-02 — License issuance chưa có transaction owner (`P0`)

Không có application flow biến NEW_PURCHASE payment success thành License `PENDING_ONCHAIN` + ISSUE command đúng một lần. Không có authenticated LIC-03 projection API.

#### P5-03 — Activation secret/envelope chưa có (`P0`, security)

Chưa có CSPRNG secret, activation commitment, encrypted one-time Redis envelope, prepare/verify hard gate, safe regeneration khi command còn PENDING hoặc one-time release sau finality. Web đang hiển thị demo key từ bundle.

#### P5-04 — Relayer/command state machine chưa có (`P0`)

Relayer port chỉ có input/output tối thiểu và không được wire. Worker không có processor, lease/claim, nonce, `SUBMITTED_UNKNOWN`, retry/dead-letter hoặc receipt reconciliation.

#### P5-05 — Indexer/finality/reorg chưa có (`P0`)

Chỉ có bảng `chain_events`; không có event ingest, confirmation policy, canonical block check, reorg demotion/rebuild hoặc projection transaction.

#### P5-06 — BC-04 Reconcile chưa có owner (`P0`)

Provider/System UI chỉ hiển thị mock job. Không có engine duy nhất cho event replay, stale/mismatch detection và audited manual trigger.

#### P5-07 — BC-05 Public Verification đang chạy hoàn toàn ở client (`P0`, security)

Màn hình tra một record đóng gói trong frontend. Không có backend allowlist, rate limit, anti-enumeration, chain/finality evidence hoặc trạng thái `PROJECTION_STALE`/`REORGED`.

#### P5-08 — Phase 5 gate không có test (`P0`)

Không có test chứng minh payment accepted + pending/reorg không trả ACTIVE/key/entitlement, ISSUE thiếu/mismatch envelope không submit, hoặc TypeScript/Solidity vector khớp byte-for-byte.

## 4. Thứ tự thực thi bắt buộc

```text
WP-00 Preflight
  -> WP-01 Baseline/traceability
  -> WP-02 SQL semantic integrity
  -> WP-03 Platform foundation
  -> WP-04 Auth hardening
  -> WP-05 Terms + crypto + Controller
  -> WP-06 Catalog + ComparePlans
  -> WP-07 Commerce Order + AcceptTerms
  -> WP-08 Checkout + SePay ingest
  -> WP-09 Payment success + Renewal
  -> WP-10 Solidity Registry
  -> WP-11 Activation envelope + License issuance
  -> WP-12 Relayer command worker
  -> WP-13 Indexer/finality/projection/reconcile
  -> WP-14 LIC-03 + BC-05 API/surfaces
  -> WP-15 Cross-phase acceptance
```

Không bắt đầu WP-07 trước khi WP-02 và WP-06 pass. Không submit chain ở WP-12 trước khi WP-05, WP-10 và envelope hard gate của WP-11 pass.

## 5. Work packages triển khai chi tiết

### WP-00 — Preflight và regression snapshot

Phạm vi: toàn repo, không sửa behavior.

1. Đọc lại `AGENTS.md` và bốn authority artefact.
2. Lưu `git status --short`; không reset/clean/checkout thay đổi có sẵn.
3. Chạy frozen install và quality commands trong từng delivery unit.
4. Chạy `db:verify` chỉ đọc nếu `DATABASE_URL` được cung cấp; không initialize/seed Neon.
5. Chụp danh sách OpenAPI path, schema hash và test count để so sau remediation.

Stop condition: dừng nếu source/schema thay đổi ngoài dự kiến từ lần audit này hoặc không xác định được canonical baseline.

### WP-01 — Phase 1 baseline, validator và traceability

Capabilities: cả 36 ID; đây là governance package.

Expected owners:

- Tạo matrix dưới `docs/traceability/` với mỗi ID có actor, input/output, owner module, API/use case, owner table/state, transaction boundary, idempotency/concurrency, security negative test, test file và surface.
- Tạo validator ở owner phù hợp sau search-first. Validator phải parse/match 36 ID, phát hiện ID thiếu/trùng, active legacy reference, SQL inventory drift, capability không có test owner, và duplicate owner của CAT-05/BC-04/BC-05.
- Đồng bộ TECH với external PostgreSQL qua `DATABASE_URL`, SQL trực tiếp/no ORM và Compose hiện tại. Historical/out-of-scope mention vẫn được phép.
- Định nghĩa một shared vector format cho Terms hash, entitlements JCS, plan commitment, activation commitment và EIP-712. Vector implementation hoàn tất tại WP-05/WP-10 nhưng schema/owner phải khóa tại đây.
- Thêm validator vào backend/root CI phù hợp với cấu trúc repo hiện tại và future split.

Acceptance:

- Validator báo đúng 36/36 và fail khi fixture tạm bỏ một capability hoặc thêm active legacy reference.
- SQL table inventory được so theo tên, không khóa sản phẩm vào con số vĩnh viễn.
- CAT-05, BC-04 và BC-05 mỗi concern có đúng một owner.
- Bốn authority artefact không còn mâu thuẫn local PostgreSQL/ORM với quyết định hiện tại.

### WP-02 — Phase 2 SQL semantic integrity

Capabilities: foundation cho COM-01..06, LIC-01..08, BC-01..05.

Test-first:

1. Mở rộng/tách integration test trên PostgreSQL thật để tạo các cặp Provider, Product, Plan, Customer, Order, Attempt, License, Command và Event.
2. Viết deliberate inserts hiện đang lọt và kỳ vọng SQLSTATE `23503` cho:
   - PaymentTransaction dùng `order_id` B + Attempt của Order A.
   - Renewal Order Customer A trỏ License Customer B.
   - Order/License dùng Product A + Plan thuộc Product B cùng Provider.
   - License/Device last-event pointer trỏ event subject khác.
   - ChainCommand/ChainEvent trỏ Provider/Order/License/Device không đồng nhất.
3. Giữ positive fixtures chứng minh canonical rows vẫn insert được.

Schema changes dự kiến:

- Thêm unique keys cần thiết rồi composite FK PaymentTransaction→PaymentAttempt/Order.
- Bind renewal target bằng License ID + Provider + Customer.
- Bind Order/License Plan bằng Plan ID + Product ID + Provider + commitment.
- Bind command Order/License/provider và bắt `RENEW_LICENSE` có renewal Order.
- Bind projection pointer tới đúng ChainEvent subject; bind ChainEvent↔Command subject nơi có command.
- Cập nhật cả parent SQL và backend copy trong cùng patch; hash phải giống nhau.
- Không tạo TypeORM migration/table. Không apply lên Neon trong test.

Rollout cho database bên ngoài:

- `db:initialize` tiếp tục chỉ dành cho public schema trống và không tự chạy khi API/Worker boot.
- Sau khi schema/test đã ổn, chuẩn bị một SQL `ALTER` được review trong `backend/database/maintenance/` nếu cần giữ dữ liệu; nếu database development vẫn trống thì có thể chọn reset + initialize.
- Không tự chạy một trong hai đường trên. Trước khi tác động Neon phải có yêu cầu rõ ràng, xác nhận đúng database/backup và kiểm tra dữ liệu hiện hữu.
- Trước khi rollout, `db:verify` trên Neon cũ phải fail semantic drift là hành vi đúng; chỉ pass lại sau khi người dùng cho phép align schema.

Verifier changes:

- So named tables/extensions/columns và normalized `pg_get_constraintdef`, unique/index definitions quan trọng thay vì chỉ tổng count.
- Report constraint/index thiếu, thừa hoặc sai definition; `matchesBaseline=false` với semantic drift dù tổng số bằng nhau.

Acceptance:

- Clean-room apply pass.
- Seed chạy hai lần không nhân bản.
- Tất cả negative fixtures fail đúng constraint; positive fixtures pass.
- Verifier mutation test chứng minh thay một composite FK bằng FK rời sẽ fail.
- Parent/backend schema byte-identical.
- Object inventory/count mới được cập nhật theo schema thực; không giữ cứng các mốc 41/79/167 cũ sau khi bổ sung constraint.

### WP-03 — Phase 2 platform foundation

Capabilities: OPS-02 foundation và ports cho Phase 3–5.

1. Tạo một PostgreSQL Pool owner trong Platform, export token/service và đóng đúng một lần khi shutdown. Identity, Catalog, Health và module mới reuse owner này; transaction được truyền bằng explicit context/client, không gọi repository chéo module.
2. Hoàn thiện ports + fake/local adapters cho SePay checkout/IPN verification boundary, EVM submit/read, private Storage, activation envelope, AI, Email/Push Notification. Wire bằng config; fake/local bị reject rõ ràng ở production.
3. Mở rộng typed environment contract theo TECH và thống nhất tên biến. Cập nhật `.env.example`, runbook, OpenAPI exporter/test environment; không sửa secret trong ignored `.env`.
4. Extract/test log redaction. Không bao giờ log password/currentPassword/token/signature/raw IPN secret/activation plaintext/envelope/key material.
5. Tạo audit application interface có thể tham gia cùng DB transaction. Auth/security và mọi mutation từ WP-04 trở đi phải gọi owner này.
6. Thêm CI secret scan và test image không chứa `.env`, maintenance drop script, dev secret hoặc activation material.
7. Giữ generated OpenAPI snapshot đồng nhất; application client migration diễn ra dần trong WP-06/WP-14.

Acceptance:

- API/Worker shutdown không còn open Pool/Redis handle.
- Một request transaction dùng cùng Pool/client qua boundary đã định nghĩa.
- Adapter selection test fail-fast ở production và không silent fallback.
- Redaction test dùng sentinel secret và chứng minh sentinel không xuất hiện trong log.
- Audit insert rollback cùng business mutation khi transaction rollback.
- Backend integration tests dùng env cô lập, không đọc secret/DB thật.

### WP-04 — Phase 3 AUTH-01..04 hardening

Owner: `identity-access`; không có CustomerController hoặc khóa riêng theo tài khoản.

Test-first:

- Supertest + PostgreSQL/Redis cô lập cho register→verify, resend, login, refresh rotation/reuse, logout, reset/change password, lock/disable và profile theo role.
- Security tests: duplicate email, invalid/expired token, refresh replay, disabled/locked user, failed-login lockout, last active System Admin, Customer/provider field escalation và response secret allowlist.
- Assert mọi response không có `passwordHash`, refresh token hoặc key material.

Implementation:

1. Tạo DTO runtime riêng cho register, resend, forgot, reset, profile và state mutation; frontend chỉ gửi field API chấp nhận.
2. Map domain errors sang stable 400/401/404/409 thay vì 500; giữ anti-enumeration cho resend/forgot.
3. Mọi return đi qua response mapper allowlist, kể cả profile update và admin state change.
4. Implement failed-login counter/locked-until atomic; reset khi login thành công; rate limit login/reset/resend.
5. Refresh token có family/session context, rotate atomically, detect replay và revoke family/session version. Logout consume/revoke server-side trước khi clear cookie.
6. Register persist pending trước; token/email delivery sau commit; resend phải phục hồi khi delivery lỗi. Không trả verify token qua production API.
7. Profile update theo role, chỉ update field thực sự được gửi; Provider chain address/namespace không có mutation path sau bind/publish.
8. Audit register/verify/login failure/session revoke/password/state/profile security mutation theo policy.

Acceptance:

- AUTH-01..04 mỗi ID có ít nhất một happy, authorization-negative và retry/concurrency test owner.
- Register form thật không còn 400 do `passwordConfirmation` drift.
- Logout/replay làm access/refresh family không còn usable theo session policy.
- Provider/Customer không thể sửa field role hoặc chain identity trái phép.

### WP-05 — Phase 3 Terms và crypto vectors

Capabilities: CAT-04, AUTH-05; prerequisite BC-01/02.

1. Tạo Terms artefact versioned dưới backend config với UTF-8, LF và đúng một final newline.
2. Implement loader fail-closed theo version; normalize Terms; tính `termsHash`.
3. Search-first chọn/adopt JCS implementation được duy trì; không dùng `JSON.stringify` ad hoc cho commitment.
4. Dùng exact ABI encoding trong TECH: domain constant, provider address, UUID bytes16, plan version, duration, max devices, entitlements hash, Terms hash. Price không nằm trong rights commitment.
5. Implement activation commitment và EIP-712 Controller authorization theo frozen domain/message schema.
6. Lưu shared vectors dạng machine-readable; TypeScript tests verify byte-exact. WP-10 phải consume cùng vectors, không copy expected values bằng code thứ hai.

Acceptance:

- CRLF/LF, Unicode và missing final newline normalize ra cùng expected hash khi nội dung semantic giống canonical rule.
- JCS key order/numeric fixtures stable; nested/non-finite/unsupported inputs fail rõ ràng.
- UUID decode đúng 16 bytes; malformed UUID/address/hash length fail.
- TypeScript vector output frozen và sẵn sàng cho Solidity comparison.

### WP-06 — Phase 3 Catalog, Plan lifecycle và CAT-05

Capabilities: CAT-01..05.

Test-first:

- PostgreSQL integration test cho create/read/update/publish/archive/delete Product/Plan.
- Hai Provider fixture; mọi admin action Provider A trên resource B phải 403/404 và không mutation/audit success.
- Published Plan mutation phải fail; thay rights/Terms tạo version row mới.
- Concurrent create/version/publish giữ unique deterministic.

Implementation:

1. Mọi provider query lấy authority từ `actor.sub`; không nhận provider ID từ client.
2. Product insert/update/list/find/transition filter Provider.
3. Plan insert bind Product cùng Provider, cấp version transactionally, load current Terms và tính commitment từ WP-05.
4. Chỉ DRAFT được mutate/delete. Published immutable; revision tạo row/version mới và commitment mới.
5. Public catalog chỉ trả Product/Plan Published qua response DTO allowlist.
6. Implement `ComparePlansQuery` duy nhất ở CAT-05 với structured response; Web/Mobile/AI sau này chỉ consume owner này.
7. Regenerate OpenAPI và chuyển catalog clients sang generated contract thay interface viết tay.

Acceptance:

- P3-01 SQL errors bị regression test bắt và đã hết.
- Provider A không đọc/sửa/publish/delete Product/Plan của B.
- Published Plan giữ nguyên bytes Terms/rights/commitment; revision không sửa lịch sử.
- TypeScript plan commitment khớp vector WP-05.
- CAT-01..05 traceability có API/use case/table/test owner đầy đủ.

### WP-07 — Phase 4 COM-01/02 Order và AcceptTerms

Owner: `commerce-payment`.

1. Tạo Commerce module/controller/application/repository theo layer hiện có; mount vào API.
2. CreateOrder khóa published Plan, lấy provider/product/plan/price/duration/device/entitlements/Terms/commitment hoàn toàn server-side và tạo `WAITING_TERMS_ACCEPTANCE`.
3. Idempotency key cùng actor+payload trả cùng Order; key cũ với payload khác trả 409.
4. AcceptTerms là endpoint/use case riêng: lock Order, verify Customer ownership, exact Terms version/hash/commitment và allowed state, set timestamp rồi chuyển `WAITING_PAYMENT`.
5. Cancellation/expiry chỉ theo transition canonical và có audit.
6. Frontend checkout tách hai bước và hiển thị Terms artefact đúng snapshot; không coi checkbox local là acceptance.

Acceptance:

- Plan đổi sau CreateOrder không làm snapshot đổi.
- Customer B không đọc/accept/cancel Order A.
- Wrong/stale Terms hash bị từ chối.
- Hai request đồng thời không tạo hai Order hoặc transition hai lần.
- OpenAPI/Web/Mobile generated clients compile.

### WP-08 — Phase 4 COM-03/04 Checkout và SePay IPN

1. Checkout chỉ cho Customer owner, Order `WAITING_PAYMENT` và Controller `ACTIVE`.
2. Tạo PaymentAttempt transactionally trước, gọi SePay/fake sau transaction; persist checkout reference/expiry theo idempotency và supersede policy rõ ràng.
3. Định nghĩa versioned IPN adapter boundary. Khi exact SePay production contract chưa được cung cấp, implement deterministic fake fixtures và để production adapter fail-closed với gate rõ ràng; không đoán signature.
4. Ingest mỗi provider event ID đúng một lần, giữ raw payload theo policy, classify MATCHED/DUPLICATE/UNMATCHED/AMOUNT_MISMATCH/INVALID.
5. Duplicate, out-of-order và concurrent delivery phải cho cùng durable result.

Acceptance:

- Checkout trước accept Terms, sau expiry, sai owner hoặc inactive Controller đều fail.
- External adapter không được gọi trong DB transaction/row lock.
- Invalid signature/payload không mutation Order/License.
- Cross-order attempt/event bị DB constraint chặn.
- 20 concurrent duplicate events tạo đúng một PaymentTransaction effect.

### WP-09 — Phase 4 COM-04..06 payment success, review và renewal

1. Với NEW_PURCHASE matched success, một PostgreSQL transaction phải cập nhật PaymentTransaction + Attempt SUCCEEDED + Order PAYMENT_ACCEPTED + tạo License PENDING_ONCHAIN + ISSUE command đúng một lần.
2. Không set License ACTIVE, không trả key/entitlement và không gọi Redis/RPC trong transaction.
3. Payment review/history/derived receipt có RBAC: Customer own data, Provider own tenant, System review; mọi review có audit.
4. Renewal Order snapshot target License đúng Customer+Provider; payment success chỉ tạo RENEW command, không đổi expiry.
5. Receipt sinh từ durable snapshot/evidence, không phải Contract PDF.

Acceptance:

- Duplicate/out-of-order/concurrent IPN tạo đúng một License + một command.
- Amount mismatch/unmatched không chuyển Order.
- Cross-customer/provider renewal bị cả app và DB từ chối.
- `licenses.expires_at` byte-identical trước/sau renewal payment cho tới finality.
- Payment accepted một mình không tạo usable rights.

### WP-10 — Phase 5 BC-01 Solidity Registry

Open gate: final ABI/event schema phải được freeze sau WP-05 vectors. Nếu chưa chốt, dừng trước deploy/relayer integration và ghi blocker, không invent production ABI.

1. Hoàn thiện Hardhat config/scripts trong `backend/contracts` và Solidity Registry tối thiểu cho ISSUE/read Phase 5.
2. Contract bind Provider address, Controller, Product/Plan identity, plan commitment, activation commitment/version, status và expiry; chain là rights authority.
3. Emit event allowlist không chứa Terms content, price, payment payload, PII, raw device ID hoặc activation secret.
4. Contract test unauthorized transition, duplicate issue/idempotency identity, invalid commitment/version/state.
5. Solidity consume shared vectors WP-05 và assert byte-for-byte với TypeScript.
6. Export ABI/type artefact cho backend từ một owner; không hand-copy ABI.

Acceptance:

- Hardhat compile/test pass độc lập trong backend delivery unit.
- TS/Solidity hashes/digests khớp byte-for-byte.
- Event/calldata secret scan pass.
- Docker/CI chạy contract checks trước backend build completion claim.

### WP-11 — Phase 5 LIC-01/02 activation envelope và issuance

1. CSPRNG tạo activation secret; DB chỉ lưu commitment/version/last4 được phép, không plaintext.
2. Sau payment transaction commit, prepare encrypted Redis one-time envelope gắn ISSUE command/license/version/commitment với TTL và authenticated encryption.
3. Relayer precondition verify envelope tồn tại, giải mã hợp lệ và commitment khớp payload/DB; mismatch hoặc thiếu thì submit count bằng 0.
4. Nếu preparation fail khi command vẫn PENDING, regenerate secret + commitment + command payload/hash trong một DB transaction rồi prepare lại.
5. Sau SUBMITTED, commitment immutable; không regenerate.
6. Plaintext chỉ release một lần cho đúng Customer sau LICENSE_ISSUED confirmed finality; Redis loss không làm rights ACTIVE/REVOKED.

Acceptance:

- Sentinel activation secret không xuất hiện trong PostgreSQL, log, audit, calldata, event, OpenAPI snapshot hoặc frontend bundle.
- Missing/tampered/expired envelope không submit.
- Concurrent prepare/retrieve không duplicate/reveal hai lần.
- Pending/reorg License không trả key.

### WP-12 — Phase 5 BC-02 ChainCommand/Relayer Worker

1. Implement command repository/application owner và BullMQ trigger; durable truth luôn ở PostgreSQL.
2. Claim bằng transaction/lease (`FOR UPDATE SKIP LOCKED` hoặc equivalent), stable idempotency, bounded retry/backoff và DEAD_LETTER.
3. Nonce policy bind relayer/network; RPC timeout sau broadcast chuyển `SUBMITTED_UNKNOWN`, query receipt/nonce trước khi resend.
4. Persist tx hash/status/audit atomically theo guarantee; queue delivery lặp không duplicate submit.
5. Adapter profile local/Sepolia rõ ràng; không silent fallback.

Acceptance:

- Hai Worker claim cùng command chỉ một submit.
- Crash/restart sau submit không phát tx thứ hai.
- Timeout path vào SUBMITTED_UNKNOWN và reconcile receipt trước retry.
- Envelope precondition từ WP-11 chạy trước mọi ISSUE submit.

### WP-13 — Phase 5 BC-03/04 Indexer, finality, projection và reconcile

1. Ingest event theo `(network, chainId, contract, txHash, logIndex)` idempotent.
2. Tách observed PENDING với CONFIRMED finality; verify canonical block hash và cấu hình confirmations.
3. Apply event + projection + command state trong một PostgreSQL transaction. Chỉ confirmed canonical event được đưa License ACTIVE.
4. Reorg đánh dấu event REORGED, rebuild projection từ canonical history và demote command đã mất confirmation về SUBMITTED_UNKNOWN trước resend.
5. Implement BC-04 owner duy nhất cho automatic/manual reconcile, stale/mismatch detection và audit. Operations UI chỉ gọi owner này.

Acceptance:

- Duplicate log không tạo duplicate effect.
- Pending event và reorged event không tạo key/right usable.
- Confirmed ISSUE chuyển đúng một License ACTIVE.
- Confirmed→reorg phục hồi projection/command đúng, không duplicate tx/license.
- Deliberate cross-subject event/pointer fixture bị DB từ chối.

### WP-14 — Phase 5 LIC-03 và BC-05 API/surfaces

1. LIC-03 authenticated projection read cho Customer owner và Provider tenant, có projection freshness; không chứa activation plaintext.
2. BC-05 public verify owner riêng, response allowlist: opaque license ID, Provider display identity, Product/Plan version/commitment, state, expiry, tx/block/finality.
3. Public response phân biệt `CHAIN_CONFIRMED`, `PENDING_ONCHAIN`, `PROJECTION_STALE`, `REORGED`, `NOT_FOUND`; rate limit và anti-enumeration phù hợp.
4. Không trả Customer PII, device identifier/key, token, Terms content hoặc raw payment/event payload.
5. Regenerate OpenAPI và chuyển Web/Mobile sang generated API. Xóa runtime mock cho order/payment/license/public verify khi boundary thật đã hoạt động; giữ fixture chỉ trong test.

Acceptance:

- Customer/Provider isolation pass.
- Public allowlist snapshot và secret/PII negative tests pass.
- BC-05 là implementation duy nhất; LIC-03 không tự verify chain lần hai.
- Web/Mobile dùng cùng endpoint/schema và không import verification/license mock production.

### WP-15 — Cross-phase acceptance và đóng Phase 1–5

Chạy golden flow trên PostgreSQL + Redis + deterministic local chain cô lập:

1. Register/verify/login Customer; Provider có Product/Plan Published với Terms/commitment.
2. CreateOrder → AcceptTerms → checkout.
3. Deliver valid SePay fake IPN; assert PAYMENT_ACCEPTED + License PENDING_ONCHAIN + ISSUE command, chưa có usable key.
4. Prepare envelope → submit → ingest pending event; vẫn chưa ACTIVE/key.
5. Đạt finality → projection ACTIVE → Customer retrieve key đúng một lần.
6. Chạy song song negative suites: duplicate IPN, cross-order link, missing/mismatch envelope, RPC unknown, duplicate event và reorg.

Final verification matrix:

```powershell
# backend
corepack pnpm install --frozen-lockfile
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm openapi:check
corepack pnpm build
docker build -t emukey-backend:phase5 .

# frontend và mobile: chạy cùng lint/typecheck/test/openapi:check/build
# root: validate Compose và baseline/traceability validator
docker compose --env-file .env.example config --quiet
git diff --check
git status --short
```

Phase 1–5 chỉ được claim complete khi:

- 24 capability thuộc Phase 3–5 (`AUTH-01..05`, `CAT-01..05`, `COM-01..06`, `LIC-01..03`, `BC-01..05`) có owner/test trace đầy đủ; foundation Phase 1–2 gate pass.
- Provider isolation, schema composite integrity, crypto cross-language, IPN concurrency, envelope hard gate và reorg tests đều pass.
- Không có TypeORM, local PostgreSQL Compose service, secret leak, production mock fallback hoặc UI mock được dùng làm business truth.
- OpenAPI Web/Mobile đồng nhất và application thực sự consume generated contract.
- Final diff không có generated junk, secret, dump, trace, screenshot hoặc lockfile churn ngoài chủ đích.

### Trạng thái thực thi — kiểm tra lại ngày 10/09/2026

| Work package | Trạng thái local/test | Bằng chứng chính                                                                                                                                       |
| ------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WP-00–01     | `PASS`                | validator 36 capability/19 table; duplicate, missing capability và active legacy fixtures đều bị từ chối; authority artefact và schema hash khớp       |
| WP-02        | `PASS`                | clean-room 44 FK/89 index/182 constraint; semantic definition verifier; same-name mutation và cross-subject Order/License/Command/Event đều bị từ chối |
| WP-03        | `PASS`                | shared Pool/Redis lifecycle, AI/Email/Push DI wiring, adapter fail-fast, private storage port, expanded redaction, transactional audit và delivery scan |
| WP-04–06     | `PASS_LOCAL`          | Internal identity authorization/state/rate-limit, anonymous Order token, RFC8785/Keccak, tenant isolation, plan commitment và typed Catalog OpenAPI     |
| WP-07–09     | `PASS_LOCAL`          | immutable Order/Terms flow, concurrent idempotency, checkout gates, versioned fake IPN, scoped payment evidence/receipt/review và renewal command       |
| WP-10        | `PASS_LOCAL`          | Hardhat compile/test, Ignition deploy, TypeScript–Solidity byte vectors, generated ABI, invalid input/identity và calldata/event secret scan            |
| WP-11–14     | `PASS_LOCAL`          | viem local-account EIP-1559 relayer/RPC, durable indexer cursor/lease, canonical finality/reorg, License API và generated clients                      |
| WP-15        | `PASS_LOCAL`          | PostgreSQL + Redis + deterministic local chain golden flow; full repository verification matrix được chạy trước handoff                                |

`PASS_LOCAL` không đồng nghĩa production-ready. SePay cần credentialed Sandbox E2E và merchant production được kích hoạt, Terms cần được phê duyệt, còn relayer cần production secret cùng Sepolia RPC/finality; các giá trị giả không được dùng để tuyên bố production-ready.

Database thật tại `DATABASE_URL` đã được người dùng cho phép reset ngày 09/09/2026: 18 bảng cũ đã bị xóa, sau đó `backend/database/schema.sql` được áp dụng clean-room. `db:verify` xác nhận database khớp baseline Phase 2 (`18 table / 44 FK / 87 index / 179 constraint`), không thiếu hoặc sai critical column/constraint/index. Database sau đó đã được seed dữ liệu minh họa theo yêu cầu: 50 demo users và 40 row cho mỗi bảng nghiệp vụ còn lại; toàn bộ demo account dùng chung mật khẩu development được hash bằng Argon2.

Phase 2 được kiểm tra lại lần nữa ngày 09/09/2026. Negative SQL fixtures, semantic verifier, schema hash, database thật, baseline/delivery/OpenAPI gate, Compose không PostgreSQL và standalone backend Docker build đều pass. Audit bổ sung phát hiện AI/Push fake mới chỉ tồn tại dưới dạng class nhưng chưa được wire qua DI, một số alias secret chưa nằm trong redaction và Redis shutdown chưa có test trực tiếp; ba điểm này đã được sửa và regression test đã được thêm. Driver `pg` vẫn cảnh báo URL thật đang dùng SSL mode có semantics sẽ đổi ở major version kế tiếp; đây chưa phải failure ở phiên bản hiện tại nhưng URL nên chuyển rõ sang `sslmode=verify-full` khi người dùng cập nhật connection string.

Phase 3 được cập nhật theo baseline v5.1: giữ Customer registration/email verification/profile/JWT và bốn role; chỉ Customer Controller/per-account key/KMS bị xóa. Order/License/Conversation gắn `customer_user_id`. Provider tenant isolation, plan commitment và generated OpenAPI contract vẫn được giữ. Các kiểm thử ghi dữ liệu chỉ dùng PostgreSQL/Redis Testcontainers cô lập, không thay đổi database thật.

Phase 4 được kiểm tra lại ngày 09/09/2026 và đạt `PASS_LOCAL`. Audit đã sửa race của CreateOrder idempotency bằng transaction advisory lock; bổ sung Terms endpoint fail-closed theo đúng version/hash snapshot; trả đủ amount/expiry/checkout URL; chặn application caller sai role/owner và checkout sai state, quá hạn hoặc Controller recovery; classify late/unmatched/amount-mismatch IPN mà không cấp quyền; đồng thời bổ sung payment history/derived receipt theo Customer/Provider/System scope và review mutation có audit. Payment success vẫn chỉ tạo License `PENDING_ONCHAIN`; renewal chỉ tạo `RENEW_LICENSE` command và giữ nguyên `licenses.expires_at` tới finality. Frontend checkout đã tách CreateOrder khỏi AcceptTerms và consume generated Order/Terms/Checkout contracts; Mobile order client cũng dùng generated contract. Seed baseline hiện tính Terms hash và plan commitment thật thay vì byte placeholder. Ma trận xác minh đạt backend 22/22 test files (78/78 tests), frontend 8/8 (27/27), mobile 1/1; lint, typecheck, build, OpenAPI consistency, baseline, delivery scan và standalone backend Docker build đều pass. Runtime image đã được kiểm tra có `config/license-terms/v1.md`; image kiểm tra tạm thời đã được xóa. Tất cả integration test ghi dữ liệu dùng PostgreSQL/Redis Testcontainers cô lập, không thay đổi database thật. SePay production adapter/signature contract vẫn là `BLOCKED_FOR_PRODUCTION`; chỉ deterministic fake v1 được phép ở local/test và production config tiếp tục fail-closed.

Phase 5 WP-10–14 được cập nhật theo baseline v5.1. Contract relayer-only; không còn controller address/signature/EIP-712. License query/retrieval dùng Customer hoặc Provider JWT theo ownership; activation key tiếp tục là bearer capability ở các thao tác thiết bị và không chứng minh danh tính người mua. Relayer giữ durable nonce/raw transaction/receipt và indexer giữ finality/reorg checkpoint. Activation secret không xuất hiện trong calldata/event/log và Customer owner chỉ lấy một lần sau finality. Production EVM adapter/RPC, relayer secret, finality values và ABI approval vẫn là `BLOCKED_FOR_PRODUCTION`; production tiếp tục từ chối adapter `hardhat` và public Hardhat key.

Phase 5 được harden theo baseline v5.1. Mobile có Customer login, License/Verify và SecureStore cho access session; không lưu Order access token. Chain command reserve nonce bằng PostgreSQL lock + unique index, persist raw signed transaction/hash trước broadcast, reuse transaction sau restart và lưu receipt/revert. Worker phục hồi activation envelope trước submit; commitment khóa sau khi có nonce/raw transaction. Relayer `viem` ký EIP-1559 bằng private key inject từ environment secret; không còn AWS/Google KMS. Hardhat JSON-RPC chạy trong Compose; local dùng deployment script `viem` idempotent với address/block đã kiểm chứng, Sepolia tiếp tục dùng Ignition. Indexer `viem` giữ checkpoint/lease bền vững và xử lý reorg. Schema canonical hiện là 18 bảng; database thật không được tự ý reset/apply schema mới.

Ngày 11/09/2026, BC-04 đã được hoàn thiện thành engine automatic/manual dùng chung: drain command `SUBMITTED_UNKNOWN`/receipt, poll RPC theo checkpoint, sửa trạng thái command theo canonical event và rebuild License/Device projection khi status, expiry, activation commitment/version hoặc event pointer lệch. Worker gọi engine sau mỗi lần xử lý command; idle tick không tạo audit log rác. Runtime không còn deterministic/noop blockchain adapter; `EVM_ADAPTER=viem` là bắt buộc ở mọi environment. Compose deploy contract thật trước API/worker và readiness kiểm tra chain ID cùng contract bytecode. Golden flow PostgreSQL + Redis + Hardhat thật đã pass từ payment tới finality, one-time activation retrieval và cố ý làm sai projection rồi BC-04 tự sửa. Ma trận hiện hành: backend unit 60/60, API/worker contract 8/8, integration 15/15, Solidity 5/5, frontend 25/25 và mobile 3/3; lint/typecheck/build/OpenAPI/baseline/Compose đều pass.

Ngày 14/09/2026, Phase 4 đã bổ sung adapter Cổng thanh toán SePay dùng SDK Node.js chính thức `sepay-pg-node@1.0.0`: backend tạo form checkout `POST` được ký cho Sandbox/Production, không trả secret cho client; IPN xác thực `X-Secret-Key`, chỉ chuẩn hóa `ORDER_PAID` + `CAPTURED` + `APPROVED` bằng VND và tiếp tục dùng durable idempotent classifier hiện có. Frontend submit signed fields tới SePay và chỉ hiển thị thanh toán thành công sau khi backend nhận IPN; OpenAPI của backend/frontend/mobile đã đồng bộ. Unit, controller, frontend và contract test pass; credentialed Sandbox E2E vẫn cần `MERCHANT ID`/`SECRET KEY` của người dùng và HTTPS IPN công khai.

Ngày 15/09/2026, credentialed SePay Sandbox E2E đã được xác nhận trên database thật từ Order `PAYMENT_ACCEPTED`/Payment `MATCHED` đến một `ISSUE_LICENSE` command duy nhất. Worker đã gửi transaction thật lên Sepolia, receipt thành công tại block `11706515`, indexer ghi canonical `LICENSE_ISSUED`, đạt finality và projection chuyển License sang `ACTIVE`; contract read xác nhận command đã được consume và License có trạng thái `ACTIVE`. Phí giao dịch thực tế là `0.0002772951480107 ETH` (`254350` gas, `1090210922` wei/gas). Reconciliation đã sửa audit system actor cho đúng schema; receipt thành công không còn bị claim lặp; indexer tự học giới hạn `eth_getLogs` của RPC, chia nhỏ range, dừng khi đã tới chain head và che credential trong lỗi. Queue chỉ có một command/hash/attempt cho License này. Unit 73/73, focused real-RPC integration, lint, typecheck, build, OpenAPI, baseline và Solidity 5/5 đều pass.

Snapshot kiểm chứng cũ ngày 11/09/2026 đã bị thay thế bởi baseline v5.1. Kết quả kiểm thử hiện hành phải được chạy lại sau thay đổi Customer ownership; bằng chứng Google Cloud/KMS cũ không còn là dependency hay readiness gate của dự án.

## 6. External blockers không được tự suy đoán

Các blocker sau không ngăn local real-RPC implementation nhưng chặn production completion:

- SePay production merchant activation và production webhook retry observation.
- Approved global Terms v1 content/hash.
- Final Smart Contract ABI/event schema sau khi crypto vectors pass.
- Production secret injection, access policy và rotation runbook cho relayer private key.
- Production RPC/finality/retry values.

Khi gặp blocker, hoàn thiện port/fake/local test đến boundary, ghi rõ trạng thái `BLOCKED_FOR_PRODUCTION`, và không đưa giá trị giả vào production config.

## 7. Handoff cho lượt thực thi tiếp theo

Phase 1–5 đã hoàn thành; Phase 5 được re-verify bằng real local RPC ngày 11/09/2026 và bằng credentialed SePay Sandbox → Sepolia E2E ngày 15/09/2026. Baseline v5.1 giữ Customer identity/JWT, loại Customer Controller/per-account key/KMS. Không tuyên bố production-ready khi ABI, relayer secret/RPC/finality hoặc SePay production go-live còn bị chặn. Khi tiếp tục:

1. Chạy focused failing test → minimal implementation → focused pass.
2. Chạy backend lint/typecheck/test/build và OpenAPI check nếu contract đổi.
3. Cập nhật traceability row của capability liên quan.
4. Kiểm tra diff/status và chỉ chuyển WP khi acceptance của WP hiện tại pass.
5. Không apply schema hoặc seed lên Neon nếu chưa có yêu cầu rõ ràng của người dùng.
