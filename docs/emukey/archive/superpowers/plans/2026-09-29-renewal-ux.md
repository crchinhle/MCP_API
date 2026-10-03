# Account-owned renewal implementation plan

> Historical record: implementation status and commands below describe the dated review, not current acceptance. Current device authority is PostgreSQL; blockchain receives aggregate device-count/version sync only. Repository paths are updated where the referenced files moved.

**Goal:** Renew the signed-in buyer's existing license without asking for its secret; use “Mã bản quyền” in buyer-facing copy.

**Approved spec:** User approved account-owned renewal, current pricing, resume pending orders, visible renewal action, unchanged key/devices and canonical confirmation. Do not weaken activation/recovery authentication.

**Architecture:** Extend commerce service/repository/controller and existing buyer screens. Reuse renewalExpiry for server-side estimates. PostgreSQL serializes renewal creation by target license; existing order snapshots and finality pipeline remain authoritative. No schema or dependency changes.

## Tasks

- [x] Backend regression: in phase5-golden-flow.integration.test.ts renew with undefined key; reject another customer and another plan; concurrently create requests with distinct idempotency keys and assert one order; assert current quote and paid-pending reuse.
- [x] Extend commerce DTO/controller with authenticated GET /orders/renewal-preview/:licenseId. Return current plan, price, duration, estimated expiry, eligibility and existing pending order; never return secrets. Add unauthenticated HTTP coverage.
- [x] Remove renewal secret requirement from commerce service and repository only. Preserve customer/product/provider ownership and valid license states. Serialize creation with a target-scoped transaction advisory lock and reuse eligible pending renewal. Keep original idempotency conflict checks.
- [x] Frontend regression: buyer-commerce test creates renewal without password input or X-License-Key; verify current quote and resume pending order without POST. Implement existing BuyerRenewalScreen and orderQueries, move renewal button to license overview/header. Rename secret labels to Mã bản quyền; public ID labels must remain distinguishable.
- [x] Regenerate OpenAPI backend/frontend/mobile; run focused backend integration/security, frontend tests/typecheck/build and mobile typecheck. Review diff and workspace hygiene. Document limits; do not commit or alter real customer data.

## Verification commands

Backend: `corepack pnpm exec vitest run test/unit test/security test/integration/commerce/commerce-flow.integration.test.ts test/integration/blockchain/phase5-golden-flow.integration.test.ts --maxWorkers=1` with disposable local RPC environment for golden flow.

Frontend: `corepack pnpm exec vitest run test/buyer-commerce.test.tsx test/buyer-hub.test.tsx test/completed-flows.test.tsx`, `corepack pnpm build`; generated clients: `corepack pnpm openapi:check` and typecheck per package. Finish with `git diff --check`.

## Results

153 backend tests passed (including disposable real local RPC golden flow), 43 focused frontend tests and 9 mocked-network browser tests passed. Frontend build, backend/frontend/mobile typechecks, targeted lint and OpenAPI checks passed. Workspace hygiene and diff checks passed; only this plan is intentionally new. API healthy and worker running after rebuild; frontend 5173 serves the new renewal code. No real payment or Sepolia transaction was initiated for verification. Existing Vite chunk-size and jsdom capability warnings remain.
