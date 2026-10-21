# Kế hoạch gỡ audit người dùng

> **For agentic workers:** Dùng skill `executing-plans` để thực hiện tuần tự theo checklist. Chỉ dùng subagent khi có sự cho phép riêng. Kế hoạch này không cho phép tự commit, push hoặc áp dụng migration lên DB đang cấu hình.

**Goal:** Gỡ hoàn toàn chức năng nhật ký hoạt động người dùng khỏi DB, backend, UI và API contract; giữ lịch sử nghiệp vụ và log lỗi kỹ thuật tối thiểu.

**Architecture:** Loại bỏ `audit_logs` và toàn bộ producer/consumer của bảng. Các module tiếp tục ghi trạng thái, bằng chứng, lý do và lịch sử vào bảng nghiệp vụ hiện có. Dùng logger hiện có cho lỗi kỹ thuật, không thay audit bằng một bảng hoặc luồng log hành động mới.

**Tech Stack:** NestJS 12, TypeScript, PostgreSQL 15+, `pg` 8.23.0, `nestjs-pino` 5.1.0, Pino 10.3.1; React/Vite, Ant Design, TanStack Query; OpenAPI và types dùng chung cho web/mobile.

**Spec:** Yêu cầu người dùng ngày 20/10/2026: “gỡ hoàn toàn chức năng audit người dùng, giữ lịch sử nghiệp vụ và log lỗi kỹ thuật tối thiểu”. Phạm vi được cụ thể hóa bên dưới. Code đã hiện thực; migration chỉ chạy trên DB tạm.

## Tiến độ thực hiện

- [x] Gỡ producer, API, DTO và dependency audit ở backend; bỏ request reason chỉ phục vụ audit khi khóa/mở khóa/vô hiệu hóa tài khoản.
- [x] Gỡ bảng khỏi baseline; thêm migration idempotent; cập nhật seed/verify/restore cho 18 bảng và ma trận 34 capability.
- [x] Giữ log lỗi 5xx đã loại bỏ payload nhạy cảm, tắt access log tự động; kiểm thử request ID, không lộ secret và không ghi request thành công.
- [x] Gỡ UI/menu/query/types audit, giữ chuyển hướng URL cũ về tổng quan; regenerate OpenAPI/types cả web/mobile.
- [x] Cập nhật tài liệu và sơ đồ; giữ lịch sử nghiệp vụ và các bằng chứng release cũ.
- [x] Chạy 9 ca browser navigation ở 390px/1280px, gồm URL audit cũ: tất cả qua.
- [x] Ghi kết quả kiểm chứng: backend 317/317 test, browser 9/9 ca và nhóm frontend `completed-flows.test.tsx` 7/7 test qua ở lượt xác nhận cuối; backend/web typecheck, lint, build qua; mobile typecheck và OpenAPI check qua. Bộ frontend rộng hơn đã được chạy nhưng dừng sau khi ghi nhận lỗi/timeout ở đăng ký, khôi phục key và quản lý gói, nên không coi bộ này đã qua.

Checklist chi tiết bên dưới là quy trình tham chiếu; phần tiến độ và kết quả kiểm chứng ghi nhận trạng thái thực tế.

## 1. Ranh giới và điều kiện

