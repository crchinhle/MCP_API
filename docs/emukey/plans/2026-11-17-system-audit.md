# EmuKey system audit and remediation plan

Baseline: `562bbc6`; clean working tree. Request: full-system audit, fixes and truthful end-to-end evidence, 17 November 2026.

Constraints: preserve existing data and nested repository; no commits, pushes, deployments, paid transactions or real-user notifications. Use disposable databases for writes. Keep `backend/database/schema.sql` authoritative. Do not equate fixtures with external acceptance.

- [x] Inspect instructions, runtime versions, source owners, existing tests and previous support-chat acceptance.
- [x] Run existing baseline, backend unit/contract/security/integration, frontend and mobile suites; save command output in OS TEMP.
- [x] Fix Expo compatibility using the CLI's current recommendation and scoped lockfile update. Run compatibility, lint, typecheck and Android bundle export.
- [x] Add regression tests for unknown provider-managed device counts and incomplete public verification metadata, observe failures, then update existing selector/screens. Preserve legacy zero counts and device management.
- [x] Fix Help/Verification lint failures; remove the Demo label and verify published-document search/filter/replacement boundaries using existing integration tests.
- [x] Audit catalog selection. Reuse existing published catalog data and deterministic ordering; do not invent popularity or add editorial infrastructure without a requirement.
- [x] Audit terms snapshots/hash/acceptance; add production approval/hash readiness guards with tests, retaining test fixtures.
- [x] Inspect AI reader permissions, vector freshness, confirmed handoff, payment/license/provider durability, notification adapters and mobile contracts. Repair reproduced defects and record unavailable external boundaries separately.
- [x] Assess migration/backup recovery through disposable tests; do not execute reset or initialize against configured databases.
- [x] Run product quality gates, contract/build/security checks and available browser scenarios. Inspect final diff, workspace hygiene and regression evidence.
- [x] Publish feature inventory, findings, hardcode classification, changed files, command results and remaining blockers under `docs/emukey/audits/`.

Expected owners: mobile package/lockfile; frontend buyerHome selector and public/buyer screens; existing frontend regression tests; platform terms/configuration and their backend tests. Expand only for a verified defect. Existing runners in `tooling/emukey/` own execution; raw logs and screenshots stay outside source.

Design decisions: mixed or provider-managed device totals are unknown rather than zero; public missing metadata is explicitly unavailable; homepage catalog ordering must describe its actual selection criterion. Legal approval is an operator-supplied content hash, never an agent-authored claim of approval. No workflow bypasses or disabled assertions to obtain green output.

Verified expansion: read-only verification of the configured database found only the legacy `schema_versions` table beyond the 24-table baseline. Add an explicit `db:migrate` owner to rehearse/transactionally archive that table into `emukey_maintenance`, preserving its OID and rows, rejecting all other drift. Test rehearsal rollback, archival, idempotency, unknown drift and reversal on a disposable database. Do not apply this to the configured database as part of the audit; review external consumers of that historical ledger first.

Execution note: checkboxes record work performed, not a blanket PASS. External/native approvals, configured DB ledger archival, remaining P2 support design and remote CI are unqualified or pending as detailed in the audit report. Final gate results retain every failed run.
