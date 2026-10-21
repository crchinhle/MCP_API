# Provider invitation and System Admin dashboard

**Goal:** Email-only invitations, recipient-owned profile setup, immutable Provider namespaces, and useful administration metrics without infrastructure health cards.

**Spec:** User attachment `c14730b5-06d8-47be-9a89-a956a5878cbe/Pasted text.txt` (2026-10-21).

**Constraints:** Preserve the six existing modified files and nested Git repository. No commits, pushes, new dependencies, real invitation emails, wallet fabrication, or unapproved chain deployment. Preserve existing address-based commitments and Provider isolation.

## Source findings

- Invitations currently create no user; names, organization and address are copied into an ACTIVE account during one atomic acceptance transaction. Tokens are random 32-byte secrets stored as SHA-256 digests, expire after 24 hours, and rotate on resend.
- Organizations are fields on Provider accounts; there is no separate organization table. `/auth/users` returns the complete matching list, without pagination. Document publication is `status=READY AND is_current`; a unique index prevents duplicate current logical versions per Provider.
- The relayer already signs all transactions. The deployed contract nevertheless stores an address as Provider identity; text namespaces are not sent on chain. Removing this address requires an explicit contract compatibility decision, requested separately. Do not substitute the shared signer address or fabricate an address.

## Execution

- [x] Extend existing identity DTO/service/repository and invitation SQL for email-only creation, preserving legacy invitation fields. Test authorization, email normalization, conflicts, resend rotation, delivery failure and atomic acceptance.
- [x] Add token inspection via POST body to display the verified recipient email without consuming the token. Move representative/organization input to acceptance; retain password policy and single-use/rate-limit controls. Test invalid/expired/consumed links and email/role injection.
- [x] User approved preparing the namespace contract and compatibility flow without deployment; preserve existing V2 commitments, queued commands, registry state and signer.
- [x] Reuse central request/query infrastructure for invitations and full account lists. Replace the invitation modal with email + cancel/send, localized feedback, details/resend actions and compact empty state. Preserve delivery-confirmation semantics.
- [x] Extend the existing overview with total accounts, active Provider-admin accounts and distinct published logical documents. Keep pending document/payment work, show a compact success-only empty state, and summarize invitation statuses. Remove support-staff work from the Admin task queue. Add real filtered links; omit unsupported audit activity.
- [x] Verify focused backend unit/HTTP/integration/database tests, generated OpenAPI/client consistency, frontend component/browser checks at 320/768/1024/1440, typechecks, lint, builds and final diff/hygiene. Report live deployment limitations explicitly.

## Owners and verification

Backend: `identity-access/{identity.dto,identity.types,identity.service,identity.repository,identity.controller}.ts`, existing identity email adapter/template, `database/schema.sql` and one forward migration. Frontend: existing `ProviderInvitationsPanel`, `AuthForms`/`AuthScreen`, `SystemConsoleScreen`, `SystemUsersPanel`, `AiKnowledgeScreen`, scoped CSS; shared identity queries have real callers in these screens. Extend existing identity/frontend/System Admin tests.

Commands run from product apps: TypeScript/ESLint/build binaries already installed; Vitest configs in `tooling/emukey/verification`; Playwright `system-admin.spec.ts` and workspace regression with reports in OS temporary directories. Integration tests use disposable Testcontainers databases, never the configured application database.

## Official references

- https://www.postgresql.org/docs/18/ddl-constraints.html
- https://www.postgresql.org/docs/18/explicit-locking.html
- https://docs.nestjs.com/techniques/validation
- https://ant.design/components/form/
- https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptorandomuuidoptions
- https://docs.soliditylang.org/en/v0.8.34/types.html#address

## Final architecture and behavior

