# EmuKey — execution results, 17/11/2026

Baseline `562bbc6`; Windows, Node 22.21.0, pnpm 11.25.0, Docker Desktop/Linux containers. Commands dưới đây chạy từ workspace root, trừ khi ghi cwd khác. `T` là `C:/Users/thong/AppData/Local/Temp/`. Exit code là của chương trình native, không suy từ PowerShell `NativeCommandError` khi công cụ ghi stderr. Không in credential hoặc database URL thật trong báo cáo.

## Các suite và boundary

| Nhóm / command thực tế | Exit | PASS / FAIL / SKIP | Môi trường và evidence dưới T |
|---|---:|---|---|
| `node tooling/emukey/run.mjs baseline` | 0 | 34 capabilities, 24 bảng, unique owners hợp lệ | Static source/traceability; `emukey-baseline-verified.log` |
| `node tooling/emukey/run.mjs backend:unit` | 0 | 534 / 0 / 0, 47 files | Unit, adapters mocked; `emukey-unit-verified.log` |
| `node tooling/emukey/run.mjs backend:contract` | 0 | 23 / 0 / 0, 3 files | HTTP contracts, controlled dependencies; `emukey-contract-current.log`; lượt cuối ghi riêng phía dưới |
| `node tooling/emukey/run.mjs backend:security` | 0 | 35 / 0 / 0, 4 files | SQL/HTTP isolation và untrusted-input assertions; `emukey-security-final.log`; lượt cuối ghi riêng phía dưới |
| `node tooling/emukey/run.mjs backend:integration`, lượt trước thêm migration test | 0 | 145 / 0 / 55, 200 cases | Disposable PostgreSQL/pgvector + Redis, controlled vendor/chain; `emukey-integration-final-verified.log` |
| Cùng command, sau thêm migration test | 1 | 145 / 1 / 55, 201 cases | Provider restart chờ trạng thái DELIVERED thất bại; `emukey-integration-final-all.log` |
| Cùng command, sau tách provider subprocess | 1 | 145 / 1 / 55, 201 cases | Provider child API chưa báo ready trong 30 s; `emukey-integration-verified-all.log`. Không coi đây là full PASS |
| Cùng command, lượt full cuối khi không còn native build/browser tranh tài nguyên | 0 | **146 / 0 / 55**, 201 cases, 12 files passed / 5 skipped | `emukey-integration-final-serial.log`, 313.55 s; gồm migration, provider/support crash recovery và toàn bộ các integration opt-in mặc định |
| cwd `EmuKey/backend`: `node node_modules/vitest/vitest.mjs run --config ../../tooling/emukey/verification/vitest.backend.config.ts provider-delivery.integration --maxWorkers=1` | 0 | 3 / 0 / 0 | HTTP receiver + database riêng, paid-order/chain events fixtures, lost response, SIGKILL/restart, Redis restart và key invariants; `emukey-provider-isolated.log` |
| `node tooling/emukey/run.mjs frontend:unit` | 0 | 309 / 0 / 0, 23 files | jsdom, HTTP mocked; full serial run 745.76 s; `emukey-frontend-serial-final.log` |
| `node tooling/emukey/run.mjs frontend:e2e buyer-ui-recovery payment-status-flow workspace-navigation` | 0 | 65 / 0 / 0 | Chromium, frontend thật, business API responses mocked; 3 workers, 6.2 min; `emukey-browser-verified.log` |
| `node tooling/emukey/verification/run-support-chat.mjs` | 0 | 2 / 0 / 0 | REAL_LOCAL_SERVICE: real frontend/API/auth + disposable DB/Redis, AI generation controlled; `emukey-support-real.log`, `emukey-support-chat-tfRaIy/` |
| `node tooling/emukey/run.mjs mobile:unit` | 0 | 43 / 0 / 0, 5 suites | Jest/React Native controlled native adapters; `emukey-mobile-decoder-verified.log` |
| `node tooling/emukey/run.mjs contracts` | 0 | 7 / 0 / 0 | Local Hardhat/Solidity, không gửi transaction external; `emukey-solidity-stable.log` |
| cwd `EmuKey/license-client-demo`: `./gradlew.bat :app:testDebugUnitTest :app:lintDebug :app:assembleDebug -PemukeyTestSources=D:/TLHT/KLTN/UY/tests/emukey/license-client-demo --console=plain` | 0 | 3 unit / 0 / 0; lint + APK build PASS | Android SDK local; XML `TEST-vn.emukey.licensedemo.DeviceProofTest.xml`, log `emukey-kotlin-final.log` |
| Temp mobile snapshot: `corepack pnpm exec expo prebuild --platform android --no-install`; cwd `android`: `./gradlew.bat :app:assembleDebug --console=plain --no-daemon --max-workers=2 -PreactNativeArchitectures=x86_64 -Pkotlin.incremental=false` | 0 | Prebuild/build PASS; native UI NOT_RUN | `emukey-native-prebuild.log`, `emukey-expo-native-limited.log`; debug APK ở `emukey-native-audit/android/app/build/outputs/apk/debug/app-debug.apk`. Final patched JS được kiểm tra bằng export riêng |
| `node tooling/emukey/verification/backup-restore.mjs --disposable`, DATABASE_URL của fixture riêng, RESTORE_HOST_PORT=0, restore image pgvector/pgvector:pg15 | 0 | RESTORE_VERIFIED, durable counts `1\|0\|0\|0\|0` | Source/target đều disposable; reconcile NOT_REQUESTED; `emukey-backup-verified.log`, `emukey-backup-audit-1OuqZG/` |
| `node tooling/emukey/run.mjs verify:security-scan` | 0 | PASS, 357 files | Static surface/secret filename checks, không scan nội dung `.env` local; `emukey-security-scan-verified.log` |
| `docker build --progress plain -t emukey-audit-backend:20261117 EmuKey/backend` | 0 | Image build PASS | Linux build gồm frozen install, contracts build/ABI export, TypeScript; `emukey-backend-docker.log` |
| `docker build --progress plain -t emukey-audit-frontend:20261117 EmuKey/frontend` | 0 | Image build PASS | Frozen install + Vite/Caddy image; `emukey-frontend-docker.log`; có chunk-size warning, không che warning bằng đổi threshold |
| `docker build --progress plain -t emukey-audit-mobile:20261117 EmuKey/mobile` | 0 | Image build PASS sau COPY patch | Frozen install + typecheck + Android export trong Linux; `emukey-mobile-docker-verified.log` |
| Backend runtime exclusion probe; mobile runtime decoder + `.env` exclusion probe | 0 | PASS | Containers `--rm`, entrypoint sh/node, không khởi động API/worker hoặc Metro server. Backend không có `.env`, maintenance drop SQL hay thư mục contracts; mobile query-string parse hoạt động |
| `docker compose --project-directory EmuKey config --quiet` | 0 | Structural validation PASS | Không print cấu hình nội suy/secret; không chạy compose up/down hoặc deploy |

