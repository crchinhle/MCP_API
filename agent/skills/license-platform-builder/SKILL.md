---
name: license-platform-builder
description: Build, change, debug, review, or test complete vertical slices of the license sales and key-management platform across React web, NestJS modular-monolith backend, PostgreSQL/Redis, external integrations, React Native manager app, Kotlin key-checker app, Docker, and CI. Use for UI, API, domain logic, persistence, payments, contracts, license keys, support chat, notifications, mobile, infrastructure, or end-to-end implementation in this product.
---

# License Platform Builder

Implement requested behavior as the smallest complete vertical slice that fits the existing repository. Treat existing code, migrations, tests, and repository instructions as the source of truth; do not scaffold a parallel application.

## 1. Establish the change boundary

1. Read every applicable `AGENTS.md` or equivalent repository instruction.
2. Inspect `git status` without altering user changes.
3. Inventory existing apps, packages, modules, routes, components, entities, migrations, tests, and utilities with `rg --files` and targeted `rg` searches.
4. State the affected user role, screen or client, API, module, data, async work, and tests.
5. Identify an existing implementation to extend before proposing a new file, abstraction, dependency, table, queue, or service.
6. Invoke `workspace-hygiene-guard` when available, especially before creating files or scaffolding.

## 2. Preserve product invariants

Read [domain-invariants.md](references/domain-invariants.md) for authentication, provider onboarding, ordering, contracts, signatures, licenses, mobile clients, and support chat. Stop and surface a conflict instead of silently redesigning the business flow.

## 3. Select the implementation path

Load only the references needed for the task:

- System boundaries or module ownership: [architecture.md](references/architecture.md)
- React web UI and server-state behavior: [frontend-web.md](references/frontend-web.md)
- NestJS, PostgreSQL, Redis, BullMQ, and transactions: [backend-data.md](references/backend-data.md)
- React Native, Kotlin, Cloudinary, Brevo, Gemini, SePay, or blockchain: [mobile-integrations.md](references/mobile-integrations.md)
- Unit, integration, E2E, Docker, and GitHub Actions: [testing-devops.md](references/testing-devops.md)

## 4. Implement a vertical slice

Follow the repository's established naming and dependency direction. For a backend feature, work from domain rules to application use case, ports, infrastructure adapters, controller/gateway, and contract tests. For UI, work from route and permission guard to query/mutation hooks, screen states, reusable components, and accessibility tests. Add database migrations only for real schema changes.

Keep these boundaries:

- Modules communicate through explicit application interfaces or domain events, not another module's repositories.
- Controllers, gateways, and queue processors contain transport glue, not business decisions.
- PostgreSQL remains authoritative. Redis is cache, rate-limit/session support, lock, pub/sub, or queue infrastructure; never make Redis the only durable record.
- External providers sit behind ports/adapters with idempotency, timeout, retry, audit, and failure handling appropriate to the operation.
- Do not add a UI screen for a background capability unless the product requires a human interaction.

## 5. Handle failure and concurrency

Define authorization, validation, empty/loading/error states, retry behavior, idempotency, transaction boundary, cache invalidation, and concurrent updates. Never rely on UI checks for permissions or business invariants.

## 6. Test at the cheapest reliable level

Add or update tests near the changed behavior. Prefer domain/unit tests for rules, integration tests for database/cache/queue/adapters, API tests for contracts and authorization, and a small Playwright or mobile UI test for critical user paths. Reproduce a bug with a failing test before fixing it when practical.

## 7. Verify in the real environment

Run focused checks first, then the repository's broader lint, typecheck, tests, and build. For infrastructure changes, validate Docker Compose health and configuration. Do not claim a check passed unless it ran successfully; report unavailable services or credentials precisely.

## 8. Finish cleanly

Re-run workspace hygiene checks. Remove only artifacts created by the current task. Review the diff for duplicate code, unrelated formatting, generated output, secrets, temporary files, and lockfile churn. Handoff with changed behavior, key decisions, migrations/configuration, tests run, and any genuine residual risk.