- Chỉ gỡ nhật ký hoạt động tổng quát: ai đăng nhập, sửa hồ sơ, sửa sản phẩm, thực hiện thao tác quản trị… đang được gom vào `audit_logs`.
- Giữ transaction nghiệp vụ, khóa, authorization, idempotency, session invalidation, retry và các constraint bảo vệ dữ liệu.
- Giữ các bảng `orders`, `payment_attempts`, `payment_transactions`, `licenses`, `license_devices`, `chain_commands`, `chain_events`, `chain_indexer_checkpoints`, `notifications`, `conversations`, `messages`.
- Giữ `reviewed_by_user_id`, `reviewed_at`, `review_reason`, `review_resolution`, `status_reason`, `resolution_reason`, `resolution_evidence_type`, `resolution_evidence` và các liên kết/mốc thời gian nghiệp vụ.
- Giữ người mời Provider và trạng thái lời mời; đây là dữ liệu onboarding.
- Giữ nội dung thông báo hệ thống trong hội thoại dùng để biểu diễn nhận/chuyển hỗ trợ.
- Giữ `last_error`, attempt count, retry time, worker lock và delivery status.
- Không xóa trường chỉ vì tên có `reason`, `actor`, `event`, `history`, `log` hoặc mô tả có từ “audit”.
- Không đổi quyền truy cập của API còn lại. Đặc biệt, giữ kiểm tra actor trong service/controller dù bỏ actor khỏi một hàm repository chỉ phục vụ audit.
- Không thay đổi các công cụ kiểm tra bảo mật dependency như `dependency-audit.mjs` hoặc lệnh `pnpm audit`.
- Không thêm dependency, bảng lịch sử thay thế hoặc logging service mới.
- Bảo toàn các thay đổi đang có, gồm việc bỏ 8 cột ở lượt trước và thay đổi mobile package/lockfile của người dùng.
- Tài liệu lịch sử và evidence đã ghi nhận được giữ nguyên; cập nhật đặc tả, runbook và bảng traceability đang dùng.
- Chỉ dùng DB tạm để kiểm thử. Triển khai DB thực tế là bước riêng, xác định đúng target và thời điểm dừng tiến trình cũ trước khi chạy.

## 2. Kết quả cần đạt

| Bề mặt | Sau thay đổi |
|---|---|
| Schema mới | 18 bảng; không có `audit_logs`, trigger/function/index riêng cho bảng |
| Backend | Không còn `AuditWriter`, `AuditEvent`, `writeAudit`, audit provider hoặc câu SQL truy cập audit trong runtime |
| HTTP | `/api/v1/operations/audit-logs` không còn đăng ký; trả 404 |
| Web | Không còn menu/tab/panel/query xem nhật ký |
| URL cũ | `/system/console?view=audit` quay về tổng quan, không gọi API audit |
| OpenAPI/types | Không còn endpoint và DTO audit trong cả backend, web, mobile |
| Nghiệp vụ | Thanh toán, cấp/thu hồi license, khôi phục command, onboarding và quản trị tài khoản vẫn hoạt động |
| Log kỹ thuật | Lỗi 5xx, lỗi DB/Redis/worker và lỗi dịch vụ ngoài còn chẩn đoán được; không lưu hành động người dùng thay audit |

## 3. Bước 1 — Gỡ producer và API audit ở backend

**Xóa các owner chuyên biệt:**

- `EmuKey/backend/src/platform/audit/audit-writer.ts`
- `EmuKey/backend/src/modules/operations/application/audit.service.ts`
- `EmuKey/backend/src/modules/operations/infrastructure/audit.repository.ts`
- `EmuKey/backend/src/modules/operations/presentation/audit.controller.ts`
- `EmuKey/backend/src/modules/operations/presentation/audit.dto.ts`

**Sửa wiring và call sites:**

- `platform/platform-core.module.ts`
- `modules/operations/operations.module.ts`
- `modules/identity-access/identity.module.ts`, `identity.repository.ts`, `identity.service.ts`
- `modules/catalog/catalog.module.ts`, `infrastructure/catalog-admin.repository.ts`
- `modules/commerce-payment/commerce.module.ts`, `infrastructure/commerce.repository.ts`
- `modules/licensing/infrastructure/licensing.repository.ts`
- `modules/blockchain/blockchain.module.ts`
- `modules/blockchain/application/blockchain-reconciliation.service.ts`
- `modules/blockchain/application/chain-command.service.ts` nếu tham số actor chỉ được chuyển tiếp cho audit
- `modules/blockchain/infrastructure/chain-command.repository.ts`, `chain-event.repository.ts`

Các đường dẫn rút gọn ở trên đều nằm trong `EmuKey/backend/src/`.

**Interface:** Bỏ endpoint/DTO audit; cập nhật constructor và repository port ở mọi caller khi bỏ tham số audit. Các API nghiệp vụ giữ nguyên quyền và hành vi. Trường request chỉ phục vụ audit cần xử lý cùng DTO/UI/types trong bước 4, không để field bắt buộc nhưng bị bỏ qua.

