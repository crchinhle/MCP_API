# Repository instructions for AI coding agents

These rules apply to every coding task in this repository. Prefer the existing repository over these defaults whenever names or commands differ, but never bypass the safety and hygiene gates.

## Skill routing

`AGENTS.md` contains durable repository rules. Skills contain task-specific workflows. Load the smallest set that covers the current task; do not load every skill merely because it is available. User and platform instructions always take precedence, and a skill never grants authority to expand scope, modify external systems, create commits, push, merge, delete data, or dispatch subagents when that action is not otherwise authorized.

### Baseline sequence for implementation work

1. Use `using-superpowers` to identify applicable workflows.
2. Use `license-platform-builder` for any product feature, bug, integration, infrastructure, mobile, backend, frontend, or end-to-end task in this platform.
3. Use `workspace-hygiene-guard` before creating files, scaffolding, changing dependencies, adding migrations, or performing broad refactors.
4. Use `search-first` before writing a new utility, abstraction, integration, component family, service, or dependency. Search the repository, platform/framework features, installed packages, official registries, and maintained open-source options. Choose adopt, configure, wrap, compose, or custom implementation based on evidence.
5. Use `source-driven-development` whenever correctness depends on a framework, library, SDK, API, external service, or version-specific behavior. Read the exact installed version and authoritative documentation; never invent an API from memory.
6. Use the task-specific skills in the routing table below.
7. Use `verification-before-completion` immediately before any completion or success claim.

If a named skill is unavailable, follow the equivalent workflow in this file and report the limitation. Do not create a duplicate replacement skill during an application task.

### Task-to-skill routing

| Situation | Required or preferred skill |
| --- | --- |
| New feature, changed behavior, unclear UX, or architectural choice | `brainstorming`, then `writing-plans` for multi-step work |
| Execute an approved written plan | `executing-plans` |
| Implement a feature or fix a bug | `test-driven-development` |
| Bug, failed test, flaky behavior, or unexplained incident | `systematic-debugging` before proposing a fix |
| React, Vite, Ant Design, TanStack Query, responsive UI, or accessibility | `frontend-ui-engineering` |
| REST endpoints, DTOs, public contracts, module boundaries, or versioning | `api-and-interface-design` |
| Authentication, authorization, PII, upload, webhook, payment, signature, key, or untrusted input | `security-and-hardening` |
| Logs, metrics, tracing, queues, retries, jobs, or external adapters | `observability-and-instrumentation` |
| Docker Compose, GitHub Actions, build, deployment, or release automation | `ci-cd-and-automation` |
| Browser-level validation of a real user flow | `webapp-testing` |
| Non-trivial high-risk decision with material uncertainty | `doubt-driven-development` |
| Context setup, repeated hallucinations, wrong conventions, or oversized context | `context-engineering` |
| Simplification after behavior is stable and tests pass | `code-simplification` |
| Responding to review feedback | `receiving-code-review` |
| Requesting an independent review when the runtime and authorization permit it | `requesting-code-review` |
| Completing branch work after all checks pass | `finishing-a-development-branch` |
| Creating or changing agent skills | `writing-skills` |

### Conditional Superpowers skills

- Use `dispatching-parallel-agents` and `subagent-driven-development` only when tasks are genuinely independent, the runtime exposes subagents, and current user/platform instructions permit delegation. Never assume delegation is authorized.
- Use `using-git-worktrees` only in a real Git repository when isolation is useful and the operation preserves all user changes. Do not create a branch, commit, merge, push, or remove a worktree unless the task authorizes it.
- `finishing-a-development-branch` may present integration options, but it must not execute a commit, merge, push, deletion, or cleanup without authorization.

### Standard workflows

For a feature:

`inspect -> brainstorm if needed -> search-first -> source verification -> plan -> TDD -> specialist skills -> verification -> review`

For a bug:

`inspect -> reproduce -> systematic debugging -> regression test -> minimal fix -> verification`

For a dependency or external integration:

`search-first -> compare candidates -> source/version verification -> security review -> adapter implementation -> integration tests -> observability -> verification`

## Product and architecture

