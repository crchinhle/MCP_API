# Backend, database, cache, and queue

## NestJS and persistence

- Keep controllers thin and validate external input at the edge.
- Put business transactions in application use cases, not TypeORM entities or controllers.
- Hide TypeORM behind module-owned repository ports where domain behavior benefits from isolation.
- Use PostgreSQL constraints and indexes to enforce durable uniqueness and referential integrity.
- Add forward-only migrations with safe defaults and explicit backfill steps. Never use automatic schema synchronization in production.

## Transaction rules

Persist authoritative business state to PostgreSQL within a transaction. Record idempotency keys for payment callbacks, license provisioning, contract generation, email jobs, and other retried operations. Publish durable follow-up work through an outbox or enqueue after commit according to the failure guarantee required.

## Redis

Use Redis selectively for cache-aside reads, rate limiting, short-lived sessions/tokens where designed, distributed locks, Socket.IO fan-out, and BullMQ. Redis is never the sole record of orders, contracts, payments, licenses, or audit evidence.

For cached reads:

1. Read Redis.
2. On miss, read PostgreSQL.
3. Populate Redis with a bounded TTL.
4. On successful database mutation, invalidate or refresh affected keys.

Do not “write Redis first then database” for durable business data.

## BullMQ

Use queues for email, document generation, notification fan-out, AI work, blockchain submission, and idempotent provisioning that does not need to block the request. Configure bounded retries, exponential backoff, job identifiers, timeouts, observability, and a failed-job recovery path. A queue worker must be safe when the same job is delivered more than once.

## Search and vectors

Use PostgreSQL full-text/indexed queries for ordinary application search. Use `pgvector` only for a defined semantic-search or retrieval requirement; do not vectorize transactional tables by default.