- [ ] Thêm case 404 cho endpoint đã gỡ trong `tests/emukey/backend/security/http-authorization-negative.test.ts`; bỏ endpoint này khỏi danh sách yêu cầu 401. Giữ nguyên negative matrix của các API khác.

```ts
it('does not expose the removed audit endpoint', async () => {
  const response = await request(app.getHttpServer() as Server)
    .get('/api/v1/operations/audit-logs');
  expect(response.status).toBe(404);
});
```

- [ ] Chạy test trước khi sửa: endpoint hiện tại sẽ trả 401 nên case mới phải fail.
- [ ] Bỏ import, provider, export, constructor parameter và lời gọi audit. Không để no-op writer hoặc catch nuốt lỗi như một giải pháp tạm.
- [ ] Gỡ helper `CatalogAdminRepository.writeAudit` và mọi chỗ gọi.
- [ ] Trong `BlockchainReconciliationService.reconcile`, bỏ block mở connection/transaction chỉ để ghi `BLOCKCHAIN_RECONCILIATION_COMPLETED`. Giữ `pool` vì còn query health; giữ vòng reconcile, projection, expiry và dữ liệu trả về.
- [ ] Rà tham số hết sử dụng: ví dụ `IdentityRepository.updateProfile(id, actorRole, fields)` có thể thành `updateProfile(id, fields)`. Cập nhật port/caller/test cùng lúc; quyền sửa trường vẫn lọc tại `IdentityService`.
- [ ] Rà `bumpSessionVersion` và các hàm truyền tên action/actor chỉ cho audit. Bỏ tham số thừa, giữ thay đổi session và trạng thái tài khoản.
- [ ] Không bỏ `BEGIN/COMMIT/ROLLBACK` của transaction còn chứa nhiều cập nhật nghiệp vụ, lock hoặc read-before-write.
- [ ] Xóa `tests/emukey/backend/unit/audit-api.test.ts`. Sửa test reconciliation để kiểm chứng kết quả reconcile, expiry, quyền truy cập và idle behavior thay vì mock `audit.write`.
- [ ] Trong integration identity/commerce, bỏ assertion audit nhưng giữ/chuyển sang assertion trạng thái, idempotency và bằng chứng thanh toán. Case sandbox clock-drift vẫn phải chứng minh source evidence không đổi và không tạo effect trùng.

## 4. Bước 2 — Schema, migration và công cụ dữ liệu

**Files:**

- Sửa `EmuKey/backend/database/schema.sql`.
- Tạo `EmuKey/backend/database/migrations/20261020-remove-user-audit.sql`.
- Sửa `EmuKey/backend/src/platform/database/verify-baseline-database.ts`.
- Sửa `tooling/emukey/fixtures/seed-demo-data.mjs`.
- Sửa `tooling/emukey/verification/verify-schema-columns.mjs`, `backup-restore.mjs`.
- Sửa `tests/emukey/backend/integration/database/baseline-schema.integration.test.ts`.

**Interface:** Schema/verify/seed thống nhất 18 bảng. Migration mới chạy sau các migration cũ khi nâng cấp DB; schema baseline dùng trực tiếp cho DB mới.

- [ ] Viết test DB không còn bảng audit và verifier trả `tables: 18`.
- [ ] Thêm test migration chạy hai lần, giữ dữ liệu trong các bảng nghiệp vụ. Lưu kết quả SELECT các hàng đại diện trước migration và so sánh sau migration.
- [ ] Dùng fixture DB cũ có `audit_logs`, trigger append-only và function tương ứng để kiểm tra migration thật. Không dùng DB trong `.env`.
- [ ] Bỏ định nghĩa bảng, index `ix_audit_logs_search`, function `reject_audit_logs_mutation` và hai trigger audit khỏi baseline.
- [ ] Migration dự kiến:

```sql
BEGIN;
DROP TABLE IF EXISTS audit_logs;
DROP FUNCTION IF EXISTS reject_audit_logs_mutation();
COMMIT;
```

