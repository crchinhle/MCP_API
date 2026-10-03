# Testing, Docker, and CI

## Test matrix

- Domain/application: Jest unit tests for invariants, state transitions, pricing, authorization, and idempotency.
- Backend integration: Jest/Supertest with Testcontainers for PostgreSQL and Redis when real behavior matters.
- Web: React Testing Library for screen/component behavior and Playwright for a small set of critical flows.
- React Native: React Native Testing Library plus targeted device/smoke testing.
- Kotlin: JUnit and Compose UI tests.
- Solidity: Hardhat tests for permissions, emitted events, replay behavior, and hash anchoring.

Use deterministic fixtures and independent test data. Do not share mutable global records across parallel tests. Fake external systems at their adapter boundary and retain a smaller contract/sandbox suite for each real provider.

## Critical E2E paths

Cover at least: registration/login and authorization; provider profile gate; product selection with device quantity and server pricing; automatic order confirmation; buyer contract signing; payment callback/idempotency; license provisioning; key management/verification; support queue claim/release/complete.

## Docker Compose

Run the MVP locally through Docker Compose. Keep backend, PostgreSQL, Redis, workers if separated, and supporting observability as distinct services. Add health checks and dependency readiness; do not rely only on container start order. Use volumes only for durable developer data and document how to reset them safely.

## GitHub Actions

Use reproducible pinned runtime versions and the repository lockfile. Run install, lint, typecheck, unit/integration tests, build, migration validation, and container build as appropriate. Cache package downloads, not generated application state. Never commit CI output or credentials. Publish images to GHCR only after required checks pass.

## Observability

Use structured Pino logs with correlation IDs and redaction. Emit metrics/traces for API latency, queue depth/failures, cache effectiveness, external-provider latency/errors, payment reconciliation, and provisioning. OpenTelemetry/Jaeger may be optional locally but preserve instrumentation boundaries.