- **Before:** Admin supplied email, representative, organization, EVM address and namespace. Recipient only chose a password. **After:** Admin supplies email only; the verified recipient supplies representative, organization and password/confirmation. Email comes from token inspection and cannot be overridden in acceptance. No wallet or namespace input remains in invitation/onboarding/profile.
- Namespace allocation is `provider-${randomUUID()}` during acceptance, within the same user-creation/token-consumption transaction. PostgreSQL enforces uniqueness; the service retries a namespace uniqueness collision up to three attempts. Same organization names remain separate tenants. Existing invitation addresses/namespaces are retained when accepting older links.
- New namespace Providers have no `provider_chain_address`. Existing Providers, V2 commitments and queued payloads remain unchanged. The new domain-separated namespace digest is `keccak256('EMUKEY_PROVIDER_NAMESPACE_V1:' + namespace)` and new commitments use `LICENSE_PLAN_COMMITMENT_V3`.
- Contract extensions are additive: `computePlanCommitmentForProvider`, `issueLicenseForProvider`, `providerNamespaceForLicense`, `LicenseIssuedForProvider`. Legacy ABI/getLicense shape stays intact. Namespace-native records use the separate namespace mapping; the old address slot is explicitly unused, never a fabricated personal wallet.
- Shared relayer/signing keys remain backend-only. New registry deployment uses a separate Ignition ID and metadata; the deployment command has **not** been executed. Both optional namespace registry environment values must be configured after an approved deployment. Without them, new namespace plans/orders/checkout (including renewal) return `PROVIDER_NAMESPACE_CAPABILITY_NOT_CONFIGURED` before collecting payment.
- Indexing covers the legacy registry, configured namespace registry and historical protocol-3 ISSUE origins for the same network/chain. Renewal, lifecycle, device and key commands retain their original issuance registry. A retired origin without a checkpoint replays conservatively from block zero, which can take longer.
- Invitation tokens remain random 32-byte secrets with only SHA-256 digests stored in SQL, 24-hour expiry, atomic single-use consumption and token rotation on resend. No account exists before acceptance. Failed delivery remains durable and is reported as unconfirmed; concurrent resend cannot mark a replaced token as delivered. Client limiting uses Express-resolved `request.ip`, with trusted/untrusted proxy HTTP coverage. Existing log redaction covers body token/password.
- Invitation list supports the existing PENDING/EXPIRED/ACCEPTED states, details and resend. There is no revocation endpoint, so no revoke action or invented REVOKED status was added.
- Dashboard sources: complete `/auth/users` for total/active Provider-admin **accounts** (not organizations); `/knowledge/documents` for distinct READY/current Provider+logical-key documents; `/payments/review` for OPEN work; `/auth/provider-invitations` for invitation states. Empty states require successful queries. Errors use an em dash and retry. Account/document filters and invitation anchor are handled by destination screens. No audit activity API exists, so no activity feed was fabricated. Support-staff work and infrastructure health requests are absent.

## Review findings resolved

1. New token inspection initially used the proxy socket address for rate limiting. Changed inspection/acceptance to Express-resolved client IP, with trusted-loopback proxy and untrusted-header regression tests. Scoped re-review found no further issue.
2. Initial namespace indexing followed only the configured registry. Historical protocol-3 registry discovery and durable ISSUE recovery now preserve old origins after A→B configuration changes. Namespace renewals also fail closed without the capability; rejected checkout creates no payment attempt. Scoped re-review found no further issue.
3. Browser tests caught success-alert text squeezed by its inline action at 320px/1024px. Moved the login CTA below the alert; all four onboarding viewport checks passed afterward.

## Local database

Applied `EmuKey/backend/database/migrations/20261021-provider-namespace-onboarding.sql` to the configured development database. Counts unchanged: 34 users, 51 products, 33 plans, 30 licenses, 0 invitations. No rows/columns were deleted. The read-only schema verifier reports 18 tables, 236 constraints, 50 foreign keys, 118 indexes, matchesBaseline=true.

## Additional official reference

- https://expressjs.com/en/guide/behind-proxies/

## Verification results — 2026-10-21

