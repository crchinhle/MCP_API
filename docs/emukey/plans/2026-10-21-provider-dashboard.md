# Provider dashboard implementation and verification plan

**Goal:** Implement the supplied Dashboard specification directly in the existing Provider workspace, preserving all existing changes and previous license/copy/sidebar work.

**Stack:** React 19.2.8, Ant Design 6.6.2, React Router 7.18.3, TanStack Query 5.102.8. No dependencies, backend/schema changes, commits or pushes.

**Implementation scope:** Extend `ProviderDashboardScreen.tsx` and its existing CSS. Reuse `ProviderLicenseId`, `ProviderLicenseStatus`, `PageHeader` and existing query hooks. Add only minimal query-parameter support in `ProviderLicensesScreen.tsx` and `ProviderCatalogScreen.tsx`. Extend `paymentNeedsReview` in its existing application owner so the KPI and Operations filter share the backend review semantics.

## Verified semantics

- Products: `PUBLISHED` is publication, not a claim of sale readiness. Draft work counts `DRAFT`. No plan query is necessary to count either.
- Effective licenses: Provider projection returns raw `ce.finality_status`, which is `CONFIRMED`. `CHAIN_CONFIRMED` is the public verification `state`, not the Provider `finality`. Count `ACTIVE && finality === CONFIRMED`. The projection already turns expired ACTIVE records into EXPIRED. Source: `blockchain/infrastructure/license-projection.repository.ts`, `licensing/licensing.service.ts` entitlement checks.
- Issuing licenses: `status === PENDING_ONCHAIN`; other lifecycle states with pending finality are not issuing.
- Review work: `reviewStatus === OPEN`, matching `commerce.repository.ts#listPaymentReview`. DUPLICATE with null review status is already handled; terminal RESOLVED/CLOSED_NO_ACTION records are excluded. The schema also permits MATCHED/OPEN cases, so classification alone is insufficient. Provider can view evidence, not perform System Admin reconciliation.
- Latest licenses: sort valid createdAt descending, invalid/missing dates last with safe fallback; retain records instead of disguising an invalid date as an empty list. Limit five.

## Tasks

- [x] Write failing component tests for KPI semantics, sorting/limit, section visibility, partial failure/retry, loading, onboarding and license deep links.
- [x] Implement compact four-KPI Dashboard, ordered work/progress sections, five-column latest list, safe loading/error/empty states and actionable onboarding.
- [x] Add URL-backed `licenseId` Drawer selection, including invalid-ID feedback and browser history; add `create=product` support for the existing Catalog form without changing validation or persistence.
- [x] Consolidate the current Dashboard CSS, remove only confirmed unused Dashboard rules, and verify mobile/tablet/desktop layouts without global overflow.
- [x] Run focused/component and browser tests, TypeScript, lint/build, diff and workspace hygiene checks. Review final changes and record final results below.

## Expected routes

- `/provider/catalog?status=PUBLISHED`
- `/provider/licenses?status=ACTIVE&finality=CONFIRMED`
- `/provider/licenses?status=PENDING_ONCHAIN`
- `/provider/operations?classification=exceptions`
- `/provider/catalog?status=DRAFT`
- `/provider/licenses`
- `/provider/licenses?licenseId=<owned-license-id>`
- `/provider/catalog?create=product`

## Sources

- https://reactrouter.com/api/hooks/useSearchParams (query changes navigate; use copied URLSearchParams)
- https://ant.design/components/skeleton/ (loading placeholders)
- https://tanstack.com/query/v5/docs/framework/react/guides/queries (independent query loading/error states)

Check implementation against the installed type declarations; exact versioned Router documentation URL was unavailable, so current official API docs and local 7.18.3 types are used.

## Implementation report

### Modified files

- `EmuKey/frontend/src/presentation/screens/ProviderDashboardScreen.tsx`: compact four-KPI overview, independent loading/error/retry, draft work, neutral issuing progress, actionable onboarding, descending latest-five list and real destination links. Removes unused plan fetching.
- `EmuKey/frontend/src/presentation/styles.css`: consolidate Dashboard styles; remove obsolete Dashboard/chart/queue/order CSS after confirming no source callers; preserve shared card padding and other roles' selectors. Mobile uses a compact list presentation of the same semantic table.
- `EmuKey/frontend/src/presentation/screens/ProviderLicensesScreen.tsx`: use URL `licenseId` for the existing Drawer, preserve filters/page when opening and closing, and give generic feedback for IDs absent from the provider-owned list.
- `EmuKey/frontend/src/presentation/screens/ProviderCatalogScreen.tsx`: open the existing creation form from `create=product`, remove the parameter on close and restore the form on browser Back. Wait for its existing queries before resetting the form.
- `EmuKey/frontend/src/application/orders/orderQueries.ts`: shared review predicate follows explicit backend OPEN review state, so Dashboard and Operations exceptions agree.
- `tests/emukey/e2e/web/provider-licenses.spec.ts`: wait for Drawer closure before resizing/opening mobile navigation in the existing copy regression. This tests the completed transition instead of racing the closing animation.

