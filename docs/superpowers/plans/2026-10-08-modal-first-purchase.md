# EMUKEY Modal-first Purchase Implementation Plan

> **For agentic workers:** Implement task-by-task with the approved user requirements and verify each checkpoint. No commit or push is authorized for this task.

**Goal:** Refactor EmuKey purchase UX to one shared modal-first flow while preserving server pricing, exact published offer identity, order/terms snapshots, idempotency, signed SePay checkout, payment reconciliation, blockchain projection, and one-time key retrieval.

**Architecture:** Reuse the existing `plans` table and API as purchasable offers; each published plan is one exact edition/device/duration/price/entitlement/commitment tuple. Add no Edition table unless live schema inspection proves the existing plan model cannot represent the requirement. Create one `PurchaseFlowModal` presentation owner, keep `/buyer/checkout` and `/buyer/orders/:id/payment` as fallback routes, and compose the existing query/mutation hooks rather than adding a parallel API client.

**Tech Stack:** React 19.2.8, Vite 8.2.2, Ant Design 6.6.2, TanStack Query 5.102.8, React Router 7.18.3, TypeScript 6.0.3, Vitest 4.1.11, Playwright 1.62.1, NestJS 12.0.1, PostgreSQL/pg.

**Spec:** Approved purchase modal requirements in the conversation, including offer variants, exact terms/payment flow, fallback routes, provider configuration, and verification.

## Global Constraints

- Keep `PurchaseFlowModal` as the only purchase-flow owner.
- Published offers are authoritative; the customer cannot enter arbitrary quota or calculate price.
- Create/resume order only after explicit `Tiếp tục`; no mutation on modal mount/reload.
- Use the order’s exact terms snapshot version/hash/content.
- Payment is an explicit click: accept terms, prepare/reuse attempt, then signed POST to SePay; never iframe or automatic submit.
- Preserve deep links, auth redirect, SePay return, renewal behavior, provider changes, and security/payment/license invariants.
- No new UI framework, smart-contract changes, runtime database reset, commit, or push.

## File map

- Create `EmuKey/frontend/src/presentation/components/PurchaseFlowModal.tsx`: shared two-stage UI and signed POST handoff.
- Create `EmuKey/frontend/src/presentation/components/PurchaseFlowModal.test.tsx`: component behavior/accessibility tests.
- Modify `ProductDetailScreen.tsx`, `CatalogScreen.tsx`, `ComparePlansScreen.tsx`: shared modal entry points.
- Modify `BuyerCheckoutScreen.tsx`: fallback route reusing the flow without mount mutations.
- Modify `orderQueries.ts`, `checkoutIntent.ts`: preserve idempotent order and safe resume state.
- Modify `PaymentStatusScreen.tsx`: preserve full-page return fallback and key/status modal semantics.
- Modify `AiKnowledgeScreen.tsx` only if a single upload modal clearly improves the short task.
- Modify scoped frontend CSS for modal responsive behavior.
- Modify `seed-baseline.ts` for one product with multiple exact published offers.
- Modify DTO/generated contracts or canonical schema/migration only if inspection proves an additive change is necessary.
- Inspect existing backend commerce/catalog tests, frontend Vitest/Playwright setup, and OpenAPI scripts.

## Task 1: Establish offer invariants and regression tests

- [ ] Inspect complete product/plan schema, repositories, generated types, test configuration, and seed call sites.
- [ ] Add a failing selector test: one published plan auto-selects; multiple plans expose only exact plan IDs; no generated quota/price combinations are accepted.
- [ ] Add a failing catalog/seed assertion for one product with Starter/Professional/Business-like published plans and distinct exact price, quota, duration, entitlements, and commitments.
- [ ] Run focused tests and confirm the failures are behavioral, not setup errors.
- [ ] Implement the smallest offer mapping/seed change using existing `plans`; do not add an Edition table if plans already contain the full tuple.
- [ ] Run focused tests green and verify commitments use the existing crypto helper.

## Task 2: Build PurchaseFlowModal with TDD

