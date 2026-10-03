# Phase 8 Release and Recovery Runbook

## Required inputs

- Node 22 and Corepack with pnpm 11.
- PostgreSQL with pgvector and Redis; staging uses separate instances from production.
- A configured Sepolia V2 contract, deployment block, RPC primary/fallback, and relayer
  key injected by the deployment platform, never committed or baked into an image.
- Sandbox provider credentials for SePay, Gemini, Cloudinary, Brevo, and FCM as needed.
- A public HTTPS staging URL for `POST /api/v1/payments/ipn` when running SEP-4.

## Build and validate

1. Copy `backend/.env.example` to a secret-managed `backend/.env` for local only.
2. Run `corepack pnpm --dir backend release:check`.
3. Run `corepack pnpm --dir backend baseline:check`, `lint`, `typecheck`, `test`,
   `contracts:verify`, `openapi:check`, and `build`.
4. Build immutable backend and frontend images. Verify no `.env`, contracts, or
   maintenance SQL is present in the runtime image.
5. Run `corepack pnpm --dir backend test:security`, `test:rpc-chaos`, and the safe
   application load scenarios.

## Database and startup

1. Provision a separate staging database and Redis.
2. Apply the version-controlled schema explicitly with the database initializer.
3. Run `db:verify` and seed only disposable/staging fixtures.
4. Deploy API and worker. Readiness must be green before routing web traffic.
5. Do not reset or drop a durable staging/production database during deployment.

## SePay callback

1. Configure DNS/TLS for the staging host and route `/api/*` to the API only.
2. Configure SePay Sandbox callback to `https://<staging-host>/api/v1/payments/ipn`.
3. Confirm request logs redact provider secrets and payload-sensitive fields.
4. Run the external flow and capture only order/payment IDs, provider request IDs,
   transaction hash, receipt, block, and finality evidence.

## Recovery rules

- `SUBMITTED_UNKNOWN`: query the same persisted transaction hash and receipt. Never
  generate a new nonce/raw transaction until the old command has definitive evidence.
- `DEAD_LETTER`: satisfy the command precondition and use the audited recovery operation;
  do not edit PostgreSQL rows directly.
- RPC outage/indexer lag: restore RPC connectivity, then run BC-04 reconciliation.
- Reorg: entitlement and activation-key dependent actions remain unavailable until the
  canonical event/finality projection is rebuilt.
- Payment mismatch/duplicate/late IPN: preserve provider evidence and resolve using the
  System Admin payment review operation. Never insert `PAYMENT_ACCEPTED` manually.
- Notification failure: retry the notification job; never roll back the canonical order,
  license, or chain state.

## Backup and restore drill

1. Run `corepack pnpm --dir backend test:backup-restore` with a disposable/staging
   `DATABASE_URL` and store the redacted metadata under `docs/traceability/releases/<run-id>`.
2. Restore into a separate disposable PostgreSQL database with `pg_restore`.
3. Run schema verification and compare users, catalog, orders, payments, licenses,
   chain commands/events, audit, knowledge, conversations, and notifications.
4. Run BC-04/indexer reconciliation from the recorded canonical chain head.
5. Record expected differences (cache, refresh sessions, queue wakeups) separately from
   durable business-state discrepancies.

## Evidence and shutdown

Run `corepack pnpm --dir backend release:evidence`. The resulting bundle must contain
only redacted JSON, command output, status classifications, hashes, block numbers,
and deployment identifiers. Never persist environment values, credentials, raw keys,
activation plaintext, or customer message bodies.
