# Phase 8 Traceability Matrix

This matrix is the release-hardening index for the existing Phase 1-7 baseline.
It does not add business capability or replace the canonical owners documented in
`context/current/APP_IMPLEMENTATION_PLAN.md`.

## Current Sepolia-only verification (2026-10-04 to 2026-10-05)

Application services, PostgreSQL and Redis may run locally. All blockchain runtime/integration uses Ethereum Sepolia, chainId 11155111. Hardhat is retained only for compile, contract unit tests, ABI export and Ignition deployment.

- Deployment: `EmuKey/backend/contracts/deployments/sepolia-v3.json`; address `0x4d30200F3D0791e0aE34Fa6075A4e4b03f4d1cBC`, block `11842365`. Runtime bytecode exactly matches the compiled artifact. V2 metadata remains historical.
- Real external evidence: `sepolia-lifecycle-evidence.json`. Application-created ISSUE, successful receipt with two confirmations, indexed event and ACTIVE projection; public HTTP activation and entitlement work before aggregate sync; real sync event and DB/on-chain count/version agree. The commerce path uses an isolated test payment adapter, not a real payment-provider callback.
- DB invariants: `tests/emukey/backend/integration/blockchain/license-db-invariants.integration.test.ts`. Quota two / three concurrent requests gives two success and one rejection. Replay, idempotency, owner isolation, binding generation and ISSUE reorg/reconfirmation run without any blockchain node.
- Normal verification: baseline; backend unit (180), contract/API (12), security (16), DB integration (33); frontend unit (90), browser regressions (31); mobile unit (16); Solidity contract tests (6). Product lint/typecheck/build, ABI export, all OpenAPI checks and Expo dependency check passed locally. GitHub Actions itself was not dispatched; changes remain uncommitted.
- Regression fixes found during verification: activation HTTP DTO accepts the server-issued challenge and optional legacy license hint; ISSUE reorg invalidates key trust correctly and reconfirmation retains its reorg timestamp. Production rejection of the public development relayer key is preserved.
- Current runners: `tooling/emukey/run.mjs` and `tooling/emukey/verification/verify-sepolia.mjs`. External CI is manually invoked with `run_sepolia=true` and requires Sepolia secrets plus the v3 address/block variables. Its DB/Redis are disposable containers.

## Historical September 2026 release matrix

The following matrix records earlier runs, including retired local-chain tooling and v2 deployments. It is historical evidence, not current setup or verification instructions. Use the current runners above.

Status vocabulary: `LOCAL_VERIFIED`, `STAGING_VERIFIED`, `EXTERNAL_VERIFIED`,
`PRODUCTION_READY`, `BLOCKED_EXTERNAL`, `FAIL`, `OPEN`.