- [ ] Add failing RTL/Vitest tests for no POST on open; one-offer auto-selection; exact multiple-offer selection; `Tiếp tục` creates one selected `planId`; terms load from order; checkbox is required; payment sequencing; pending blocks double-click; errors retain the modal; close/reopen does not create another order.
- [ ] Add a failing signed-POST test: only a successful backend `POST` checkout response creates/submits a form with backend fields to backend URL; raw key/payment data is not persisted.
- [ ] Implement two concise stages, one primary CTA per stage, accessible Ant Design Modal behavior, mobile full-height CSS, scrollable terms, labels, and live status.

## Task 3: Integrate entry points and preserve fallback routes

- [ ] Add failing screen tests for Product Detail and Catalog opening the same modal; direct purchase appears only when an offer exists; Compare Plans passes the exact plan ID.
- [ ] Add a failing auth redirect test that starts as guest with product/plan context and returns with the exact selected offer after login.
- [ ] Wire Product Detail, Catalog, and Compare Plans to the shared modal without adding purchase logic to those screens.
- [ ] Refactor `BuyerCheckoutScreen` into a fallback route that resumes a stored order/intent or renders the shared flow without create-on-mount; preserve direct links and auth redirects.
- [ ] Keep `/buyer/orders/:id/payment` as independent `PaymentStatusScreen` fallback; do not introduce route-backed modal complexity without proven benefit.
- [ ] Run focused screen tests and verify no order POST occurs on initial render, close, or reload.

## Task 4: Review payment return and activation-key UX

- [ ] Add/adjust tests for return success/error/cancel, uncertain payment, payment review, projection-not-ready license, trusted active license, and explicit one-time key retrieval.
- [ ] Preserve full-page status for direct URLs; keep compact status modal optional and in-context. Never retry automatically after redirect.
- [ ] Ensure key modal opens only after current readiness conditions (ACTIVE, trusted key state, required projection/finality), retrieves only from explicit action, keeps raw key in memory, and removes meaningless save confirmation.
- [ ] Run payment/license tests and inspect duplicate checkout calls and close behavior.

## Task 5: Review Provider and Customer modal candidates

- [ ] Add a focused test if converting AI upload is worthwhile; otherwise keep inline and document why it is clearer.
- [ ] If converted, keep only product/file/upload controls in one modal; keep document search/history/version publishing on the page and prevent nested modals.
- [ ] Keep Provider product/plan forms in existing modals, Provider lifecycle confirmations in one modal, Buyer Orders detail in a Drawer, and data-heavy screens as pages.
- [ ] First UI/UX review at 1440, 1024, 768, and 390px: modal height, footer, focus, Escape, keyboard action, terms scrolling, and error recovery; fix scoped issues.

## Task 6: Contract, seed, and backend verification

- [ ] If offer inspection proves schema/DTO changes necessary, add a forward-only migration and update canonical `backend/database/schema.sql`; otherwise leave the public contract unchanged.
- [ ] Verify provider admin can create/update/publish multiple exact plans and public catalog returns only published plans with required fields.
- [ ] Verify order snapshots selected planId, price, quota, duration, entitlements, version, and commitment; verify idempotency conflict and payment attempt reuse with existing tests.
- [ ] Run OpenAPI generation/check only if source changes require it; avoid unrelated generated churn.
- [ ] Run backend focused tests, frontend focused tests, and available API/Playwright flows.

## Task 7: Final two-pass review and verification

- [ ] Second UI/UX review: remove redundant copy, ensure one primary CTA per stage, no modal-in-modal, no unexplained disabled action, no lost order on close, and no stale pre-snapshot price.
- [ ] Run frontend typecheck, lint, build; backend typecheck, lint, build; targeted tests; OpenAPI checks where applicable; and `git diff --check`.
- [ ] Run workspace hygiene check against the post-approval baseline and inspect final diff/status. Preserve pre-existing EmuKey changes and the pre-existing temporary file.
- [ ] Report exact files changed, click-count before/after, offer configuration behavior, payment/return/key verification, passed checks, blocked checks, and residual risks. Do not claim browser/device checks that did not run.

- [ ] Compose existing catalog/order/terms/mutation/auth/intent owners. Create order only from `Tiếp tục`; use stable intent idempotency; preserve order snapshot display.
- [ ] On payment click require exact loaded terms and checked consent, accept snapshot version/hash, then checkout, then signed POST. Keep errors in place with retry and no duplicate order.
- [ ] Run focused tests through red-green-refactor; extract only a real presentation responsibility if needed.