| Check | Result |
| --- | --- |
| Backend unit/security | **PASS: 37 files, 287 tests** |
| Final namespace relayer/indexer/reconciliation recheck | **PASS: 3 files, 21 tests** |
| Identity, baseline schema, catalog, commerce and license database integrations | **PASS: 5 files, 47 tests** using disposable PostgreSQL/Redis containers |
| Solidity contract tests | **PASS: 7 tests** on local Hardhat; no Sepolia deployment |
| Legacy ABI comparison against Git HEAD | **PASS: all 34 old entries preserved verbatim; 39 current entries** |
| System Admin + workspace browser regression | **PASS: 32 tests**, including Provider/Support routes, invitation validation/details/resend, recipient setup at 320×800/768×1024/1024×768/1440×1024, profile/password/publication/payment flows and keyboard navigation |
| Frontend complete run | Initial run: **234 passed, 5 failed** across 19 files/239 tests. One stale health-card assertion and four timing/DOM-query failures were investigated; see rechecks below. |
| Frontend affected-file rechecks | **PASS across all four initially failing files (60 tests)**: buyer-hub, provider-licenses, app and completed-flows. The four-file run passed 59/60; the remaining payment-review test then passed in isolation at 28.44 seconds. Its broad page queries were scoped to the actual review region/drawer/dialog, and the complete completed-flows file subsequently passed **8/8**. No timeout was raised. The other 15 files passed in the complete run. Thus all 239 cases have passing evidence across these runs; a final single clean 19-file run was not repeated. |
| Frontend TypeScript, ESLint, production build | **PASS** after final source changes |
| Backend TypeScript, ESLint, build | **PASS** |
| Backend/frontend/mobile OpenAPI generation consistency | **PASS**; standard generator used, no hand-edited SDK types |
| Mobile TypeScript | **PASS** after generated contract synchronization |
| Docker image builds + local API/worker recreation | **PASS**; API/Redis healthy, worker running; existing orphan chain container preserved |
| Development database schema verification | **PASS**, baseline matches; seed rows preserved |
| Live API via direct port and Vite proxy | **PASS: readiness 200; Admin/Customer login 201; users/documents/invitations 200; email-only invitation for existing account 409; Customer invitation 403; invalid token inspection 400; diagnostic sessions logged out 204** |
| Diff / workspace hygiene / lockfiles | **PASS**; four intentionally new files, no generated build output or secret files added, no lockfile changes |
| Real email delivery / namespace registry deployment and live finality | **NOT VERIFIED**: no real invitation email or namespace deployment transaction was sent. This is deliberate; deployment needs separate user approval. |
| Native mobile keyboard / real screen reader | **NOT VERIFIED**; desktop browser viewport/keyboard checks are not a native IME or screen-reader audit. |

Existing tool warnings remain: jsdom pseudo-element getComputedStyle/requestSubmit support and Vite's >500 kB chunk warning. They were not suppressed. Images/traces are outside the repository, under the OS temporary directory (`emukey-provider-redesign-final-e2e`, `emukey-provider-onboarding-*.png`, `emukey-provider-invitation-*.png`).

## Prepared deployment boundary

The current development runtime has both namespace registry settings unset. Existing address-based Providers continue to use the old registry. New Providers may complete account setup; creation/sale of namespace plans is intentionally unavailable until the namespace registry is deployed and configured.

After a separate deployment approval, the prepared command is `node --env-file-if-exists=../.env scripts/deploy-sepolia.mjs --namespace` from `EmuKey/backend/contracts`. It uses a separate Ignition deployment ID `sepolia-namespace-v1`, verifies bytecode/receipt, and writes separate metadata. It must not overwrite the legacy registry configuration. Both `EVM_NAMESPACE_CONTRACT_ADDRESS` and `EVM_NAMESPACE_DEPLOYMENT_BLOCK` are then set from that verified deployment, followed by API/worker recreation. **This command was not run for this task.**

## Changed files

The six pre-existing modified files were preserved; files below may include this task's extensions to those changes. `application/operations/operationsQueries.ts` contains only the pre-task health-removal change and is excluded from this task's manifest. No commit or push was created.