55 integration skips gồm các suite external opt-in và subprocess fixtures không được gọi như test độc lập. Chúng không phải 55 ca đã được nghiệm thu. Provider/support parent tests gọi child qua tiến trình riêng; tránh cộng child fixture vào tổng acceptance lần nữa.

## Quality gates và dependency security

Mỗi component đã chạy `corepack pnpm --dir EmuKey/<component> install --frozen-lockfile`, `lint`, `typecheck`, `build`, `openapi:check`. Các bước đều exit 0 ở lượt kiểm tra thành công được liệt kê dưới đây; lỗi backend lint trong lượt tổng hợp đầu không bị che.

| Component | Kết quả / evidence |
|---|---|
| Backend | Frozen install/OpenAPI exit 0: `emukey-final-backend-{install,openapi-check}.log`. Lint đầu exit 1 do no-base-to-string; đã sửa, lint/typecheck/build mới chạy lại ở `emukey-{lint,typecheck,build}-verified.log` |
| Frontend | Tất cả exit 0: `emukey-final-frontend-{install,lint,typecheck,build,openapi-check}.log` |
| Mobile | Sau decoder patch: frozen install, audit, lint, typecheck và Android export exit 0: `emukey-mobile-patched-{frozen,audit,typecheck,lint,build}.*`. OpenAPI exit 0: `emukey-final-mobile-openapi-check.log` |
| Expo SDK | `corepack pnpm --dir EmuKey/mobile exec expo install --check`, EXPO_NO_CACHE=1: exit 0, `emukey-final-expo-check.log` |

`corepack pnpm --dir EmuKey/<component> audit --prod --audit-level high` đã chạy cho cả ba component. Backend: high 0, critical 0, moderate 3 (`emukey-dependencies-optional.log`). Frontend: 0 advisories (`emukey-frontend-dependencies.json`). Mobile sau patch: high 0, critical 0; moderate/low còn lại được giữ trong `emukey-mobile-patched-audit.json` (trước patch: 6 moderate, 1 low). Không dùng `--ignore` để bỏ qua high/critical hoặc tắt strict peer validation.

Hai workflow CI đã thêm runtime audit gate. YAML parse và local gate không phải bằng chứng remote CI. GitHub CLI chưa authenticated; working tree không commit/push theo yêu cầu, nên **REMOTE_CI_UNVERIFIED**.