`DROP TABLE` gỡ index/trigger thuộc chính bảng. Không dùng `CASCADE`: dependency ngoài phạm vi phải khiến migration fail và rollback để xem xét.

- [ ] Bỏ `audit_logs` khỏi `EXPECTED_TABLES`, seed SQL, seed count/expectations và query kiểm tra restore.
- [ ] Đổi các kiểm tra số bảng liên quan từ 19 sang 18; không thay mọi số 19 trên toàn repo.
- [ ] Giữ migration trước `20261020-remove-unused-columns.sql` như lịch sử nâng cấp. Test của migration đó cần chạy trên fixture legacy có bảng audit; bỏ việc chạy migration cũ trực tiếp trên baseline 18 bảng vì câu `ALTER TABLE audit_logs` của migration cũ yêu cầu bảng tồn tại.
- [ ] Xóa test riêng chứng minh audit rollback; giữ các test transaction nghiệp vụ. Cập nhật test seed-twice bỏ kỳ vọng `audit_logs: 30`.
- [ ] Chạy baseline integration và seed hai lần; xác nhận không trùng hàng, không mất dữ liệu nghiệp vụ.

## 5. Bước 3 — Log kỹ thuật tối thiểu

**Owner hiện có:**

- `EmuKey/backend/src/platform/platform-core.module.ts`
- `EmuKey/backend/src/platform/http/api-exception.filter.ts`
- `EmuKey/backend/src/platform/observability/log-redaction.ts`
- `EmuKey/backend/src/platform/database/database-pool.ts`, `database-cli.ts`
- `EmuKey/backend/src/modules/commerce-payment/worker/order-timeout.processor.ts`
- `EmuKey/backend/src/entrypoints/worker/main.ts`
- `docs/emukey/operations/monitoring.md`
- Test hiện có: `tests/emukey/backend/unit/platform/log-redaction.test.ts`, `database-pool.test.ts`.

**Chính sách:**

| Loại | Xử lý |
|---|---|
| HTTP thành công, health polling, lỗi validation/authorization dự kiến | Không tự ghi access log cho từng request |
| HTTP 5xx và exception ngoài dự kiến | Một bản ghi lỗi có mã lỗi, request ID, method/route và ngữ cảnh kỹ thuật an toàn |
| DB/Redis mất kết nối, worker/job fail, dịch vụ ngoài timeout | Giữ error/warn; không ghi payload hoặc credentials |
| Khởi động/dừng dịch vụ; kết quả CLI initialize/seed/verify | Giữ thông tin ngắn phục vụ vận hành |
| Thao tác người dùng thành công | Không chuyển audit đã gỡ sang log |
| Log `orders.auto_cancelled` đếm thao tác thông thường | Bỏ nếu không còn nhu cầu chẩn đoán; trạng thái đơn vẫn lưu trong DB |

- [ ] Dùng `nestjs-pino`/Pino đã cài; kiểm tra API logging bằng README/type definitions đúng phiên bản trước khi đổi cấu hình.
- [ ] Tắt auto access logging thành công ở cấu hình hiện có. Không chỉ đặt toàn hệ thống `LOG_LEVEL=error` vì sẽ che cảnh báo và thông tin khởi động.
- [ ] Bảo đảm exception filter vẫn ghi lỗi 5xx vào logger hiện có: filter hiện tại trả JSON nhưng chưa tự ghi nguyên nhân lỗi. Khi tắt autoLogging, bổ sung log lỗi ở boundary này; không ghi trùng ở cả middleware và filter.
- [ ] Dùng cùng request ID cho log và response lỗi. Chỉ ghi fields được chọn; không ghi toàn bộ request, headers, body, raw vendor response, connection string hoặc secret-bearing error object.
- [ ] Giữ redaction hiện có và kiểm tra log lỗi không làm rò mật khẩu, token, activation key, private key.
- [ ] Thêm test ở `tests/emukey/backend/unit/platform/http-error-logging.test.ts` nếu chưa có owner tương đương sau tìm kiếm: tạo request thật tới test controller với logger capture, kiểm chứng 200/400 không tạo access log, 500 có đúng một error record, request ID khớp response và sentinel secret không xuất hiện.
- [ ] Giữ test pool idle connection error; giữ xử lý retry/failure trong worker. Không bỏ listener lỗi chỉ vì xóa log.
- [ ] Không mở rộng sang xây metric/trace/dashboard mới hoặc gỡ toàn bộ OpenTelemetry trong nhiệm vụ này.

