# Buyer and provider review fixes

Goal: resolve the P1/P2 review against existing owners without adding dependencies or changing the SQL schema.

1. Payment: extend the retry decision with a separate `canResume` capability. Keep `allowed` for new attempts. Resume only one live pending attempt without uncertain evidence; expired pending attempts stay blocked. Recheck under the order lock. Update web/mobile and regression tests.
2. Canonical browser test: exercise the purchase modal, capture the created order response, submit signed checkout once, and retain real SePay/Sepolia evidence requirements. External execution requires the existing opt-in configuration.
3. Provider: draft-only editing; product images; grouped product/plan view; derive duration from billing cycle; preserve canonical JSON; refresh a confirmed command once; license search/status filters; one searchable payments view; human-readable dashboard labels.
4. Buyer/admin: respect support conversation links without falling back to another conversation; count devices from projections; preserve lookup/key terminology; explicit audit fields and router links.
5. API/mobile: date-time device DTOs and generated clients; account-owned mobile checkout idempotency, resume/status states, order/support navigation and translated states.
6. Verification: focused regression tests first, frontend/backend/mobile checks, scoped Playwright, OpenAPI consistency, diff and hygiene review. Report external-service or unrelated test limitations explicitly.

Use existing tests under tests/emukey. Preserve user changes; no commit, push, deployment, or external payment execution.

## Verification and handoff

- Backend: 199 unit tests and 10 commerce integration tests passed. Integration verifies that resume retains the attempt ID/reference, expired unresolved attempts cannot create another payment, and ownership/payment evidence are checked.
- Frontend: the broad run reported 174 passed and one failure caused by a test counter including earlier tests. After isolating the counter, the entire Provider suite passed (12 tests). Buyer commerce and completed flows passed on the final rerun (35 tests); metrics and nested-entitlement tests also passed.
- Mobile: all 19 tests passed, including unresolved-payment blocking, order-specific support routing, retry after support failure, and clearing another conversation's AI answer.
- Browser: 17 scoped Playwright tests passed for purchase modal and payment status, including signed POST resume, fresh eligibility checks and responsive widths. Canonical E2E selectors were updated and test discovery checked; no real SePay payment or Sepolia transaction was executed.
- Backend/frontend/mobile lint and typecheck passed; backend and web builds passed; Android export passed. All three OpenAPI consistency checks passed. Device timestamps now generate as nullable date-time strings.
- Workspace hygiene and `git diff --check` passed. The only new source-controlled artifact is this plan/handoff; existing owners and tests were extended, with no dependency or SQL schema changes.

Limitations: Android was exported and unit-tested, not exercised on a physical device. Existing Vite bundle-size, Metro package-export fallback, Ant Design deprecation and jsdom warnings remain. A product image can be added/replaced; an empty image field preserves the existing image under the current API contract. Unresolved expired payments intentionally require confirmation/reconciliation before another attempt. The payment/mobile changes received independent static review; a subsequent broader review was unavailable because the reviewer hit its usage limit.


## Main payment audit follow-up

Confirmed defects were reproduced before implementation: an additional bank transfer was classified as a duplicate; checkout expiration metadata was inaccurate; terminal-order restart restored the old order; the purchase modal ignored refreshed order state and retry decisions; successful gateway returns offered payment resume; payment summaries and consent progress were incomplete; the support launcher overlapped the mobile CTA.

Changes extend the existing commerce repository/service, purchase modal, order query cache and checkout/payment screens. Additional distinct transfers now enter the existing open review queue without provisioning another license. Resume requires a fresh backend decision, while unresolved attempts remain blocked with a status link. Modal state follows server updates, and starting another order detaches the old resume intent. Independent review identified the deep-link plan-change variant; the replacement order now also updates the URL and survives reload. Checkout conflicts receive a human-readable message and refresh state. The payment page shows the order snapshot before payment, respects actual consent timestamps and prioritizes confirmation after a successful gateway return. Purchase dialogs appear above floating support UI.

No schema, dependency, public DTO shape or external-service configuration changes were needed. Test artifacts stay in the OS temporary directory. Browser tests intercept the gateway POST; they do not prove a real SePay-to-Sepolia transaction.


Final follow-up verification:

- Backend: all 199 unit tests and 11 commerce integration tests passed. The new integration test verifies additional-transfer review, same-transfer deduplication, one license only and accurate attempt expiration metadata.
- Frontend: 27 buyer-commerce tests passed; purchase-flow and completed-flows rerun passed all 33 tests. The initial run exposed an inconsistent terminal-order fixture (create and GET disagreed), now corrected. The review-queue test had an initial failure and passed unchanged on rerun.
- Browser: all 27 purchase/payment tests passed, including decision changes and backend 409 conflicts. Visual inspection then identified mobile intrinsic-grid overflow; a new failing assertion reproduced it. After the scoped CSS fix, all 12 purchase tests passed again, including recovery at 320 px, signed checkout at five widths and internal modal overflow checks. The 390 px screenshot was inspected after the fix: consent text wraps fully and the support launcher no longer covers the CTA.
- Backend and frontend lint, typecheck and builds passed. The final web build includes the CSS correction. Existing bundle-size, Ant Design deprecation and jsdom warnings remain.
- Independent follow-up review found no blockers after the deep-link correction. Workspace hygiene and diff whitespace checks passed. No new untracked files were introduced in this follow-up.

The unresolved-expired-attempt rule remains intentionally conservative: confirmation/reconciliation must resolve uncertain payment evidence before another attempt is allowed. Real SePay/Sepolia execution remains untested in this local verification.
