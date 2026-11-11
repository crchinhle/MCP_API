# Custom purchase implementation plan

Goal: configure device quantity and 1/2/3/6/12 months, review an invoice-style order, then use the existing SePay checkout.

Approved pricing: ceil(base price × chosen devices × chosen months / base devices / base months), in VND. No new discounts. Backend is authoritative.

Architecture: extend the existing commerce DTO/service/repository and purchase modal. Persist the buyer and pricing basis with the order; bind the effective license commitment to the purchased configuration. Keep published catalog plans immutable. Preserve existing orders, consent, payment retries and renewal ownership checks.

- [x] Backend: regression tests for validation, pricing, idempotency and custom license issuance; implement the pure pricing policy and extend create-order input.
- [x] SQL: add immutable purchase snapshot; retain plan/product foreign keys while allowing per-order commitments. Verify with disposable PostgreSQL before updating the running development database.
- [x] Frontend: device/month controls; server-confirmed invoice with product, plan, buyer, provider, quantity, term, pricing basis, total and order number; preserve consent and signed SePay submission.
- [x] Regenerate OpenAPI clients; run focused tests, typecheck, lint, builds and browser checks.
- [x] Update runtime, verify actual API creation and clean scope; report any remaining limits.

Existing owners: commerce-payment/domain, commerce.dto.ts, commerce.service.ts, commerce.repository.ts, database/schema.sql, PurchaseFlowModal.tsx, OrderSummary.tsx, styles.css. New policy has one production caller (order creation), plus renewal pricing reuse. Tests stay in tests/emukey.

Verification: frontend purchase/buyer tests 61 passed; backend baseline/commerce integration rerun 34 passed; purchase-modal browser coverage passed across all 12 cases (one locator corrected and rerun). Backend build and lint passed; final frontend typecheck/build and lint passed. Live API verified all five durations with four devices, exact totals, buyer/provider snapshots and idempotency; test orders were cancelled. Running database update preserved 40 existing orders and 33 licenses. API and worker restarted healthy. No real SePay transfer was made; signed checkout submission was covered by browser tests. Existing Vite large-chunk warning remains. Workspace guard and root/nested Git whitespace checks passed.