## 6. Bước 4 — Web và API contract

**Files:**

- Xóa `EmuKey/frontend/src/presentation/components/AuditLogPanel.tsx`.
- Sửa `EmuKey/frontend/src/application/operations/operationsQueries.ts`.
- Sửa `EmuKey/frontend/src/presentation/screens/SystemConsoleScreen.tsx`.
- Sửa `EmuKey/frontend/src/presentation/components/RoleShell.tsx`.
- Sửa `tests/emukey/frontend/completed-flows.test.tsx`.
- Sửa `tests/emukey/e2e/web/workspace-navigation.spec.ts`.
- Regenerate `EmuKey/{backend,frontend,mobile}/openapi/openapi.json` và types trong frontend/mobile thông qua script hiện có.

**Interface:** Không còn `AuditEntryDto`, `AuditPageDto`, audit query DTO/endpoint trong contract được generate. Menu quản trị còn tổng quan, người dùng, thanh toán và blockchain.

- [ ] Cập nhật test điều hướng: không có mục Nhật ký, các mục còn lại hoạt động.
- [ ] Thêm case URL cũ `?view=audit` chuyển về `/system/console` bằng replace; không request `/operations/audit-logs`.
- [ ] Bỏ hook `useAuditLogs` và import audit types; giữ health/reconcile hooks trong cùng file.
- [ ] Bỏ panel, tab, nhánh title/render và link audit ở empty state; đổi aria-label “Bộ lọc nhật ký” sang mô tả đúng menu quản trị.
- [ ] Với request field chỉ dùng audit, theo dõi từ DTO → service → repository. Nếu hoàn toàn hết tác dụng, gỡ đồng bộ field, validation và UI gửi field; nếu có ý nghĩa nghiệp vụ thì giữ. Ví dụ lý do dead-letter/payment review phải giữ; không dùng tiêu chí chỉ dựa vào tên `reason`.
- [ ] Chạy generator sau khi backend build:

```powershell
# CWD: EmuKey
node scripts/generate-openapi.mjs
node scripts/generate-openapi.mjs --check
```

- [ ] Không sửa tay generated types. Mobile chỉ cần thay contract/types liên quan; bảo toàn package/lockfile đang có.
- [ ] Chạy frontend test và browser navigation với môi trường test, sau đó typecheck web/mobile.

## 7. Bước 5 — Tài liệu và sơ đồ

**Files/owners:**

- `KLTN.drawio`: các trang DB, class, use case có audit.
- `context/current/chuc_nang_toan_he_thong_ver2.0.md`
- `context/current/APP_IMPLEMENTATION_PLAN.md`
- `context/current/cong_nghe_he_thong.md`
- `context/current/HDSD.md`
- `docs/emukey/runbooks/local-development.md`, `phase-8-release.md`
- `docs/emukey/operations/monitoring.md`
- `docs/emukey/traceability/capabilities-v4.1.json`, `phase-8-traceability.md` nếu có yêu cầu audit hiện hành.

- [ ] Bỏ audit khỏi phạm vi chức năng System Admin/Operations; giữ health, thanh toán, notification và reconcile.
- [ ] Thay yêu cầu “phải có audit” của nghiệp vụ còn lại bằng mô tả đúng bằng chứng/trạng thái hiện lưu, không tuyên bố còn truy vết tổng quát mọi thao tác.
- [ ] Xóa bảng/class audit và cạnh liên quan trong drawio; giữ hình học, ID và quan hệ của các phần còn lại. Kiểm tra XML hợp lệ và không có cạnh trỏ tới node đã xóa.
- [ ] Ghi rõ giới hạn mới: không có màn hình hay lịch sử tổng quát ai đã thao tác gì; vẫn có lịch sử thanh toán/blockchain và các trường người xử lý thuộc nghiệp vụ.
- [ ] Trong runbook, ghi thứ tự triển khai: dừng API/worker phiên bản cũ → chạy migration → chạy phiên bản mới → verify/health. Chỉ redeploy API mà để worker cũ hoạt động sẽ còn truy cập bảng đã bỏ.
- [ ] Ghi rõ migration xóa dữ liệu audit; rollback code đơn thuần không phục hồi được bảng/dữ liệu. Muốn quay lại phiên bản cũ phải khôi phục schema và dữ liệu audit từ bản sao phù hợp.
- [ ] Không sửa evidence trong `context/archive/`, `docs/emukey/archive/` hoặc thư mục release lịch sử để biến kết quả cũ thành kết quả mới.