| Phase 8 requirement | Existing implementation | Missing | Test/Evidence | Status |
|---|---|---|---|---|
| WEB_E2E | `tests/emukey/e2e/web/phase6-license-flow.spec.ts`, `tests/emukey/e2e/web/user-purchase-flow.spec.ts`, Playwright orchestration | Full post-payment license/device flow needs an accepted provider callback | Browser reached real SePay Sandbox UI and returned; evidence `ui-sepay-20260920-1017/browser-user-journey.json` | BLOCKED_EXTERNAL |
| ANDROID_E2E | `tests/emukey/e2e/mobile/phase6-license-flow.yaml`, Maestro readiness checker | Maestro CLI and mobile build/install path | API 35 AVD `emulator-5554` booted; `maestro` executable unavailable | BLOCKED_EXTERNAL |
| SECURITY_SCAN | Platform config, HTTP hardening, redacted Pino paths | Local ignored `.env` rotation check is separate; no committed secret found | `pnpm test:security`, `pnpm test:security:local`, `pnpm test:dependency-audit` | LOCAL_VERIFIED |
| AUTHZ_NEGATIVE | Module guards and ownership checks | Full HTTP cross-subject fixture matrix | `tests/emukey/backend/security/authorization-negative.test.ts` | LOCAL_VERIFIED |
| SECRET_SCAN | `.gitignore`, environment templates, log redaction | Git history scan requires repository tooling review | `pnpm test:security` | LOCAL_VERIFIED |
| PII_SCAN | BC-05 endpoint and DTOs | Runtime log/trace sample review in staging | `pnpm test:security` | LOCAL_VERIFIED |
| ACTIVATION_SECRET_SCAN | Redis AES-256-GCM envelope and license crypto | Live DB/log/Redis sample scan | `pnpm test:security`, envelope tests | LOCAL_VERIFIED |
| LOAD_CHECKOUT | Commerce HTTP API | Safe authenticated checkout load with sandbox provider boundary | Target-schema disposable API: 50 requests, concurrency 10, p50 50.74ms, p95 112.90ms, p99 125.75ms, error 0% | LOCAL_VERIFIED |
| LOAD_PUBLIC_VERIFY | BC-05 public endpoint/rate limit | Staging cache/RPC pressure profile | `pnpm test:load -- --scenario=public-verify` | LOCAL_VERIFIED |
| LOAD_ACTIVATION | Licensing challenge/action API | Canonical local Hardhat license/device fixture with concurrent challenge generation | Clean current-artifact chain: 20 requests, concurrency 20, p50 41.89ms, p95 53.48ms, p99 53.48ms, error 0% | REAL_VERIFIED |
| SEP1 | Sepolia V2 deployment artefact, ABI and receipt validation | Staging runtime/indexer adoption | External evidence run `emukey-ext-20260920023125-4f64e15c` | EXTERNAL_VERIFIED |
| SEP2 | Controlled V2 `LicenseIssued` transaction | Application-created transaction and backend projection | Tx `0xc69e2d9f3162a38d238d425cd8286f5d6964006d7446ea49d6f06bcc68aa6b04`, block `11741561` | EXTERNAL_VERIFIED |
| SEP3 | Durable ChainCommand, worker, Sepolia V2, receipt, indexer and finality | Hosted staging deployment remains separate | Run `emukey-sep3-20260920072528`: matched payment, command `1cc2dd6d-ba38-42e1-925d-94a242f91181`, tx `0x86dbeaea0fb1a334e4dfc96064a87ff045bf5475f0d31ad8119c1f2cea56c808`, event confirmed, License ACTIVE/TRUSTED | EXTERNAL_VERIFIED |
| SEP4 | Web/Mobile surfaces and SePay adapter | Development Sandbox offset is explicitly configured at adapter boundary; fresh browser payment now reaches PAYMENT_ACCEPTED and finality | `fresh-ipn-offset-20260920-2050/payment-evidence.json` | EXTERNAL_VERIFIED |
| RPC_RETRY | `viem-rpc-transport.ts` fallback transport | External provider outage matrix | `pnpm test:rpc-chaos` | LOCAL_VERIFIED |
| RPC_REORG | Indexer/reconciliation services and local chain tests | Deterministic fork/reorg recovery evidence | RPC chaos suite and Phase 7 golden flow | LOCAL_VERIFIED |
| RPC_NONCE | Chain command repository/worker | Full worker restart timing matrix | RPC chaos suite | LOCAL_VERIFIED |
| RPC_RECEIPT | Relayer receipt and unknown handling | Delayed/reverted/unknown receipt matrix | RPC chaos suite | LOCAL_VERIFIED |
| RECONCILE | `BC-04` reconciliation owner | Staging canonical command/evidence population | `scripts/reconcile.mjs` and restore reconcile output | LOCAL_VERIFIED |
| BACKUP | PostgreSQL is durable authority | Staging retention/encryption destination | `pnpm test:backup-restore` created a real custom dump | LOCAL_VERIFIED |
| RESTORE | SQL schema and seed tooling | Disposable restore verification with pgvector PostgreSQL 18 | `pnpm test:backup-restore` returned `RESTORE_VERIFIED` with durable row counts | LOCAL_VERIFIED |
| RESTORE_RECONCILE | BC-04 canonical reconcile owner | Restored DB has no commands for unrelated canonical chain events; reconciliation skips unowned events without projection mutation | `pnpm test:backup-restore` returns `RECONCILE_VERIFIED_NO_RESTORED_COMMAND_CONTEXT` | LOCAL_VERIFIED |
| REDIS_LOSS | PostgreSQL durable authority, Redis cache/queue | Disposable loss/restart drill | `pnpm test:redis-loss` returned `REDIS_LOSS_VERIFIED` with durable counts unchanged | LOCAL_VERIFIED |
| STAGING_SCHEMA | Target PostgreSQL schema and seed | Hosted deployment is not a production staging environment | Actual development DB reset, seed twice, 18-table/legacy-column verification | REAL_VERIFIED |
| RUNBOOK | `docs/emukey/runbooks/local-development.md` | Release, incident, payment and worker recovery procedures | `docs/emukey/runbooks/phase-8-release.md` | LOCAL_VERIFIED |
| DEPLOY | Dockerfiles and Compose | Cloud deploy credential and staging smoke | CI/CD workflow and release check | BLOCKED_EXTERNAL |
| TLS | HTTP-only local Caddy | Staging HTTPS template and callback route verification | Caddy config/checklist | BLOCKED_EXTERNAL |
| MONITORING | OTEL auto-instrumentation and readiness probes | Deployment backend must export/route production signals | `docs/emukey/operations/monitoring.md` | LOCAL_VERIFIED |
| CI_CD | Baseline `.github/workflows/ci.yml` | Protected environment permissions and deploy credential | GitHub Actions YAML | LOCAL_VERIFIED |
| RELEASE_EVIDENCE | Phase 1-7 evidence JSON | External/staging evidence inputs | `pnpm release:evidence` | LOCAL_VERIFIED |

`ROTATION_REQUIRED` is an operational security blocker even when the file is ignored
and absent from Git. The scanner never emits credential values. See
`docs/emukey/operations/secret-governance.md`.

The old address `0x35614C24f5CAc001a530aA362B9fd82457bb0b23` remains only in the
Hardhat Ignition historical journal/address artifact. It is not active runtime
configuration; `contracts/deployments/sepolia-v2.json`, `print-deployment.mjs`, the
staging workflow, and the local runtime use `0xAf61c3712e0A5fe9d5be0b3Fe080C786076e2845`.

## Classification rules

- Missing code, configuration, tests, or documentation is `OPEN` and must be fixed in
  this repository.
- A missing domain/DNS, cloud credential, merchant callback setting, CI permission,
  safe email recipient, or Android device is `BLOCKED_EXTERNAL` only after the local
  harness is complete.
- A provider probe, contract deployment, unit test, or image build alone never proves
  SEP-3, SEP-4, or `PRODUCTION_READY`.
- Every skipped command must emit one of `EXPECTED_OPTIONAL`, `BLOCKED_EXTERNAL`,
  `BUG`, or `UNEXPECTED_SKIP`.

## Current Release Classification

`PRODUCTION_READY_BLOCKED_ONLY_BY_UNAVAILABLE_EXTERNAL_RESOURCE`

Repository-fixable Phase 8 gates are closed, including SEP-3, checkout/activation load,
disposable DB reset, restore/reconcile, and emulator provisioning. Remaining blockers
require provider callback/dashboard configuration, Maestro CLI, FCM runtime, Brevo safe
recipient, cloud deployment/domain/TLS, telemetry backend, provider-side credential
rotation authority, and an immutable committed release identity.