### New files

- `tests/emukey/frontend/provider-dashboard.test.tsx`: KPI/review semantics, latest sorting/limit/date fallback, partial query failure/retry, onboarding and owned-ID deep links.
- `tests/emukey/e2e/web/provider-dashboard.spec.ts`: nine browser cases covering five viewports, all KPI/work destinations, sorting, deep links, ownership fallback, refresh/history, creation form and loading/error states.
- This plan/report.

### UI and navigation decisions

The latest table starts around 550px from the top at 1440×900 with both work and progress populated, leaving its heading and multiple rows visible before scrolling. Four equal KPI cards are 144px tall on desktop. Work and progress blocks have content-based heights (approximately 128px and 82px in the fixture). Loading placeholders reserve comparable space, and successful empty work/progress sections disappear.

The product onboarding occupies one compact section. If there are no products and no licenses, it replaces the empty latest-license card; it does not invent activity or force empty business data into large panels.

Public IDs reuse the existing click-to-copy component, preserving the prior request to remove separate copy icons. The Provider notification bell stays removed. Existing status mapping and Drawer are reused; there is no second details mechanism or new API client.

### Verification checkpoints

- PASS: all nine initial Dashboard Playwright tests, including 320×800, 768×1024, 1024×768, 1440×1024 and 1440×900.
- PASS: actual list filters for PUBLISHED, DRAFT, ACTIVE+CONFIRMED, PENDING_ONCHAIN and Operations exceptions. OPEN MATCHED records remain visible; DUPLICATE/null and terminal review records are excluded.
- PASS: latest-five sort order, opening the selected Drawer, unknown/unowned ID fallback, refresh, Back/Forward and clearing `licenseId` on close.
- PASS: onboarding opens the real form and cancels/restores via history without creating a product.
- PASS: keyboard activation, no raw enums or private license fields in the main table, no document horizontal overflow, desktop card alignment/height and early table visibility.
- PASS: query loading/errors preserve unknown values rather than showing fabricated zeroes; successful unrelated queries keep rendering and failed requests retry independently.
- PASS: TypeScript, ESLint and production Vite build. Vite retains the existing large-bundle warning (approximately 1.60 MB uncompressed); no dependency or bundling scope was added.
- Initial concurrent component run: 44/46 passed; the heavy license search test exceeded the 30-second harness budget and contaminated the following test. Final complete suite uses a 60-second per-test budget with two workers; no production timeout or retry policy is changed.
- Initial combined browser regression: 24/25 passed. The copy test resized before the Drawer closing transition completed. It passes after waiting for hidden state; final combined rerun is recorded below.
- PASS: final combined Dashboard/license Chromium regression, **25/25 tests** (3.3 minutes), including the corrected copy/navigation transition test and loading placeholders.
- PASS: final complete frontend suite, **19/19 test files and 227/227 tests** (480.22 seconds). Command used two workers and a 60-second test budget; this includes Provider, Customer, public, and other existing frontend coverage. No remaining failures.
- PASS: final workspace hygiene guard (three intentionally new files), `git diff --check`, and scoped `git status --short`. Pre-existing tracked/untracked changes remain present. No independent subagent was dispatched; the final code and diff were reviewed locally.
- NOT VERIFIED: a live authenticated production API end-to-end session. Browser tests use API boundary fixtures; business semantics were checked against the current backend and schema source. No real payments, licenses or products were mutated.

### Reproduction

From `EmuKey/frontend`:

```powershell
corepack pnpm exec vitest run --config ../../tooling/emukey/verification/vitest.frontend.config.cjs --maxWorkers=2 --testTimeout=60000
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
# Start Vite at 127.0.0.1:5174 first.
$env:E2E_EXTERNAL = 'true'
$env:BASE_URL = 'http://127.0.0.1:5174'
corepack pnpm exec playwright test --config ../../tooling/emukey/verification/playwright.frontend.config.mjs provider-dashboard.spec.ts provider-licenses.spec.ts --reporter=list --output "$env:TEMP/emukey-dashboard-final-browser" --workers=1
```

Temporary logs: `emukey-dashboard-frontend-all.log` and `emukey-dashboard-e2e-final.log` in the OS temporary directory. Visual captures: `emukey-dashboard-<width>x<height>.png`, also outside the repository. No runtime mock data, generated API types, backend/database changes, commits or pushes were introduced.
