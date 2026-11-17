# Support chat implementation and acceptance plan

**Goal:** Complete the existing Customer/Support conversation boundary and verify it against the attached audit requirements.

**Architecture:** Keep AssistanceSupportService/Repository, PostgreSQL transactions, notification outbox, claim versions and the worker scheduler. Extend POST /conversations with explicit SUPPORT intent, initialMessage and clientRequestId. Derive a customer-scoped server UUID from the request key; serialize duplicate creation and compare immutable creation inputs against the stored conversation and initial message. No schema or dependency is needed. Reject ordinary messages in AI_ACTIVE; only request-support changes an existing AI conversation to the queue.

**Constraints:** Preserve AI/catalog/knowledge/license/payment behavior, all existing history, and user changes. No branches, commits, pushes or operational database resets. Use disposable PostgreSQL/Redis for integration and browser evidence. Mock-backed UI tests are component evidence only.

## Work packages

- [x] WP1: Record current commit/status, inspect API/DTO/repository/UI/query owners and establish failing regression tests.
- [x] WP2: Extend existing creation DTO/service/repository; atomically save direct request, first message and staff notifications. Test concurrent duplicate creation, payload conflicts, ownership and notification rollback. Reject implicit escalation. Check close lease after lock acquisition; preserve claim/release idempotency and add close/system/requeue notifications.
- [x] WP3: Preserve AI history, citations and catalog sources through handoff. Exercise delayed AI commit against handoff; guest uses existing login flow.
- [x] WP4: Measure existing polling then use shorter visible-tab intervals, explicit focus/reconnect refetch and mutation invalidation. Preserve server sequence, durable timestamps and stable retry keys.
- [x] WP5: Extend BuyerAssistanceScreen with a small direct-support form, state-specific composer and URL selection; SupportConsoleScreen uses URL as selection authority. Extend ConversationPanel for SYSTEM, timestamps, sources, drafts, connection states and conditional scrolling. Keep existing style tokens and responsive layout.
- [x] WP6: Run focused regressions, integration/security concurrency tests, typecheck/lint/build, real multi-context browser flow and responsive/failure measurements. Report actual failures/skips and screenshots in the acceptance report.

Acceptance is scoped to chat verification. Repository-wide frontend failures and live-provider qualification limits remain explicit in `docs/emukey/2026-11-16-support-chat-acceptance.md`; checked work packages do not mean all repository checks pass.

## Verification commands

From EmuKey/backend: `corepack pnpm exec vitest run --config ../../tooling/emukey/verification/vitest.backend.config.ts phase7-assistance assistance-support.service ai-assistance.service`; `corepack pnpm typecheck`; `corepack pnpm lint`; `corepack pnpm build`.

From EmuKey/frontend: `corepack pnpm exec vitest run --config ../../tooling/emukey/verification/vitest.frontend.config.cjs buyer-hub internal-consoles ai-assistant-chat assistance-contract`; `corepack pnpm typecheck`; `corepack pnpm lint`; `corepack pnpm build`.

Use the existing Playwright runner/config with disposable services and external temporary evidence outputs; inspect screenshots at 1440/1024/768/375px. Final checks: `git diff --check`, workspace guard and `git status --short`.

## Official implementation references

- PostgreSQL 15 row/advisory locks: https://www.postgresql.org/docs/15/explicit-locking.html
- TanStack Query v5 focus/reconnect behavior: https://tanstack.com/query/v5/docs/framework/react/guides/window-focus-refetching
- React Router search params: https://reactrouter.com/7.18.3/api/hooks/useSearchParams
- NestJS DTO validation: https://docs.nestjs.com/techniques/validation

Detected manifests: NestJS 12.0.1, pg 8.23.0, React 19.2.8, TanStack Query 5.102.8, React Router 7.18.3, Ant Design 6.6.2. No new production packages planned.