## 8. Bước 6 — Kiểm chứng và bàn giao

- [ ] Chạy focused test cho bước đang làm trước; sau đó chạy backend suite bằng danh sách file của repo để tránh Vitest lấy test trong `node_modules` nằm ngoài root.

```powershell
# CWD: EmuKey/backend
$env:RUN_PHASE7_INTEGRATION = 'true'
$backendTestFiles = @(rg --files ../../tests/emukey/backend -g '*.test.ts' -g '!**/node_modules/**' |
  ForEach-Object { $_.Replace('\', '/') })
corepack pnpm exec vitest run --config ../../tooling/emukey/verification/vitest.backend.config.ts @backendTestFiles
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

- [ ] Chạy frontend kiểm thử và build:

```powershell
# CWD: EmuKey/frontend
$frontendTestFiles = @(rg --files ../../tests/emukey/frontend -g '*.test.ts' -g '*.test.tsx' -g '!**/node_modules/**' |
  ForEach-Object { $_.Replace('\', '/') })
corepack pnpm exec vitest run --config ../../tooling/emukey/verification/vitest.frontend.config.cjs @frontendTestFiles
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

- [ ] Chạy mobile typecheck và OpenAPI check bằng scripts hiện có.
- [ ] Chạy browser case `workspace-navigation.spec.ts` trên backend/frontend test. Dùng test credentials và DB tạm; không cho Playwright reuse API đang nối DB thật. Đưa report/trace vào OS temp hoặc output ignored hiện có.
- [ ] Kiểm chứng ít nhất: cập nhật hồ sơ; mời/nhận Provider; publish catalog; thanh toán và retry/idempotency; review thanh toán; cấp/thu hồi license; reconcile/dead-letter; notification và support chat.
- [ ] Scan tên audit trong runtime, UI, contract, SQL baseline và tooling: chỉ cho phép xuất hiện ở migration lịch sử, test loại bỏ chức năng hoặc tài liệu giải thích việc gỡ. Không xóa các công cụ dependency audit.
- [ ] Chạy `git diff --check`, workspace hygiene và kiểm tra status. Review toàn bộ diff, bảo toàn thay đổi người dùng.
- [ ] Bàn giao danh sách file, migration, kết quả kiểm tra thực tế và trạng thái DB đích. Không ghi “đã gỡ trên DB thật” nếu mới sửa source và kiểm thử DB tạm.

## 9. Tiêu chí hoàn tất

- Không còn đường thực thi đọc/ghi audit, no-op writer hay UI/API audit bị bỏ dở.
- Khởi tạo schema mới và nâng cấp schema cũ đều đạt 18 bảng.
- Seed/verify/restore không còn yêu cầu audit; migration chạy lại được.
- Các kiểm thử nghiệp vụ vẫn qua khi bảng audit không tồn tại.
- Lỗi kỹ thuật còn đủ thông tin để tìm nguyên nhân và không lộ bí mật.
- Web/mobile contract đồng bộ, UI quản trị không có đường dẫn audit.
- Tài liệu và sơ đồ phản ánh đúng phạm vi mới.

**Thứ tự thực hiện:** backend → SQL/migration/tooling → log tối thiểu → web/contract → tài liệu/sơ đồ → kiểm chứng. Các bước tạo thành một thay đổi đồng bộ; không triển khai riêng bước xóa bảng khi code cũ còn hoạt động.
