# EmuKey — execution results, 17/11/2026

## Authorized operational follow-up — 18/11/2026

User authorization now includes the remaining technical operations, except Gemini live. Production Terms and retention await the user's actual content/durations. Historical approval blockers below do not describe the current authorization.

**Corrected email recipient follow-up, 18/11/2026 16:15 Asia/Saigon:** user supplied a replacement recipient after the earlier NoSuchUser bounce. One Brevo-only smoke email was sent with the existing product adapter; other providers, including Gemini, were disabled. Send exit 0; message-specific event report HTTP 200 now records **delivered at 16:13:58 +07:00** for `<202611180913.60733112005@smtp-relay.mailin.fr>`. The user subsequently confirmed receipt in the Inbox (recorded 16:18 Asia/Saigon). Brevo smoke email delivery is REAL_EXTERNAL_VERIFIED; this does not qualify full registration, password-reset or every notification workflow. Evidence: [corrected-recipient run](../traceability/releases/emukey-ext-20261118091346-c59515d6/external-provider-evidence.json), `%TEMP%/emukey-email-corrected-send.log`, `%TEMP%/emukey-email-corrected-events.json`. Recipient was process-scoped; no stored configuration, business account or source code changed. Previous bounce evidence is retained.

**Final code snapshot 241f8db: REMOTE_CI_PASS**, [Actions run 44251790917](https://github.com/crchinhle/MCP_API/actions/runs/44251790917), both `test` and `license-client` jobs SUCCESS. This single clean Linux checkout includes all payment/RPC/chat/dependency follow-ups: backend **544 unit, 23 contract, 35 security, 152 integration passed/62 skipped**; frontend **318**, mobile **56**, Node parser/audit regressions **10**, Solidity **7**, browser **65**. Frozen installs, Expo compatibility, dependency gates, lint/typecheck/build/OpenAPI and Android job all succeeded in that run. Raw complete remote log: `%TEMP%/emukey-fullauth-ci-241f8db.log`. The later handoff changes only the four existing audit/plan documents; do not confuse documentation CI with a new product revision. External/native/operational limitations below remain unresolved.

Fresh database evidence in `%TEMP%`:

| Check | Result | Evidence |
|---|---|---|
| Actual configured database backup and disposable restore, PostgreSQL 18.7 | Exit 0, RESTORE_VERIFIED | `emukey-fullauth-backup-pg187.log`; durable backup `%LOCALAPPDATA%/EmuKey/backups/authorized-before-ledger-20261118-pg187/` |
| Migration on that restored backup: rehearsal, apply, repeat, reversal, reapply | Exit 0, RESTORED_MIGRATION_VERIFIED | `emukey-fullauth-restored-migration.{log,json}` |
| Configured database existing compiled migration with --apply | Exit 0, LEGACY_METADATA_ARCHIVED | `emukey-fullauth-db-apply.log` |
| Configured database verification | Exit 0, matchesBaseline=true, 24 tables, no drift | `emukey-fullauth-db-verify.log` |
| All business row counts and archived ledger OID/content compared before/after | Exit 0, CONFIGURED_DATABASE_VERIFIED | `emukey-fullauth-db-before.json`, `emukey-fullauth-db-after.json`; OID 24682, one ledger row, identical digest |
| Repeat configured migration --apply | Exit 0, ALREADY_CURRENT | `emukey-fullauth-db-idempotent.log` |

The initial restore with cached PostgreSQL 18.6 failed; retain `emukey-fullauth-backup.log` as failure evidence. Updating both image tags to their 18.7 image and repeating the unmodified dump/restore resolved the version mismatch. No business rows or canonical schema file were changed.

Fresh backend verification: unit **542/542**, contract **23/23**, security **35/35**, integration **150 passed/62 skipped**, Solidity **7/7**, baseline and security scan exit 0. Logs: `emukey-fullauth-backend-{unit,contract,security,integration}.log`, `emukey-fullauth-contracts.log`, `emukey-fullauth-{baseline,verify-security-scan}.log`. Backend/frontend lint, typecheck, build, OpenAPI checks exit 0 (`emukey-fullauth-{backend,frontend}-*.log`); later chat review changes require their own follow-up results. Kotlin unit/lint/debug APK build exit 0: `emukey-fullauth-kotlin.log`.

Native preparation: task-owned emulator booted, existing debug APK installed, real disposable API fixture ready (`emukey-fullauth-native-fixture.log`); built-in parser verification exit 0 (`emukey-fullauth-mobile-bootstrap.log`). **UI NOT_RUN**: automatic approval review rejected Metro startup as `blocked by policy`, without a detailed reason. Task emulator and fixture then stopped. Existing local API readiness 503 was independently traced to stopped project Redis; automatic approval review also rejected `docker start emukey-backend-redis-1` with the same reason. No equivalent workaround or volume change was attempted. User authorization is present; these are automatic execution blocks.

Post-review evidence: web promise/cache race RED 1 failed/3 passed (`emukey-fullauth-history-race-red.log`); final contract 5/5 (`emukey-fullauth-history-race-final.log`), combined affected/regression checks 8 passed/41 filtered (`emukey-fullauth-frontend-current-regressions.log`). Mobile full 56/56 (`emukey-fullauth-mobile-unit-final.log`), Node security verifier/audit tests 10/10 (`emukey-fullauth-mobile-security-node.log`), mobile live audit PASS_WITH_LOCAL_MITIGATION (`emukey-fullauth-mobile-audit-final.log`, 200 exact finding paths). Frontend/mobile final lint/typecheck exit 0. Backend/frontend raw production-high audit exit 0. Support browser final output 5/5 (`emukey-fullauth-support-browser-final.log`, evidence `emukey-support-chat-D55DJw/`). One earlier browser wrapper returned exit 1 despite 5/5 test output; do not conceal that wrapper result. No tests were skipped to hide a failure.

First full frontend run overlapped source edits and several resource-intensive checks: 313 passed/5 failed. Two failures used the pre-fix imported chat hook; two unrelated cases timed out at 30 seconds and a subsequent detail assertion failed. All three non-chat cases passed isolated (3 passed/41 filtered), then the combined current regression run passed 8/8. Full immutable-source rerun is recorded separately when complete; focused results are not a full PASS claim.

External probes: `emukey-fullauth-external-probes.log` gives Cloudinary real upload/read/delete PASS, FCM authentication PASS with device receipt unverified, SePay sandbox checkout redirect 302 with callback BLOCKED_EXTERNAL. Brevo 401 first (`emukey-fullauth-brevo.log`), user-authorized IP then provider accepted (`emukey-fullauth-brevo-authorized.log`); GET message-specific events confirms hard bounce / Gmail NoSuchUser (`emukey-fullauth-brevo-events.json`). Inbox delivery is NOT verified. No Gemini live calls in this operational continuation.

Full frontend rerun on final chat source: **318/318, exit 0**, `emukey-fullauth-frontend-unit-final.log`; earlier failures remain above as distinct runs. Final real-service support-browser wrapper also **exit 0, 5/5**. Remote [Actions run 44247712214](https://github.com/crchinhle/MCP_API/actions/runs/44247712214) at **a597f84**: both jobs SUCCESS. Raw remote log `emukey-fullauth-ci-a597f84.log`: backend 542 unit, 23 contract, 35 security, 150 integration/62 skipped; frontend 318, mobile 56, contracts 7, browser 65; Kotlin job success. This does not certify later changes automatically.

Later RPC transport fix: real read-only probes reproduced primary Alchemy log-range limit masked by fallback's pruned history. Regression RED (`emukey-fullauth-rpc-fallback-red.log`): 1 fail/543 pass; focused GREEN 12/12 (`emukey-fullauth-rpc-fallback-green.log`), full backend **544/544 exit 0** (`emukey-fullauth-backend-unit-rpc-final.log`). Lint/typecheck/build exit 0 (`emukey-fullauth-backend-rpc-*.log`); focused chain database integration **21 passed/2 skipped**, exit 0 (`emukey-fullauth-blockchain-integration-final.log`). Read-only actual RPC errors before/after kept in `emukey-fullauth-indexer-readonly{,-fixed}.log` with URLs redacted.

Final legacy Sepolia qualification **exit 0, REAL_EXTERNAL_VERIFIED**, `emukey-fullauth-sepolia-acceptance.log`; versioned result [sepolia-lifecycle-evidence.json](../traceability/sepolia-lifecycle-evidence.json). Real chain issue + device-count sync receipts confirmed; real API activation and entitlement, ownership isolation, delivery retry/ack and PostgreSQL projection asserted. Protocol 2, disposable DB/Redis, payment fixture explicitly labeled. Failed predecessors remain in `emukey-fullauth-sepolia{,-legacy,-final,-diagnostic,-verified,-complete}.log`: mismatched latest artifact, newer handoff dependency, pruned fallback, stale key delivery argument and expected HTTP status. No claim that these failed attempts passed; their submitted testnet transactions are retained in logs.

Fresh mobile Docker image build **exit 0**, `emukey-fullauth-mobile-docker.log`; Linux frozen install/bootstrap/typecheck/export/audit included. Tag `emukey-acceptance-mobile:20261118`, manifest list `sha256:054dd9ca860c2020abcb96d2f9fd7817e4260521c86c9060fd8f504dbfae98b9`. No native runtime qualification implied.

Remote CI **1613ead FAIL**, [run 44250505148](https://github.com/crchinhle/MCP_API/actions/runs/44250505148): Android SUCCESS; integration 149 pass/1 fail/62 skipped. Exact failure: delayed-payment fixture hit sub-millisecond checkout boundary; JS preflight differed from unchanged PostgreSQL fulfillment trigger. Raw `emukey-fullauth-ci-1613ead-failed.log`. New precision regression (after fixing its SQL parameter cast) RED 2/2, `emukey-fullauth-payment-precision-red.log`; post-fix full commerce **18/18 exit 0**, `emukey-fullauth-payment-precision-green.log`; backend unit **544/544**, `emukey-fullauth-backend-unit-payment-final.log`; lint/typecheck/build exit 0, `emukey-fullauth-backend-payment-*.log`. No gate/assertion removed. Full integration rerun and new CI result must be assessed separately.

Backend/frontend Docker builds of snapshot 1613ead **exit 0**, `emukey-fullauth-{backend,frontend}-docker.log`. Backend image predates the precision follow-up and is not evidence for that later source.

Payment follow-up snapshot **241f8db**: full backend integration **152 passed/0 failed/62 skipped, exit 0**, 12 files passed/5 files skipped, `emukey-fullauth-backend-integration-payment-final.log`. Conditional child-worker fixture files and opt-in external-AI cases account for skipped files; real embedding tests also remain opt-in. No Gemini live calls were made. Rebuilt backend Docker image **exit 0**, `emukey-fullauth-backend-docker-final.log`, manifest list `sha256:6ec538bb2054916e85fc25dc48568b555507f9db9b6451e9b31af6fd376a39db`. Handoff security scan **PASS, exit 0**, 362 product files, local environment excluded (`emukey-fullauth-security-scan-handoff.log`). Canonical SQL schema unchanged. Current 34-capability matrix has 34 unique IDs and all referenced test owners exist; PARTIAL describes boundary coverage, not an independent defect count.

## Residual remediation verified — 18/11/2026

Snapshot này supersede dependency/Gemini status trong các snapshot lịch sử phía dưới. Không đổi schema/database hiện hữu, auth/business flow hoặc external billing. New test owner `tests/emukey/mobile/unit/fingerprint-toolchain.test.ts` được mobile Jest runner gọi; các production edits mới chỉ ở hai workspace override files và lockfiles.

| Check | Result | Evidence trong OS TEMP |
|---|---|---|
| Production audit trước sửa | Backend 2 moderate; mobile 1 moderate + 1 high mới | `emukey-residual-backend-audit.json`, `emukey-residual-mobile-audit.json` |
| Minimatch RED | 1 fail / 2 pass; 256 nhánh vượt giới hạn 64 | `emukey-residual-fingerprint-red-bounded.log` |
| Backend unit sau sửa dependency | **542 pass / 0 fail / 0 skip**, 47 files, 16.55s; actual loopback metadata caller included | `emukey-residual-backend-unit.log` |
| Backend security | **35 pass / 0 fail / 0 skip**, 4 files, 19.04s | `emukey-residual-backend-security.log` |
| Mobile unit sau sửa dependency | **50 pass / 0 fail / 0 skip**, 6 suites, final 13.484s; explicit tool cwd để chạy được cả từ IDE | `emukey-residual-mobile-unit-final.log`; lượt trước `emukey-residual-mobile-unit.log` 24.305s |
| Backend security | **35 pass / 0 fail / 0 skip**, 4 files, 19.04s | `emukey-residual-backend-security.log` |
| Backend production audit sau sửa | **0 advisory**, exit 0 | `emukey-residual-backend-audit-after.json` |
| Mobile production audit sau sửa | **0 moderate / 1 high**, exit 1; picomatch chưa có patched version | `emukey-residual-mobile-audit-after.json` |
| Frozen install, lint, typecheck, build | Exit 0 cho backend và mobile | `emukey-residual-{backend,mobile}-{install,lint,typecheck,build}-final.log` |
| Expo compatibility | Dependencies up to date, exit 0 | `emukey-residual-expo-check.log` |
| Actual Expo fingerprint generation | Android, exit 0; output chỉ lưu TEMP | `emukey-residual-fingerprint-cli.log` |
| Picomatch isolated probe | `+(*a)` trên 37 ký tự timeout/kill 1500ms, không gây treo process kiểm thử chính | `emukey-residual-picomatch-probe.json` |
| Gemini live pilot | 1 pass / 211 filtered-or-skipped, không coi các skip là acceptance | `emukey-residual-ai-pilot.log` |
| Gemini bounded follow-up | **2 pass / 2 fail / 208 filtered-or-skipped**; fail 429 free-tier day quota, dừng mở thêm run | `emukey-residual-ai-bounded.log` |

Không gọi mobile security gate PASS: cả workspace và standalone CI vẫn có `audit --prod --audit-level high`, picomatch làm gate này fail; không ignore advisory hoặc giảm severity threshold. Frontend/full integration/browser/native APK không được chạy lại trong snapshot dependency này. Build/export và controlled metadata không chứng minh native UI hoặc GCP live acceptance.

Final provenance: sáu dependency/test owners và SHA-256 của raw logs nằm ở `T/emukey-residual-evidence.json`. `workspace_guard.py check` và `git diff --check` exit 0. Một file test mới hợp lệ có owner rõ ràng; không có screenshot/dump/log mới trong source. Inline review đã đối chiếu lockfile scope, matcher breaking changes và HTTP consumer; không có independent reviewer. Schema và configured database không bị sửa.

Giữ lượt fingerprint test đầu (`emukey-residual-fingerprint-red.log`): assertion ban đầu về matching của chuỗi `**/../` không chứng minh vulnerability. Đã thay bằng reproducer theo upstream preprocessing-limit test, RED 256>64 trước upgrade. Không dùng lượt đầu làm bằng chứng security. Gemini pilot qua không thay thế bounded failures hoặc chứng minh dịch vụ ổn định. Source mới/test mới được review inline; không có independent reviewer.

## Continuation verified — 18/11/2026

Scope: hai component frontend (`ConversationPanel`, `AiAssistantLauncher`), existing frontend/browser tests và bốn báo cáo/kế hoạch hiện có. HEAD vẫn `4af3fb3`; không commit/push, không đổi configured database/schema/dependencies. Giữ 51 thay đổi đầu lượt, thêm sửa một test owner đã tracked; working diff tổng 52 file. Không chạy lại full backend/mobile/311-case frontend/70-case browser suite trong lượt scoped này; các kết quả đó bên dưới thuộc snapshot 17/11.

| Check | Result | Evidence trong OS TEMP |
|---|---|---|
| Ba regression lifecycle/concurrency trước sửa | 3 fail đúng nguyên nhân | `emukey-continuation-red.log` |
| Ba regression sau sửa | 3 pass, 48 filtered | `emukey-continuation-green.log` |
| Lost AI creation response trước sửa | 1 fail: thiếu clientRequestId | `emukey-continuation-creation-red.log` |
| Full assistant chat unit | 32 pass / 0 fail | `emukey-continuation-ai-final.log` |
| Ba suite frontend liên quan, chạy riêng sau các tác vụ nặng | **56 pass / 0 fail / 0 skip**, 180.09s; buyer-hub, ai-assistant-chat, assistance-contract | `emukey-continuation-sequential.log` |
| Real local support browser | **5 pass / 0 fail / 0 skip**, 1.8m; actual HTTP/auth/PostgreSQL/Redis, AI adapter controlled | `emukey-continuation-support-final.log`; `emukey-support-chat-bcRPuA/` |
| Frontend lint/typecheck/build | Native exit 0 cho cả ba | `emukey-continuation-lint.log`, `emukey-continuation-typecheck.log`, `emukey-continuation-build.log` |

Source fingerprint sáu owners được kiểm tra không drift trong lượt cuối: `emukey-continuation-source.json`; evidence SHA-256 manifest `emukey-continuation-evidence.json`. Inline review đã kiểm tra lifecycle, synchronous lock, account-scoped storage và existing server idempotency contract; không có independent reviewer. Workspace guard và diff whitespace check exit 0, không có untracked source mới.

> Historical baseline `562bbc6` results are retained below. Current follow-up evidence for baseline `4af3fb3` is recorded in the acceptance section immediately below; historical counts are not aggregated into a final-tree PASS.

## Continuation — 18/11/2026

HEAD vẫn `4af3fb3`. Giữ 51 file đã thay đổi đầu lượt; bổ sung test trong tracked owner `buyer-hub.test.tsx`, tổng 52 modified tracked owners, không thêm source file. Production delta mới chỉ gồm `ConversationPanel.tsx` và `AiAssistantLauncher.tsx`: chặn stale completion xóa draft/storage, khóa guest transfer chung với send/new-chat, bỏ qua transfer completion sau account unmount, truyền request UUID khi tạo hội thoại AI. Không đổi schema/backend/dependency và không chạy lại live Gemini hay mutation trên database cấu hình.

`T` là OS TEMP. Kết quả cũ dưới đây thuộc snapshot ngày 17/11; không coi fingerprint cũ là fingerprint source mới. Hash của hai component và bốn test owners liên quan nằm tại `T/emukey-continuation-source.json`.

| Kiểm tra | Kết quả | Evidence dưới T |
|---|---|---|
| Regression RED: draft sau unmount, transfer cạnh tranh, transfer sau account unmount | 3 fail đúng nguyên nhân trước sửa | emukey-continuation-red.log |
| Cùng ba regression sau sửa | 3 pass, 48 filtered | emukey-continuation-green.log |
| AI creation lost response RED | 1 fail vì clientRequestId undefined, 30 filtered | emukey-continuation-creation-red.log |
| Full assistant chat unit, sau sửa assertions animation | 32 pass / 0 fail, exit 0 | emukey-continuation-ai-final.log |
| Full real local support browser | 5 pass / 0 fail, 1.8m, exit 0 | emukey-continuation-support-final.log; emukey-support-chat-bcRPuA/ |
| Frontend lint / typecheck / build | Từng lệnh exit 0 | emukey-continuation-lint.log; emukey-continuation-typecheck.log; emukey-continuation-build.log |

Browser dùng API/auth/PostgreSQL/Redis thật trong môi trường disposable; external AI vẫn là controlled adapter, không chứng minh Gemini availability. Ca guest transfer giữ response sau backend commit để kiểm tra composer/new-chat/decline đều bị khóa. Ca mới dùng tài khoản test riêng, mất response sau creation commit, kiểm tra hai POST cùng request ID và cùng conversation ID, rồi giữ AI response để Browser Back/unmount → quay lại soạn draft mới → response cũ → reload; draft mới còn nguyên.

Giữ nguyên các lượt thất bại: `emukey-continuation-focused.log` 55 pass/1 fail do locator retry không tính tên loading icon của Ant Design; `emukey-continuation-link-retry.log` tái hiện riêng locator đó; `emukey-continuation-focused-final.log` 54 pass/2 fail (cùng locator đang được cache trước sửa và buyer key-read test timeout 30s khi nhiều tác vụ chạy đồng thời). Sửa locator thành match nhãn chữ trong tên accessible có thể chứa icon; giữ nguyên kiểm tra proof, draft, unlock, retry thành công. Không đổi production behavior hoặc tăng timeout để che lỗi test. Lượt browser đầu `emukey-continuation-support.log` 4 pass/1 fail vì test kỳ vọng ai-ask HTTP 201, trong khi contract trả 200; sửa expectation về đúng contract. Điều hướng khỏi modal pending dùng Browser Back, không ép click xuyên modal.

Build giữ cảnh báo chunk >500 kB có sẵn. jsdom giữ cảnh báo pseudo-element getComputedStyle chưa hỗ trợ; các warning không được gọi là test failures. Các blocker Gemini/remote CI/approval/dependency moderate ở snapshot trước vẫn chưa được nghiệm thu thêm.

## Acceptance follow-up — 4af3fb3

Windows/PowerShell, Node 22.21.0, pnpm 11.25.0; PostgreSQL 15/pgvector và Redis disposable cho integration. `T` là OS temporary directory. Native exit code được đọc riêng; PowerShell có thể ghi NativeCommandError khi công cụ ghi stderr dù native exit=0. Source sửa trong đợt này chưa commit. Bộ kiểm tra sau các sửa cuối dùng prefix `emukey-acceptance-verified-`; các lượt trước giữ nguyên và được phân biệt phía dưới. Fingerprint 525 tracked product/workflow/test/tooling files nằm trong `T/emukey-acceptance-frozen-source.json`; không đổi source sau khi chốt, tài liệu được cập nhật độc lập.

| Test group | Command | PASS | FAIL | SKIP | Environment | Evidence dưới T |
|---|---|---:|---:|---:|---|---|
| P0 regression trước build | Clean disposable source snapshot, Vitest baseline-schema filter `archives only` và `requires explicit consent` | 0 | 2 | 199 filtered | Không có dist: MODULE_NOT_FOUND cho initialize/migrate | emukey-acceptance-ci-red.log |
| P0 regression sau build | Installed tsc `--project <snapshot>/EmuKey/backend/tsconfig.build.json`, cùng hai test từ cwd snapshot/backend | 2 | 0 | 17 filtered | Disposable snapshot; cả hai CLI artifacts tồn tại | emukey-acceptance-ci-focused.log |
| Backend unit | `node tooling/emukey/run.mjs backend:unit` | 541 | 0 | 0 | Sau recommendation-card fix và security patches, 47 files | emukey-acceptance-verified-backend-unit.log |
| Backend contracts | `node tooling/emukey/run.mjs backend:contract` | 23 | 0 | 0 | Controlled HTTP dependencies | emukey-acceptance-verified-backend-contract.log |
| Backend security | `node tooling/emukey/run.mjs backend:security` | 35 | 0 | 0 | Authorization, isolation, untrusted-input assertions | emukey-acceptance-verified-backend-security.log |
| Backend integration | `node tooling/emukey/run.mjs backend:integration` | 150 | 0 | 62 | Disposable PostgreSQL/Redis; migration, provider crash recovery, notifications, pagination và guest transfer; 263.16s | emukey-acceptance-verified-backend-integration.log |
| Frontend unit | `node tooling/emukey/run.mjs frontend:unit` | 311 | 0 | 0 | jsdom + controlled HTTP, tuần tự sau integration/native builds; 23 files, 990.66s | emukey-acceptance-verified-frontend-unit.log |
| Mobile unit | `node tooling/emukey/run.mjs mobile:unit` | 47 | 0 | 0 | Jest/React Native, sau patches và draft/retry/handoff fixes; 5 suites | emukey-acceptance-verified-mobile-unit.log |
| OpenAPI/lint/types/build | `corepack pnpm --dir EmuKey/<component> <gate>` | All exit 0 | 0 | 0 | Backend/mobile verified prefix sau fixes; frontend final prefix; OpenAPI generated từ backend, từng component exit 0; filenames đổi colon thành dash trên Windows | emukey-acceptance-{verified,final}-*.log |
| Frozen install | `corepack pnpm --dir EmuKey/<component> install --frozen-lockfile` | 3 components | 0 | 0 | Cả ba chạy trên source/lockfiles đã chốt | emukey-acceptance-verified-{backend,frontend,mobile}-frozen.log |
| Dependency high gate | `corepack pnpm --dir EmuKey/<component> audit --prod --audit-level high` | 3 components | 0 high/critical | 0 | Sau patches: backend 2 moderate, frontend 0, mobile 1 moderate; đây không phải zero-advisory claim | emukey-acceptance-*-security-patches-audit.log; emukey-acceptance-frontend-audit.log |
| Expo | `EXPO_NO_CACHE=1 corepack pnpm --dir EmuKey/mobile exec expo install --check` | PASS | 0 | 0 | Chạy sau security patches, đúng SDK | emukey-acceptance-expo-verified.log |
| Chat real local service | `node tooling/emukey/verification/run-support-chat.mjs` | 4 | 0 | 0 | Frontend/API/auth/DB/Redis thật, AI controlled; 1.000 messages/scroll anchor/draft/reconnect và guest opt-in transfer; 1.5 minutes | emukey-acceptance-verified-support.log; emukey-support-chat-zRWMLu/ |
| Browser UI regression | `E2E_WEB_ONLY=true node tooling/emukey/run.mjs frontend:e2e buyer-ui-recovery payment-status-flow workspace-navigation ai-assistant --workers=1 --reporter=list --output <T>/emukey-acceptance-browser-final` | 70 | 0 | 0 | Chromium/frontend thật; business API fixtures; 8.5 minutes | emukey-acceptance-browser-final.log |
| Solidity | `node tooling/emukey/run.mjs contracts` | 7 | 0 | 0 | Hardhat/local, không external transaction; 4.23s | emukey-acceptance-verified-contracts.log |
| Backup/restore | Existing backup-restore.mjs `--disposable` từ fixture runner trong T | RESTORE_VERIFIED | 0 | 0 | Chạy lại trên source đã chốt; source/target đều disposable; cùng counts 4 users/1 order/0 licenses/0 commands/0 events; reconcile NOT_REQUESTED | emukey-acceptance-verified-backup.log; emukey-acceptance-backup-K7xxeS/ |
| Migration rehearsal | Included in `backend:integration`, owner database/baseline-schema.integration.test.ts | Included in 150 | 0 | 0 | Disposable archive/rehearsal rollback/OID/rows/no-op/reversal/unknown-drift guards; không apply configured database | emukey-acceptance-verified-backend-integration.log |
| Provider delivery E2E | Included in `backend:integration`, owner licensing/provider-delivery.integration.test.ts | 3, included in 150 | 0 | 0 | Real HTTP/independent provider DB + worker/API restart; payment and chain events controlled | emukey-acceptance-verified-backend-integration.log |
| Notifications | Included in `backend:integration`, owner operations/phase7-notification.integration.test.ts | Included in 150 | 0 | External opt-in separate | Durable SQL/queue/retry/dead letter, controlled HTTP providers; Brevo/FCM live NOT_RUN | emukey-acceptance-verified-backend-integration.log |
| Configured DB | cwd backend: `node --env-file-if-exists=.env dist/entrypoints/database/verify.js` | Read-only inspection | Expected drift | 0 | Có thêm đúng public.schema_versions; không apply | emukey-acceptance-configured-db-verify.log |
| AI references live round 1 | EMUKEY_TEST_REAL_AI=1, Vitest ai-understanding-provider.integration, maxWorkers=1 | 41 | 0 | 0 | Real Gemini, controlled history; before later independent remediation | emukey-acceptance-ai-live-1.log |
| AI references live round 2 | Cùng command, không đổi gateway/dataset | 41 | 0 | 0 | Real Gemini; provider retries bounded | emukey-acceptance-ai-live-2.log |
| AI catalog live | EMUKEY_TEST_REAL_CATALOG=1, Vitest ai-semantic-catalog.integration, maxWorkers=1 | 8 | 0 | 0 | Real Gemini/embeddings/current public DB views, inference read-only; before 3 additional capability cases | emukey-acceptance-catalog-live.log |
| AI expanded capability pilot | Both opt-in flags, ai-semantic-catalog.integration + ai-provider.integration | 11 | 2 | 0 | 1 invalid test budget assumption and 1 provider 503; controlled-doc generation 3/3 | emukey-acceptance-ai-capabilities-live.log |
| AI broad pre-card-fix run | Both opt-in flags, ai-understanding-provider.integration + ai-semantic-catalog.integration + ai-provider.integration, maxWorkers=1 | 45 | 10 | 0 | 9 provider/timeout failures và 1 recommendation-card bug; không phải final PASS | emukey-acceptance-ai-final-live.log |
| AI recommendation after fix | EMUKEY_TEST_REAL_CATALOG=1, ai-semantic-catalog.integration, filter `recommends only current plans` | 1 | 0 | 10 filtered | Real inference + current public DB; thẻ đề xuất đúng constraints; 30.60s | emukey-acceptance-recommendation-live-fixed.log |
| AI orchestration after fix | Both opt-in flags, ai-semantic-catalog.integration + ai-provider.integration, maxWorkers=1 | 2 | 12 | 0 | BLOCKED_EXTERNAL: 429/503; giữ nguyên assertions; 190.28s. Đã dừng mở thêm live runs | emukey-acceptance-ai-orchestration-verified.log |
| Read-only boundaries | Native Node/SDK script, BEGIN READ ONLY + SET LOCAL ROLE, read-only RPC methods | PASS | 0 | 0 | Reader 0 mutation grants, 33 plans/33 embeddings/46 chunks; Sepolia chain 11155111, head 12155243, code 4233 bytes, transactionsSent=0 | emukey-acceptance-readonly-boundaries.log |
| Native Expo build | Isolated current source snapshot, expo prebuild + Gradle :app:assembleDebug | PASS | 0 | Native UI NOT_RUN | Current snapshot source updated before warm rebuild, exit 0, 1m20s; debug APK không chứng minh native interaction | emukey-acceptance-native-current-build.log; emn-qh38s1bs/android/app/build/outputs/apk/debug/app-debug.apk |
| Kotlin | `gradlew.bat :app:testDebugUnitTest :app:lintDebug :app:assembleDebug -PemukeyTestSources=<workspace>/tests/emukey/license-client-demo --console=plain`; thêm lượt unit `--rerun-tasks --max-workers=1` | 3 unit + lint/APK | 0 | Native UI NOT_RUN | SDK env configured; build/lint exit 0, 48s; fresh unit 1m9s, XML timestamp 2026-11-17T15:58:49.091Z, 3/0/0/0 | emukey-acceptance-kotlin-final.log; emukey-acceptance-kotlin-fresh-unit.log |

### Phân biệt failure và revision

- Clean snapshot P0 có RED thực trước build. Một thử pnpm trong snapshot có node_modules junction không chạy được vì shim/install metadata, sau đó dùng chính tsc đã cài. Một lượt Vitest gọi sai cwd cũng bị ENOENT; các lượt đó được giữ, không tính vào PASS.
- Phân trang: hai integration cases đỏ khi endpoint còn trả toàn lịch sử; xanh sau bounded SQL. HTTP DTO, claim/release, CLOSED, duplicate và guest tests bổ sung vào existing owner. Full default integration có 62 skips external opt-in/child fixtures; không phải 62 acceptance PASS.
- Lượt frontend đầu đang chạy trong lúc source/test thay đổi: 308 pass/3 fail, gồm test guest mới nhưng launcher module cũ đã được cache và hai ca provider timeout. Không gọi đây là baseline bất biến hoặc final-tree result. Các lượt sau ghi riêng, không cộng focused PASS vào full suite.
- Lượt integration dưới resource contention: 149 pass/1 fail/61 skip; child worker chưa ready trong 30s ở restart drill. Lượt kế tiếp trên source tương ứng: 150 pass/0 fail/62 skip. Không tăng timeout hay bỏ worker recovery assertion để đạt xanh.
- Browser mở rộng ban đầu: 67 pass/3 fail vì assertion cũ đòi excerpt không tồn tại, trong khi KnowledgeCitations hiện chứa excerpt trong details đóng. Sửa assertion thành không visible, giữ kiểm tra source link, nội dung nhạy cảm và responsive. Lượt final chạy toàn bộ 70 cases riêng.
- Fixture long-history ban đầu làm hỏng điều kiện queue trống của test khác; đổi fixture sang AI_ACTIVE, không sửa business assertion. Pagination browser sau đó chỉ sai locator nút gửi ở AI_ACTIVE; dùng đúng Hỏi AI có nguồn. Lượt hoàn chỉnh 3/3 vẫn kiểm tra scroll delta <3px, draft, offline/reconnect và refresh.
- AI live pilot capability ban đầu yêu cầu trả lời gói lớp học 5 thiết bị dưới 2 triệu trong khi public catalog chỉ có gói 10 thiết bị giá 2.322.000 đồng. NO_SOURCES là đúng; giữ riêng negative case dưới 2 triệu và thêm positive case 3 triệu. Facts được đối chiếu qua read-only role, không sửa giá/database. Ca guidance trả PROVIDER_UNAVAILABLE có HTTP 503 từ Gemini; không phân loại là semantic regression hoặc đổi assertion chấp nhận outage để đạt PASS.
- Native build đầu thiếu cấu hình SDK ở Kotlin và có flag PowerShell chưa quote đúng ở Expo. Không sửa source sản phẩm cho lỗi môi trường; native build chạy lại với SDK env/quoted arguments và tối đa 2 workers, không khởi động Metro để lách auto-review rejection trước đó.
- Expanded live run trước recommendation-card fix: **45 pass / 10 fail / 0 skip**, 55 ca, 967.54s (`emukey-acceptance-ai-final-live.log`). 7 understanding failures là AbortError/TimeoutError hoặc HTTP 503, 2 catalog failures là PROVIDER_UNAVAILABLE; 1 catalog failure là recommendations rỗng dù ANSWERED. Lỗi logic cuối đã có unit RED/GREEN và live focused 1/1 sau fix (`emukey-acceptance-recommendation-live-fixed.log`); không cộng chúng để gọi lượt 55 ca là PASS.
- Lượt integration sau patches có 1 suite fail khi Docker chưa bind port trong 10s và 1 rate-limit test fail vì 20+1 requests qua ranh giới phút thật: 139 pass/1 fail/72 skip. Cố định clock của đúng fixed-window regression, không thay quota và không skip test. Chạy lại full suite sau khi native compile hoàn tất.
- Mobile pending-send draft-loss có RED trước fix, GREEN 45/45. Hai ca bổ sung AI-outage retry/handoff RED trước sửa; GREEN 47/47 trong `emukey-acceptance-mobile-final-tests.log`. Không dùng APK build để suy native interaction PASS.
- Lượt frontend dưới contention sau đó: 309 pass/2 fail trong 311 ca. Cả hai cùng owner provider UI; một test quá 30s làm state async của test kế tiếp lệch. Focused isolated 2/2 rồi **full sequential 311/311** trên source đã chốt, không tăng timeout và không đổi assertions của provider tests.
- Guest continuity có thêm focused browser thật 1/1 (`emukey-acceptance-guest-browser.log`, `emukey-support-chat-e84m1W/`): public ask cấp proof → đăng nhập → chưa tự POST transfer → explicit confirmation → history được lưu → refresh giữ đúng một bản; full support suite mới gồm 4 ca chạy riêng.

### Dependency residuals

Patch cùng major đã áp dụng cho qs 6.17.1, brace-expansion 1.1.21/5.0.12 và node-forge 1.4.3. Lockfile diff chỉ theo các transitive này, không thêm dependency production. Hai moderate backend là glob/minimatch qua OpenTelemetry GCP detector → gcp-metadata → gaxios → rimraf; mobile còn minimatch trong toolchain. `pnpm why --prod` lưu trong emukey-acceptance-transitive-reachability.log và emukey-acceptance-mobile-transitive-reachability.log. Không ép các consumer CommonJS lên major glob 14/minimatch 11; cần upstream compatible fix hoặc migration được kiểm chứng. Chưa xác nhận toàn bộ attack reachability, nên giữ residual P2, không tuyên bố hết vulnerabilities.

### Final verification provenance

All default local suites and required builds/checks completed with native exit 0. External opt-in failures remain failures, with provider/quota classification; no full external PASS is claimed. The source freeze covers 525 tracked product/workflow/test/tooling files; the final fingerprint comparison found no drift. Documentation-only updates were made separately. Both database CLI artifacts exist; workspace CI YAML build ordering and both workflow files parse correctly. Remote Actions was not triggered.

`git diff --check` and workspace hygiene guard passed; HEAD remains `4af3fb334f976d4b4467e9358b42b8250832f7b6`, no commit/push, no new untracked source files, and no schema.sql diff. All 51 modified existing owners have reasons in system-audit; all 34 inventory test paths resolve. Inline diff/abuse-case review completed; independent-agent review was not performed.

Raw logs, including RED/failed/intermediate runs, and the two APK artifacts are indexed with SHA-256 in `T/emukey-acceptance-evidence-manifest.json`. The manifest records commands/scopes/results per boundary and the frozen source hashes. Temporary dumps, traces, APKs and scripts remain outside source. Native snapshot App/client hashes match current source; native UI remains NOT_RUN because the earlier Metro startup was rejected by automatic approval review as `blocked by policy` without a more specific reason. No equivalent Metro command was used to bypass that rejection.

## Historical execution — baseline 562bbc6


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