Ba image dùng tag audit riêng `emukey-audit-{backend,frontend,mobile}:20261117`, không thay tag/container đang vận hành. Runtime probes chỉ kiểm tra filesystem và decoder; không phải qualification một deployment production. Docker build/runtime results được giữ trong `emukey-docker-results.json` dưới T.

## Provider AI thật và database đang cấu hình

Các opt-in sau chạy từ `EmuKey/backend`, dùng credential được cấp trong `.env` qua `node --env-file-if-exists=.env`; không log secret. Common prefix: `node --env-file-if-exists=.env node_modules/vitest/vitest.mjs run --config ../../tooling/emukey/verification/vitest.backend.config.ts`, suffix `--maxWorkers=1`.

| Lượt / file filter | Exit | PASS / FAIL / SKIP | Boundary / evidence |
|---|---:|---|---|
| Gemini model readiness GET | 0 | HTTP 200 | REAL_EXTERNAL metadata, không chứng minh generation availability; `emukey-gemini-readiness.log` |
| Live embedding/vector focused case | 0 | 1 / 0 / 10 filtered | REAL_EXTERNAL Gemini embedding → disposable pgvector, 768 dimensions, assertion VECTOR; `emukey-gemini-vector-live.log` |
| EMUKEY_TEST_REAL_AI=1, `ai-provider.integration` | 0 | 3 / 0 / 0 | Real generation, controlled grounding sources: citation, refusal, injection; `emukey-gemini-grounding-live.log` |
| EMUKEY_TEST_REAL_AI=1, `ai-understanding-provider.integration`, trước remediation F24 | 1 | 34 / 4 / 0 | 1 AbortError, 3 intent mismatches; `emukey-gemini-understanding-live.log` |
| Cùng suite, sau intent normalization | 1 | 37 / 1 / 0 | LATEST bị model trả ORDINAL index 1; `emukey-gemini-understanding-remediated.log` |
| Cùng full suite, sau prompt clarification lần đầu | 1 | 35 / 3 / 0 | LATEST→ALL, clinical paraphrase PRODUCT_QA/reference chưa đúng, 1 catalog-selection AbortError; `emukey-gemini-understanding-verified.log` |
| Cùng file, thêm `--testNamePattern=resolves conversational references\|doctor-scheduling`, sau prompt cuối | 1 | 5 / 1 / 32 filtered | LATEST→ORDINAL index 0 vẫn sai; `emukey-gemini-reference-focused.log`. **F24 PARTIAL**, không gộp với full suite |
| EMUKEY_TEST_REAL_CATALOG=1, `ai-semantic-catalog.integration`, lượt đầu | 1 | 6 / 1 / 0 | Current public catalog read-only + real provider; 1 PROVIDER_UNAVAILABLE; `emukey-gemini-catalog-live.log` |
| Cùng suite, lượt sau | 1 | 5 / 2 / 0 | 2 PROVIDER_UNAVAILABLE; `emukey-gemini-catalog-verified.log` |

Một invocation thiếu `EMUKEY_TEST_REAL_CATALOG=1` chỉ SKIP 7 ca (`emukey-gemini-catalog-remediated.log`); không được tính như live evaluation. Các HTTP 503/timeout vẫn có thể xuất hiện trong lượt PASS nếu retry thành công. Không gộp các lượt khác nhau thành một tỷ lệ accuracy hoặc lấy kết quả tốt nhất che lượt FAIL.

Configured database: `corepack pnpm --dir EmuKey/backend db:verify` đọc-only exit 1, 25 bảng với extra `schema_versions`; các critical mismatch lists trống (`emukey-configured-database-verify.log`). `db:migrate` **không chạy/apply trên database này**. Test migration nằm trong existing `baseline-schema.integration.test.ts`, dùng database disposable để xác nhận rehearsal rollback, reject unknown drift, archive giữ rows/OID, no-op và recovery.

Reader kiểm tra trực tiếp trên connection inference với transaction READ ONLY + SET LOCAL ROLE: `emukey-configured-reader-permissions.log`, `emukey-live-reader-readiness.log`. Role không mutation grants trên 25 bảng; current views có 33 published plans, 33 current embeddings, 46 public chunks. Không sửa catalog/index có sẵn để làm evaluation xanh.

Sepolia `eth_chainId`, head/code/block timestamp chỉ read-only: `emukey-sepolia-readonly.log`, chain 11155111, head 12153608, transactionsSent=0. Không chạy script qualification có thể deploy/gửi giao dịch hoặc ghi đè historical report.

## Lượt thất bại và regression giữ lại

