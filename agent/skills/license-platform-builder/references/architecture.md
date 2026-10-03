# Architecture and module ownership

Use a modular monolith for the backend. Keep one deployable backend while enforcing module boundaries so high-load or independently scaling modules can be extracted later.

## Applications

- `web`: React, Vite, Ant Design, TanStack Query.
- `api`: NestJS modular monolith.
- `mobile-manager`: React Native with Expo.
- `license-client-demo`: Kotlin and Jetpack Compose.
- `contracts`: Solidity with Hardhat/OpenZeppelin only where blockchain audit is actually required.

Adapt names to the existing repository. Do not create these folders if equivalent applications already exist.

## Backend modules

Prefer explicit modules for identity/access, enterprise profile, catalog/pricing, orders, contracts/signatures, payments, licenses/keys/devices, support chat, notifications, audit/blockchain, reporting, and AI assistance. A feature may live in fewer modules initially, but dependencies must remain explicit.

## Layers inside a module

1. `domain`: entities, value objects, policies, domain errors/events; no NestJS, TypeORM, Redis, or vendor SDK imports.
2. `application`: use cases, commands/queries, ports, DTO-independent business orchestration.
3. `infrastructure`: TypeORM repositories, Redis/BullMQ implementations, vendor SDK adapters.
4. `presentation`: HTTP controllers, WebSocket gateways, queue consumers, validation, response mapping.

Dependencies point inward. Infrastructure and presentation may depend on application/domain; domain never depends on outer layers.

## Cross-module work

- Call a published application service/port for synchronous invariants that must complete in the same request.
- Publish an internal domain/application event for decoupled follow-up work.
- Use a transactional outbox internally when durable post-transaction delivery is required. This is infrastructure, not a user-facing screen.
- Avoid shared “common” dumping grounds. Share only stable cross-cutting primitives such as identifiers, clock, transaction abstraction, logging, and authentication context.

## Extraction readiness

Keep module-owned tables, queues, caches, APIs, metrics, and configuration recognizable. Do not introduce network calls between modules merely to imitate microservices inside a monolith.