- Build a TypeScript-first license sales and key-management platform.
- Use React + Vite + Ant Design + TanStack Query for web.
- Use a NestJS modular monolith. Keep domain, application, infrastructure, and presentation layers inside each business module.
- Use PostgreSQL as the authoritative data store; access it through `pg` and version-controlled explicit SQL. Do not introduce an ORM or automatic schema synchronization.
- Use Redis for cache/rate limits/locks/pub-sub and BullMQ, never as the only durable business store.
- Use React Native + Expo for the manager mobile app and Kotlin + Jetpack Compose for the separate license-client demo.
- Keep Cloudinary, Brevo, Gemini, SePay, and blockchain behind backend adapters.
- Run the local MVP with Docker Compose; use GitHub Actions for CI/CD.

## Mandatory inspect-before-edit gate

1. Read all applicable repository instructions.
2. Run `git status --short` and preserve every pre-existing change.
3. Use `rg --files` and targeted `rg` searches to locate existing files, symbols, routes, entities, migrations, tests, utilities, query keys, API clients, and analogous features.
4. Identify the existing owner to extend. Do not create a file until this search is complete.
5. For a complex change, state a short plan and the modules/files expected to change.

## Search before create

Before adding a component, hook, service, DTO, type, utility, repository, endpoint, event, queue, migration, fixture, or configuration:

- Search by intended filename and symbol.
- Search by route, table/entity, UI label, domain phrase, and likely synonym.
- Inspect nearby call sites and an analogous module.
- Extend or refactor the current owner when responsibility matches.
- Create a new abstraction only for a distinct responsibility with at least one real caller.

Do not create parallel `common`, `shared`, `utils`, `helpers`, `types`, `services`, API clients, auth stores, loggers, database connections, or query-key systems without an explicit migration plan.

## Workspace hygiene

- Treat tracked and untracked pre-existing files as user-owned.
- Never use destructive reset, checkout, or clean commands.
- Do not create `copy`, `backup`, `old`, `new`, `v2`, `fixed`, or `final` variants instead of updating the real owner.
- Do not leave `.bak`, `.orig`, `.rej`, swap files, debug logs, screenshots, database dumps, test traces, or ad-hoc scripts in source directories.
- Put temporary outputs in an OS temporary directory. Use an existing ignored output directory only when the tool requires repository-local output.
- Do not commit `dist`, `build`, `coverage`, package caches, IDE state, uploaded customer files, real `.env` files, credentials, private keys, or API tokens.
- Do not run repository-wide formatting for a scoped change.
- Remove only artifacts created by the current task.

## Implementation rules

- Keep business decisions in domain/application code, not controllers, React components, SQL repositories, queue processors, or vendor adapters.
- Enforce authorization, pricing, signatures, payments, and license rules on the backend.
- Communicate across backend modules through published application interfaces or events; never reach into another module's repositories.
- Make callbacks, jobs, payment reconciliation, document generation, and license provisioning idempotent.
- Write durable state to PostgreSQL first in the correct transaction; then invalidate/cache or enqueue follow-up work according to the required guarantee.
- Change the version-controlled SQL schema only for a real schema change. Never enable automatic production schema synchronization.
- Reuse installed dependencies. Add a production dependency only after checking overlap, maintenance, license, security, and runtime/bundle cost.
- Use the repository's current package manager and do not introduce unrelated lockfile churn.

## Test and verification gate

- Reproduce bugs with a failing test when practical.
- Test domain rules at unit level; database/cache/queue/adapters at integration level; HTTP authorization/contracts with Supertest; critical browser flows with Playwright; mobile behavior with the platform's test tools.
- Run focused tests first, then applicable lint, typecheck, broader tests, and build.
- Run `git diff --check` and inspect `git status --short` before handoff.
- Review the final diff for duplicate code, unrelated formatting, generated output, secrets, temporary files, and accidental lockfile changes.
- Never claim a check passed unless it actually ran. Report blocked or unavailable checks explicitly.

## Definition of done

A task is complete only when the requested behavior works through its real boundary, permissions and failure states are covered, SQL schema/configuration changes are included, relevant tests pass, the diff stays in scope, and every intentionally new file has a clear owner. The handoff must list behavior changed, important decisions, tests/checks run, and remaining risks.