```text
EmuKey/backend/.env.example
EmuKey/backend/contracts/package.json
EmuKey/backend/contracts/scripts/deploy-sepolia.mjs
EmuKey/backend/contracts/solidity/LicenseRegistry.sol
EmuKey/backend/database/migrations/20261021-provider-namespace-onboarding.sql
EmuKey/backend/database/schema.sql
EmuKey/backend/openapi/openapi.json
EmuKey/backend/src/modules/blockchain/application/rpc-chain-indexer.service.ts
EmuKey/backend/src/modules/blockchain/blockchain.module.ts
EmuKey/backend/src/modules/blockchain/infrastructure/chain-indexer-checkpoint.repository.ts
EmuKey/backend/src/modules/blockchain/infrastructure/generated/license-registry.abi.json
EmuKey/backend/src/modules/blockchain/infrastructure/viem-chain-event-source.ts
EmuKey/backend/src/modules/blockchain/infrastructure/viem-chain-relayer.ts
EmuKey/backend/src/modules/catalog/application/catalog-admin.service.ts
EmuKey/backend/src/modules/catalog/catalog.module.ts
EmuKey/backend/src/modules/catalog/infrastructure/catalog-admin.repository.ts
EmuKey/backend/src/modules/commerce-payment/application/commerce.service.ts
EmuKey/backend/src/modules/commerce-payment/commerce.module.ts
EmuKey/backend/src/modules/commerce-payment/infrastructure/commerce.repository.ts
EmuKey/backend/src/modules/identity-access/identity.controller.ts
EmuKey/backend/src/modules/identity-access/identity.dto.ts
EmuKey/backend/src/modules/identity-access/identity.repository.ts
EmuKey/backend/src/modules/identity-access/identity.service.ts
EmuKey/backend/src/modules/identity-access/identity.types.ts
EmuKey/backend/src/modules/identity-access/infrastructure/identity-email-delivery.ts
EmuKey/backend/src/modules/licensing/infrastructure/licensing.repository.ts
EmuKey/backend/src/modules/operations/infrastructure/brevo-email-delivery.ts
EmuKey/backend/src/platform/config/environment.ts
EmuKey/backend/src/platform/crypto/license-crypto.ts
EmuKey/frontend/openapi/openapi.json
EmuKey/frontend/src/application/auth/identityQueries.ts
EmuKey/frontend/src/infrastructure/api/generated/index.ts
EmuKey/frontend/src/infrastructure/api/generated/types.gen.ts
EmuKey/frontend/src/presentation/components/AuthForms.tsx
EmuKey/frontend/src/presentation/components/ProviderInvitationsPanel.tsx
EmuKey/frontend/src/presentation/components/ProviderOnboardingForm.tsx
EmuKey/frontend/src/presentation/components/SystemUsersPanel.tsx
EmuKey/frontend/src/presentation/screens/AiKnowledgeScreen.tsx
EmuKey/frontend/src/presentation/screens/AuthScreen.tsx
EmuKey/frontend/src/presentation/screens/SystemConsoleScreen.tsx
EmuKey/frontend/src/presentation/styles.css
EmuKey/mobile/openapi/openapi.json
EmuKey/mobile/src/infrastructure/api/generated/index.ts
EmuKey/mobile/src/infrastructure/api/generated/types.gen.ts
docs/emukey/plans/2026-10-21-provider-invitation-system-dashboard.md
tests/emukey/backend/integration/blockchain/license-db-invariants.integration.test.ts
tests/emukey/backend/integration/catalog/catalog-lifecycle.integration.test.ts
tests/emukey/backend/integration/commerce/commerce-flow.integration.test.ts
tests/emukey/backend/integration/identity/identity-flow.integration.test.ts
tests/emukey/backend/unit/brevo-email-delivery.test.ts
tests/emukey/backend/unit/catalog-admin.service.test.ts
tests/emukey/backend/unit/identity.controller.test.ts
tests/emukey/backend/unit/identity.service.test.ts
tests/emukey/backend/unit/platform/environment.test.ts
tests/emukey/backend/unit/platform/license-crypto.test.ts
tests/emukey/backend/unit/rpc-chain-indexer.service.test.ts
tests/emukey/backend/unit/viem-chain-relayer.test.ts
tests/emukey/contracts/LicenseRegistry.ts
tests/emukey/e2e/web/system-admin.spec.ts
tests/emukey/frontend/api-backed-screens.test.tsx
tests/emukey/frontend/app.test.tsx
tests/emukey/frontend/completed-flows.test.tsx
tests/emukey/frontend/internal-consoles.test.tsx
tests/emukey/frontend/setup.ts
```