- Unknown devices/public metadata/chain states, Help URL history, Terms approval/hash/version và proxy trust có RED trước fix. AI reference normalization RED: 4 fail / 75 pass; suite unit cuối 534 pass.
- Frontend full ban đầu: 278 pass / 30 fail trong lúc source/tests đang thay đổi; không gọi đây là immutable baseline. Các lượt sau 305/3 và 307/2; lượt serial cuối 309/0. Các log giữ nguyên trong T.
- Browser trước sửa locator: 42 pass / 7 fail. Lượt sau 63 pass / 2 fail; focused provider 4 pass. Lượt full cuối 65 pass, không cộng focused rerun thành full PASS.
- Mobile trước security patch: 42 pass. Override decoder ESM làm 3 suite không load được, 13 tests chạy pass; lỗi `Unexpected token export`/`decodeComponent is not a function` đã được tái hiện. Patch CommonJS chỉ đổi hai dòng export/package type; suite cuối 43 pass, bao gồm Unicode/malformed/long URI regression.
- Mobile Dockerfile trước khi copy patch: `docker build --progress plain -t emukey-audit-mobile:20261117 EmuKey/mobile` exit 1, frozen install báo ENOENT `/app/patches/decode-uri-component@0.5.1.patch`; log `emukey-mobile-docker-red.log`. Đã thêm COPY patch trước install; kết quả build/runtime cuối được ghi phía dưới.
- Native build đầu dùng quá nhiều compiler processes trên máy chia sẻ; dừng đúng cây tiến trình build thuộc temp snapshot và chạy lại max-workers=2/x86_64. Không dừng Java/container của người dùng.
- Metro startup bị automatic approval review từ chối `blocked by policy`, không có lý do chi tiết. Native E2E **BLOCKED_APPROVAL / NOT_RUN**; không lách bằng một lệnh tương đương.
- Caddy Windows forwarding, thiếu pgvector, notification timeout trước khi nhận request, support worker cold-start và TCP restore readiness có log fail trước remediation. Không thay business assertion bằng skip.

## Các file mới có owner rõ ràng

- `EmuKey/backend/src/entrypoints/database/migrate.ts`: CLI duy nhất cho scoped legacy-ledger transition; schema.sql vẫn là schema authority duy nhất.
- `EmuKey/mobile/patches/decode-uri-component@0.5.1.patch`: pnpm patch export compatibility; source/runtime tự chứa trong EmuKey.
- `tests/emukey/backend/integration/assistance/support-lease-worker.fixture.test.ts`: subprocess fixture được chuyển từ parent suite, không thêm bản sao business worker.
- `tests/emukey/backend/integration/licensing/provider-handoff-runtime.fixture.ts`: wiring dùng chung cho đúng hai callers parent/child; không tạo shared production service mới.
- `tests/emukey/backend/integration/licensing/provider-handoff-worker.fixture.test.ts`: real API/worker subprocess fixture tách khỏi suite lớn.
- `docs/emukey/plans/2026-11-17-system-audit.md` và ba audit documents: plan, inventory, findings, execution evidence.

Các owner chính được mở rộng: buyerHome selector/screens, OrderSummary/PurchaseFlowModal, public Help/Home/Verification, environment/API bootstrap/ServiceTermsContent/GeminiAiGateway, mobile generated OpenAPI, existing integration/unit/browser tests, existing backup runner và hai CI workflows. Không tạo database connection/auth/API client/query-key system song song.

## Final verification record

Full integration cuối exit 0: 146 pass, 55 skipped, 201 total. Contract mới exit 0: 23/23 (`emukey-contract-verified.log`). Security mới exit 0: 35/35 (`emukey-security-verified.log`). Backend lint/typecheck/build exit 0 sau sửa lỗi stringification (`emukey-{lint,typecheck,build}-verified.log`). Sau prompt cuối, focused Gemini gateway unit 79/79, exit 0 (`emukey-ai-final-unit.log`); không gọi focused này là lượt full 534 mới. Hai CI workflow YAML parse thành công bằng `yaml.safe_load`; không chạy remote Actions.

`git diff --check` exit 0 sau bỏ hai blank lines cuối file fixture; không có diff trên `backend/database/schema.sql`. Workspace guard exit 0 (`emukey-workspace-guard.log`). Review diff thực hiện inline, không có independent-agent review; không merge/commit/push. Full final file list và SHA-256 của raw logs ở `T/emukey-audit-evidence-manifest.json`. Browser runner mặc định dùng thư mục evidence ignored hiện có; bản copy lượt cuối ở `T/emukey-audit-browser-verified/`. Các lượt FAIL phía trên vẫn là bằng chứng còn hiệu lực về giới hạn của test/runtime/provider ở điều kiện tương ứng.
